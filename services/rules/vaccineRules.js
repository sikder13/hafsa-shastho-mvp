/**
 * Hafsa Sastho (হাফসা স্বাস্থ্য)
 * Bangladesh's First AI Companion for Postpartum and Early Childhood Care
 * Copyright © 2026 Nahl Technologies Inc. All rights reserved.
 *
 * @author Udaay Sikder — Co-Founder & Dev
 */
// services/rules/vaccineRules.js
// Deterministic rules for vaccine schedule assessment
// Returns structured data ONLY — no Bengali text
// Based on Bangladesh EPI schedule

import { CONFIG } from '../../utils/constants';

/**
 * Assess vaccine status
 * @param {Object} vaccineStatus - { vaccineId: { completed, completedDate } }
 * @param {number} ageDays - Baby's age in days
 * @param {Array} epiSchedule - Full EPI schedule array from bdEPISchedule.js
 * @returns {Object} Vaccine assessment
 */
export function assessVaccines(vaccineStatus, ageDays, epiSchedule) {
  if (!epiSchedule || epiSchedule.length === 0) {
    return {
      status: 'no_schedule',
      severity: 'none',
      alerts: [],
      completed: 0,
      total: 0,
      upcoming: [],
      overdue: [],
      recentlyCompleted: [],
    };
  }

  const completed = [];
  const upcoming = [];
  const overdue = [];
  const recentlyCompleted = [];
  let total = 0;

  for (const vaccine of epiSchedule) {
    total++;
    const status = vaccineStatus?.[vaccine.id];
    const dueDays = vaccine.dueAgeDays || vaccine.ageWeeks * 7 || 0;
    const daysUntilDue = dueDays - ageDays;

    if (status?.completed) {
      completed.push({
        id: vaccine.id,
        name: vaccine.name,
        completedDate: status.completedDate,
      });

      // Check if recently completed (within post-vaccine care window)
      if (status.completedDate) {
        const daysSinceVaccine = Math.floor(
          (Date.now() - new Date(status.completedDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceVaccine <= CONFIG.postVaccineCareDays) {
          recentlyCompleted.push({
            id: vaccine.id,
            name: vaccine.name,
            daysSince: daysSinceVaccine,
          });
        }
      }
    } else {
      // Not completed
      if (daysUntilDue <= 0) {
        // Overdue
        overdue.push({
          id: vaccine.id,
          name: vaccine.name,
          daysOverdue: Math.abs(daysUntilDue),
        });
      } else if (daysUntilDue <= CONFIG.vaccineReminderDays) {
        // Due soon
        upcoming.push({
          id: vaccine.id,
          name: vaccine.name,
          daysUntil: daysUntilDue,
          isDueToday: daysUntilDue === 0,
        });
      } else {
        // Future — just track the next one
        if (upcoming.length === 0) {
          upcoming.push({
            id: vaccine.id,
            name: vaccine.name,
            daysUntil: daysUntilDue,
            isDueToday: false,
          });
        }
      }
    }
  }

  // Sort overdue by most overdue first
  overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);

  // Alerts
  const alerts = [];
  let severity = 'none';

  if (overdue.length > 0) {
    alerts.push('vaccine_overdue');
    severity = overdue[0].daysOverdue > 14 ? 'high' : 'medium';
  }

  if (upcoming.some(v => v.isDueToday)) {
    alerts.push('vaccine_due_today');
    if (severity === 'none') severity = 'medium';
  } else if (upcoming.some(v => v.daysUntil <= CONFIG.vaccineReminderDays)) {
    alerts.push('vaccine_due_soon');
    if (severity === 'none') severity = 'low';
  }

  if (recentlyCompleted.length > 0) {
    alerts.push('post_vaccine_care');
  }

  // Overall status
  let status = 'on_track';
  if (overdue.length > 0) status = 'behind';
  else if (completed.length === total) status = 'complete';

  return {
    status,
    severity,
    alerts,
    completed: completed.length,
    total,
    completionPercent: total > 0 ? Math.round((completed.length / total) * 100) : 0,
    upcoming: upcoming.slice(0, 3), // Next 3
    overdue,
    recentlyCompleted,
    hasPostVaccineCare: recentlyCompleted.length > 0,
  };
}