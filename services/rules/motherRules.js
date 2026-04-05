/**
 * Hafsa Sastho (হাফসা স্বাস্থ্য)
 * Bangladesh's First AI Companion for Postpartum and Early Childhood Care
 * Copyright © 2026 Nahl Technologies Inc. All rights reserved.
 *
 * @author Udaay Sikder — Co-Founder & Dev
 */
// services/rules/motherRules.js
// Deterministic rules for mother's postpartum health assessment
// Returns structured data ONLY — no Bengali text
// Medical thresholds are hardcoded, never computed by LLM

import { CONFIG } from '../../utils/constants';
import { getRecoveryStage } from '../../utils/helpers';

/**
 * Analyze mother's mood pattern from history
 * @param {Array} history - motherLogHistory (newest first)
 * @returns {Object} Mood assessment
 */
function analyzeMoodPattern(history) {
  if (!history || history.length === 0) {
    return { consecutiveSadDays: 0, dominantMood: null, trend: 'unknown', totalTracked: 0 };
  }

  const recent = history.slice(0, 14); // Last 14 days
  const moodCounts = { happy: 0, okay: 0, sad: 0, bad: 0 };
  let consecutiveSad = 0;
  let currentStreak = 0;

  for (const log of recent) {
    if (log.mood) {
      moodCounts[log.mood] = (moodCounts[log.mood] || 0) + 1;
      if (log.mood === 'sad' || log.mood === 'bad') {
        currentStreak++;
        consecutiveSad = Math.max(consecutiveSad, currentStreak);
      } else {
        currentStreak = 0;
      }
    }
  }

  const dominant = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0];
  const sadRatio = (moodCounts.sad + moodCounts.bad) / Math.max(recent.length, 1);

  let trend = 'stable';
  if (consecutiveSad >= 5) trend = 'critical';
  else if (consecutiveSad >= 3) trend = 'concerning';
  else if (sadRatio > 0.5) trend = 'mixed_negative';
  else if (moodCounts.happy > moodCounts.sad + moodCounts.bad) trend = 'positive';

  return {
    consecutiveSadDays: consecutiveSad,
    dominantMood: dominant[1] > 0 ? dominant[0] : null,
    trend,
    totalTracked: recent.length,
    sadDayCount: moodCounts.sad + moodCounts.bad,
    happyDayCount: moodCounts.happy,
    sadRatio: Math.round(sadRatio * 100),
  };
}

/**
 * Analyze sleep pattern
 * @param {Array} history - motherLogHistory (newest first)
 * @returns {Object} Sleep assessment
 */
function analyzeSleepPattern(history) {
  const sleepMap = { '1-2': 1.5, '3-4': 3.5, '5-6': 5.5, '7+': 7.5 };

  if (!history || history.length === 0) {
    return { avgHours: null, trend: 'unknown', consecutiveLowDays: 0 };
  }

  const recent = history.slice(0, 7).filter(l => l.sleepHours);
  if (recent.length === 0) return { avgHours: null, trend: 'unknown', consecutiveLowDays: 0 };

  const hours = recent.map(l => sleepMap[l.sleepHours] || 0);
  const avgHours = Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 10) / 10;

  let consecutiveLow = 0;
  for (const h of hours) {
    if (h <= 3.5) consecutiveLow++;
    else break;
  }

  let trend = 'adequate';
  if (avgHours < 2) trend = 'critical';
  else if (avgHours < 3.5) trend = 'very_low';
  else if (avgHours < 5) trend = 'low';

  return {
    avgHours,
    trend,
    consecutiveLowDays: consecutiveLow,
    todayHours: hours.length > 0 ? hours[0] : null,
    daysTracked: recent.length,
  };
}

/**
 * Analyze support pattern
 * @param {Array} history - motherLogHistory (newest first)
 * @returns {Object} Support assessment
 */
function analyzeSupportPattern(history) {
  if (!history || history.length === 0) {
    return { consecutiveNoHelpDays: 0, helpRate: null };
  }

  const recent = history.slice(0, 7).filter(l => l.hadHelp !== undefined && l.hadHelp !== null);
  if (recent.length === 0) return { consecutiveNoHelpDays: 0, helpRate: null };

  let consecutiveNoHelp = 0;
  for (const log of recent) {
    if (log.hadHelp === false) consecutiveNoHelp++;
    else break;
  }

  const helpCount = recent.filter(l => l.hadHelp === true).length;
  const helpRate = Math.round((helpCount / recent.length) * 100);

  return {
    consecutiveNoHelpDays: consecutiveNoHelp,
    helpRate,
    daysTracked: recent.length,
  };
}

/**
 * Assess bleeding status
 * @param {Object} todayLog - Today's mother log
 * @param {Array} history - motherLogHistory
 * @param {number} postpartumDay - Days since delivery
 * @returns {Object} Bleeding assessment
 */
function assessBleeding(todayLog, history, postpartumDay) {
  const bleeding = todayLog?.bleeding || null;

  let status = 'normal';
  let severity = 'none';
  const alerts = [];

  // Heavy bleeding after 14 days is concerning
  if (bleeding === 'heavy' && postpartumDay > 14) {
    status = 'concerning';
    severity = 'critical';
    alerts.push('heavy_bleeding_late');
  }

  // Any bleeding after 42 days (6 weeks) needs attention
  if (bleeding && bleeding !== 'none' && postpartumDay > 42) {
    status = 'concerning';
    severity = 'high';
    alerts.push('bleeding_after_6weeks');
  }

  // Increasing bleeding pattern
  if (history && history.length >= 3) {
    const bleedingScale = { none: 0, light: 1, moderate: 2, heavy: 3 };
    const recent3 = history.slice(0, 3).map(l => bleedingScale[l.bleeding] || 0);
    if (recent3[0] > recent3[1] && recent3[1] > recent3[2] && recent3[0] >= 2) {
      alerts.push('bleeding_increasing');
      if (severity === 'none') severity = 'high';
    }
  }

  return { status, severity, current: bleeding, postpartumDay, alerts };
}

/**
 * Full mother health assessment
 * @param {Object} todayLog - Today's mother check-in
 * @param {Array} history - motherLogHistory (newest first)
 * @param {Object} motherProfile - Mother's profile data
 * @param {number} postpartumDay - Days since delivery
 * @param {Object} epdsData - Latest EPDS assessment { score, q10Score, date }
 * @returns {Object} Complete mother assessment
 */
export function assessMother(todayLog, history, motherProfile, postpartumDay, epdsData) {
  const deliveryType = motherProfile?.delivery_type === 'csection' ? 'csection' : 'normal';

  const moodPattern = analyzeMoodPattern(history);
  const sleepPattern = analyzeSleepPattern(history);
  const supportPattern = analyzeSupportPattern(history);
  const bleedingAssessment = assessBleeding(todayLog, history, postpartumDay);
  const recovery = getRecoveryStage(postpartumDay, deliveryType);

  // Collect all alerts
  const alerts = [...bleedingAssessment.alerts];

  // Mood alerts
  if (moodPattern.consecutiveSadDays >= CONFIG.depressionAlertDays) {
    alerts.push('prolonged_sadness');
  } else if (moodPattern.consecutiveSadDays >= 3) {
    alerts.push('mood_concerning');
  }

  // Sleep alerts
  if (sleepPattern.trend === 'critical') {
    alerts.push('sleep_critical');
  } else if (sleepPattern.consecutiveLowDays >= 3) {
    alerts.push('sleep_consistently_low');
  }

  // Support alerts
  if (supportPattern.consecutiveNoHelpDays >= CONFIG.noSupportAlertDays) {
    alerts.push('no_support_extended');
  } else if (supportPattern.consecutiveNoHelpDays >= 5) {
    alerts.push('no_support_concerning');
  }

  // EPDS alerts
  if (epdsData) {
    if (epdsData.q10Score > 0) {
      alerts.push('self_harm_concern');
    }
    if (epdsData.score >= 13) {
      alerts.push('high_epds_score');
    } else if (epdsData.score >= CONFIG.edinburghConcernScore) {
      alerts.push('elevated_epds_score');
    }
  }

  // C-section healing alerts
  if (todayLog?.csectionHealing === 'worsening') {
    alerts.push('csection_worsening');
  }

  // Water intake
  if (todayLog?.waterIntake !== undefined && todayLog.waterIntake < 4) {
    alerts.push('low_water_intake');
  }

  // Check-in status
  const checkedInToday = !!todayLog;

  // Overall severity
  let overallSeverity = 'none';
  if (alerts.includes('self_harm_concern')) overallSeverity = 'critical';
  else if (alerts.includes('heavy_bleeding_late') || alerts.includes('prolonged_sadness') || alerts.includes('sleep_critical')) overallSeverity = 'critical';
  else if (alerts.some(a => ['high_epds_score', 'csection_worsening', 'bleeding_increasing', 'no_support_extended'].includes(a))) overallSeverity = 'high';
  else if (alerts.some(a => ['mood_concerning', 'sleep_consistently_low', 'elevated_epds_score', 'low_water_intake'].includes(a))) overallSeverity = 'medium';
  else if (alerts.length > 0) overallSeverity = 'low';

  return {
    checkedInToday,
    overallSeverity,
    alerts,
    mood: {
      today: todayLog?.mood || null,
      pattern: moodPattern,
    },
    sleep: {
      today: todayLog?.sleepHours || null,
      pattern: sleepPattern,
    },
    support: supportPattern,
    bleeding: bleedingAssessment,
    recovery: {
      stage: recovery.stage,
      percentComplete: recovery.percentComplete,
      description: recovery.description,
      deliveryType,
      postpartumDay,
    },
    water: {
      today: todayLog?.waterIntake || 0,
      target: CONFIG.waterIntakeTarget,
    },
    meals: {
      today: todayLog?.mealsEaten || 0,
      target: CONFIG.mealsTarget,
    },
    epds: epdsData ? {
      score: epdsData.score,
      q10Score: epdsData.q10Score,
      daysSinceAssessment: epdsData.date ?
        Math.floor((Date.now() - new Date(epdsData.date).getTime()) / (1000 * 60 * 60 * 24)) : null,
      isDue: epdsData.date ?
        Math.floor((Date.now() - new Date(epdsData.date).getTime()) / (1000 * 60 * 60 * 24)) >= CONFIG.edinburghIntervalDays : true,
    } : { score: null, isDue: true },
  };
}