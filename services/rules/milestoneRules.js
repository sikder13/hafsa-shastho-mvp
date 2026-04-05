/**
 * Hafsa Sastho (হাফসা স্বাস্থ্য)
 * Bangladesh's First AI Companion for Postpartum and Early Childhood Care
 * Copyright © 2026 Nahl Technologies Inc. All rights reserved.
 *
 * @author Udaay Sikder — Co-Founder & Dev
 */
// services/rules/milestoneRules.js
// Deterministic rules for milestone detection
// Returns structured data ONLY — no Bengali text
// All date operations use dateUtils (dayjs) for timezone safety

import dayjs from 'dayjs';
import { getDateKey, dateKeyDaysAgo } from './dateUtils';

export function detectMilestones({
  ageDays, ageMonths, measurements, completedVaccines, totalVaccines,
  logs, recovery, motherHistory,
}) {
  const milestones = [];

  // === AGE MILESTONES ===
  const ageMilestones = [
    { days: 7, value: '1_week' },
    { days: 14, value: '2_weeks' },
    { days: 30, value: '1_month' },
    { days: 60, value: '2_months' },
    { days: 90, value: '3_months' },
    { days: 120, value: '4_months' },
    { days: 150, value: '5_months' },
    { days: 180, value: '6_months' },
    { days: 270, value: '9_months' },
    { days: 365, value: '1_year' },
    { days: 548, value: '18_months' },
    { days: 730, value: '2_years' },
  ];

  for (const m of ageMilestones) {
    if (ageDays >= m.days && ageDays <= m.days + 1) {
      milestones.push({
        type: 'age', value: m.value, ageDays: m.days,
        priority: 'high', celebrationType: 'confetti',
      });
    }
  }

  // === WEIGHT MILESTONES ===
  if (measurements && measurements.length >= 2) {
    const current = measurements[0].weight;
    const previous = measurements[1].weight;
    const targets = [4, 5, 6, 7, 8, 9, 10, 12];
    for (const target of targets) {
      if (previous < target && current >= target) {
        milestones.push({
          type: 'weight', value: target,
          priority: 'high', celebrationType: 'confetti',
        });
      }
    }
  }

  // === LOGGING STREAK (timezone-safe) ===
  const streakDays = calculateLoggingStreak(logs);
  const streakTargets = [3, 7, 14, 21, 30, 60, 90];
  for (const target of streakTargets) {
    if (streakDays === target) {
      milestones.push({
        type: 'logging_streak', value: target,
        priority: target >= 14 ? 'high' : 'medium',
        celebrationType: target >= 7 ? 'badge' : 'message',
      });
    }
  }

  // === CHECKIN STREAK (timezone-safe) ===
  if (motherHistory) {
    const checkinStreak = calculateCheckinStreak(motherHistory);
    const checkinTargets = [7, 14, 30];
    for (const target of checkinTargets) {
      if (checkinStreak === target) {
        milestones.push({
          type: 'checkin_streak', value: target,
          priority: 'medium', celebrationType: 'badge',
        });
      }
    }
  }

  // === VACCINE PROGRESS ===
  if (completedVaccines && totalVaccines) {
    const percent = Math.round((completedVaccines / totalVaccines) * 100);
    const vaccineTargets = [25, 50, 75, 100];
    for (const target of vaccineTargets) {
      if (percent >= target && percent < target + 10) {
        milestones.push({
          type: 'vaccine_progress', value: target,
          completed: completedVaccines, total: totalVaccines,
          priority: target === 100 ? 'high' : 'medium',
          celebrationType: target === 100 ? 'confetti' : 'badge',
        });
      }
    }
  }

  // === RECOVERY MILESTONES ===
  if (recovery) {
    const recoveryTargets = [25, 50, 75, 100];
    for (const target of recoveryTargets) {
      if (recovery.percentComplete >= target && recovery.percentComplete < target + 10) {
        milestones.push({
          type: 'recovery', value: target,
          priority: target === 100 ? 'high' : 'medium',
          celebrationType: target === 100 ? 'confetti' : 'message',
        });
      }
    }
  }

  // === FIRST SOLID FOOD ===
  if (logs?.food && logs.food.length === 1) {
    milestones.push({
      type: 'first_food', value: 'first_solid_food',
      priority: 'high', celebrationType: 'confetti',
    });
  }

  return milestones;
}

/**
 * Calculate consecutive days with at least one log entry (timezone-safe)
 */
function calculateLoggingStreak(logs) {
  if (!logs) return 0;

  const allLogs = [
    ...(logs.feed || []),
    ...(logs.sleep || []),
    ...(logs.diaper || []),
    ...(logs.food || []),
  ];

  if (allLogs.length === 0) return 0;

  let streak = 0;

  for (let i = 0; i < 90; i++) {
    const targetDate = dateKeyDaysAgo(i);
    const hasLog = allLogs.some(l => {
      try { return getDateKey(l.timestamp) === targetDate; }
      catch { return false; }
    });

    if (hasLog) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  return streak;
}

/**
 * Calculate consecutive days of mother check-in (timezone-safe)
 */
function calculateCheckinStreak(history) {
  if (!history || history.length === 0) return 0;

  let streak = 0;

  for (let i = 0; i < 90; i++) {
    const targetDate = dateKeyDaysAgo(i);
    const hasCheckin = history.some(l => l.date === targetDate);

    if (hasCheckin) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  return streak;
}