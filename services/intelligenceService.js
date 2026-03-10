// services/intelligenceService.js
// THE BRAIN — every screen calls this, never computes health logic itself
//
// Architecture:
//   UI Screen → intelligenceService.getXXX() → structured data → UI renders
//   AI Chat  → intelligenceService.getAIContext() → assessments → Claude translates to Bengali
//
// Rules: This service returns STRUCTURED DATA, never Bengali text.
//        Bengali text formatting is the responsibility of UI components or the LLM.

import { assessFeeding, getPostLogFeedback } from './rules/feedRules';
import { assessMother } from './rules/motherRules';
import { assessGrowth, getPostMeasurementFeedback } from './rules/growthRules';
import { assessVaccines } from './rules/vaccineRules';
import { analyzeCrossConnections } from './rules/crossRules';
import { detectMilestones } from './rules/milestoneRules';
import { calculateAge, calculateAgeInMonths } from '../utils/helpers';

/**
 * Get all home screen insights — the main intelligence call
 * @param {Object} data - All app context data
 * @returns {Object} { alerts, insights, milestones, eveningSummary, feedStatus, motherStatus }
 */
export function getHomeInsights(data) {
  const {
    baby, motherProfile, logs, todayMotherLog,
    motherLogHistory, vaccineStatus, growthMeasurements, epdsData, epiSchedule
  } = data;

  if (!baby) return { alerts: [], insights: [], milestones: [], feedStatus: null, motherStatus: null };

  const ageInfo = calculateAge(baby.birth_date);
  const ageMonths = calculateAgeInMonths(baby.birth_date);

  // Run all assessments
  const feedAssessment = assessFeeding(logs || {}, ageMonths);
  const motherAssessment = assessMother(
    todayMotherLog, motherLogHistory, motherProfile,
    ageInfo.postpartumDays, epdsData
  );
  const growthAssessment = assessGrowth(growthMeasurements, ageMonths, baby.gender);
  const vaccineAssessment = assessVaccines(vaccineStatus, ageInfo.ageDays, epiSchedule);
  const crossConnections = analyzeCrossConnections(motherAssessment, feedAssessment, growthAssessment);

  const milestones = detectMilestones({
    ageDays: ageInfo.ageDays,
    ageMonths,
    measurements: growthMeasurements,
    completedVaccines: vaccineAssessment.completed,
    totalVaccines: vaccineAssessment.total,
    logs,
    recovery: motherAssessment.recovery,
    motherHistory: motherLogHistory,
  });

  // Collect and prioritize all alerts
  const allAlerts = [
    ...feedAssessment.alerts.map(a => ({ source: 'feed', key: a, severity: feedAssessment.severity })),
    ...motherAssessment.alerts.map(a => ({ source: 'mother', key: a, severity: motherAssessment.overallSeverity })),
    ...growthAssessment.alerts.map(a => ({ source: 'growth', key: a, severity: growthAssessment.severity })),
    ...vaccineAssessment.alerts.map(a => ({ source: 'vaccine', key: a, severity: vaccineAssessment.severity })),
    ...crossConnections.alerts.map(a => ({ source: 'cross', key: a, severity: crossConnections.highestSeverity })),
  ];

  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };
  allAlerts.sort((a, b) => (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4));

  return {
    alerts: allAlerts,
    crossInsights: crossConnections.insights,
    milestones,
    feedStatus: feedAssessment,
    motherStatus: motherAssessment,
    growthStatus: growthAssessment,
    vaccineStatus: vaccineAssessment,
    baby: {
      name: baby.name,
      ageInfo,
      ageMonths,
    },
    mother: {
      name: motherProfile?.name,
      checkedInToday: motherAssessment.checkedInToday,
    },
  };
}

/**
 * Get contextual feedback after logging a baby activity
 * @param {string} type - 'feed', 'sleep', 'diaper', 'food'
 * @param {Object} logs - All logs
 * @param {number} ageMonths - Baby's age in months
 * @returns {Object} Feedback data
 */
export function getLogFeedback(type, logs, ageMonths) {
  if (type === 'feed') {
    return { type: 'feed', ...getPostLogFeedback(logs, ageMonths) };
  }

  // For sleep, diaper, food — simpler feedback
  const todayDate = new Date().toDateString();
  const todayCount = (logs[type] || []).filter(l => {
    try { return new Date(l.timestamp).toDateString() === todayDate; }
    catch { return false; }
  }).length;

  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toDateString();
  const yesterdayCount = (logs[type] || []).filter(l => {
    try { return new Date(l.timestamp).toDateString() === yesterdayStr; }
    catch { return false; }
  }).length;

  return {
    type,
    todayCount,
    yesterdayCount,
    feedbackType: 'logged',
  };
}

/**
 * Get growth insight after adding measurement
 * @param {Array} measurements - Updated measurements
 * @param {number} ageMonths - Baby's age
 * @param {string} gender - 'male' or 'female'
 * @returns {Object} Growth feedback
 */
export function getGrowthInsight(measurements, ageMonths, gender) {
  return getPostMeasurementFeedback(measurements, ageMonths, gender);
}

/**
 * Get mother check-in assessment
 * Called after mother completes daily check-in
 * @param {Object} todayLog - Today's check-in data
 * @param {Array} history - Mother log history
 * @param {Object} motherProfile - Profile
 * @param {number} postpartumDay - Days since delivery
 * @param {Object} epdsData - EPDS data
 * @returns {Object} Assessment for Hafsa to communicate
 */
export function getCheckInAssessment(todayLog, history, motherProfile, postpartumDay, epdsData) {
  return assessMother(todayLog, history, motherProfile, postpartumDay, epdsData);
}

/**
 * Get evening summary data
 * @param {Object} data - All app context data
 * @returns {Object} Summary of today's activity
 */
export function getEveningSummary(data) {
  const { baby, logs, todayMotherLog, motherLogHistory, motherProfile, growthMeasurements, vaccineStatus, epiSchedule, epdsData } = data;
  if (!baby) return null;

  const ageInfo = calculateAge(baby.birth_date);
  const ageMonths = calculateAgeInMonths(baby.birth_date);

  const feedAssessment = assessFeeding(logs || {}, ageMonths);
  const motherAssessment = assessMother(todayMotherLog, motherLogHistory, motherProfile, ageInfo.postpartumDays, epdsData);

  const todayDate = new Date().toDateString();
  const sleepCount = (logs?.sleep || []).filter(l => {
    try { return new Date(l.timestamp).toDateString() === todayDate; }
    catch { return false; }
  }).length;
  const diaperCount = (logs?.diaper || []).filter(l => {
    try { return new Date(l.timestamp).toDateString() === todayDate; }
    catch { return false; }
  }).length;

  return {
    baby: {
      name: baby.name,
      feedCount: feedAssessment.todayCount,
      feedStatus: feedAssessment.status,
      sleepCount,
      diaperCount,
    },
    mother: {
      checkedIn: motherAssessment.checkedInToday,
      mood: motherAssessment.mood.today,
      sleep: motherAssessment.sleep.today,
      water: motherAssessment.water.today,
      overallSeverity: motherAssessment.overallSeverity,
    },
    date: new Date().toISOString(),
  };
}

/**
 * Get weekly comparison report
 * @param {Object} data - All app context data
 * @returns {Object} Week-over-week comparison
 */
export function getWeeklyReport(data) {
  const { baby, logs, motherLogHistory } = data;
  if (!baby) return null;

  const ageMonths = calculateAgeInMonths(baby.birth_date);

  function weekCount(logArray, weekOffset) {
    let total = 0;
    for (let d = 0; d < 7; d++) {
      const date = new Date();
      date.setDate(date.getDate() - (weekOffset * 7) - d);
      const dateStr = date.toDateString();
      total += (logArray || []).filter(l => {
        try { return new Date(l.timestamp).toDateString() === dateStr; }
        catch { return false; }
      }).length;
    }
    return total;
  }

  const thisWeek = {
    feed: weekCount(logs?.feed, 0),
    sleep: weekCount(logs?.sleep, 0),
    diaper: weekCount(logs?.diaper, 0),
  };

  const lastWeek = {
    feed: weekCount(logs?.feed, 1),
    sleep: weekCount(logs?.sleep, 1),
    diaper: weekCount(logs?.diaper, 1),
  };

  // Mother check-in stats
  let thisWeekCheckins = 0;
  let lastWeekCheckins = 0;
  if (motherLogHistory) {
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    for (const log of motherLogHistory) {
      const logTime = new Date(log.date || log.created_at).getTime();
      if (now - logTime < weekMs) thisWeekCheckins++;
      else if (now - logTime < weekMs * 2) lastWeekCheckins++;
    }
  }

  return {
    thisWeek: { ...thisWeek, checkins: thisWeekCheckins },
    lastWeek: { ...lastWeek, checkins: lastWeekCheckins },
    comparison: {
      feedChange: thisWeek.feed - lastWeek.feed,
      sleepChange: thisWeek.sleep - lastWeek.sleep,
      diaperChange: thisWeek.diaper - lastWeek.diaper,
      checkinChange: thisWeekCheckins - lastWeekCheckins,
    },
    babyName: baby.name,
  };
}

/**
 * Get all current alerts sorted by priority
 * @param {Object} data - All app context data
 * @returns {Array} Sorted alert objects
 */
export function getAlerts(data) {
  const home = getHomeInsights(data);
  return home.alerts;
}

/**
 * Get full AI context — pre-computed assessments for the LLM
 * This replaces the old contextBuilder approach.
 * Claude receives these assessments and ONLY translates them to Bengali.
 * Claude must NOT override these medical assessments.
 *
 * @param {Object} data - All app context data
 * @returns {Object} Full AI context with pre-computed assessments
 */
export function getAIContext(data) {
  const {
    baby, motherProfile, logs, todayMotherLog,
    motherLogHistory, vaccineStatus, growthMeasurements, epdsData, epiSchedule
  } = data;

  if (!baby) return { hasData: false };

  const ageInfo = calculateAge(baby.birth_date);
  const ageMonths = calculateAgeInMonths(baby.birth_date);

  const feedAssessment = assessFeeding(logs || {}, ageMonths);
  const motherAssessment = assessMother(
    todayMotherLog, motherLogHistory, motherProfile,
    ageInfo.postpartumDays, epdsData
  );
  const growthAssessment = assessGrowth(growthMeasurements, ageMonths, baby.gender);
  const vaccineAssessment = assessVaccines(vaccineStatus, ageInfo.ageDays, epiSchedule);
  const crossConnections = analyzeCrossConnections(motherAssessment, feedAssessment, growthAssessment);

  return {
    hasData: true,

    // Baby info
    baby: {
      name: baby.name,
      gender: baby.gender,
      bengaliAge: ageInfo.bengaliAge,
      ageDays: ageInfo.ageDays,
      ageMonths,
    },

    // Mother info
    mother: {
      name: motherProfile?.name,
      postpartumDay: ageInfo.postpartumDays,
      deliveryType: motherProfile?.delivery_type,
    },

    // PRE-COMPUTED ASSESSMENTS — Claude must NOT override these
    assessments: {
      feed: feedAssessment,
      mother: motherAssessment,
      growth: growthAssessment,
      vaccine: vaccineAssessment,
      crossConnections,
    },

    // Placeholder for future RAG results
    // When RAG is implemented, medical knowledge base results go here
    ragResults: null,
  };
}