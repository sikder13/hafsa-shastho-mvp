/**
 * Hafsa Sastho (হাফসা স্বাস্থ্য)
 * Bangladesh's First AI Companion for Postpartum and Early Childhood Care
 * Copyright © 2026 Nahl Technologies Inc. All rights reserved.
 *
 * @author Udaay Sikder — Co-Founder & Dev
 */
// services/rules/feedRules.js
// Deterministic rules for baby feeding assessment
// Returns structured data ONLY — no Bengali text
// Medical thresholds are hardcoded, never computed by LLM
// All date operations use dateUtils (dayjs) for timezone safety

import { CONFIG } from '../../utils/constants';
import { countForDate, getItemsForDate, minutesSince, currentHour } from './dateUtils';

/**
 * Expected feed counts by age (per day)
 * Source: WHO/UNICEF infant feeding guidelines
 */
const FEED_EXPECTATIONS = {
  0:  { min: 8, max: 12 },
  1:  { min: 8, max: 12 },
  2:  { min: 7, max: 10 },
  3:  { min: 7, max: 10 },
  4:  { min: 6, max: 8 },
  5:  { min: 6, max: 8 },
  6:  { min: 5, max: 7 },
  7:  { min: 5, max: 7 },
  8:  { min: 5, max: 7 },
  9:  { min: 4, max: 6 },
  10: { min: 4, max: 6 },
  11: { min: 4, max: 6 },
  12: { min: 3, max: 5 },
  18: { min: 3, max: 4 },
  24: { min: 2, max: 3 },
};

const MAX_FEED_GAP_HOURS = {
  0: 3, 1: 3, 2: 3.5, 3: 4, 4: 4, 5: 4.5, 6: 5, 9: 6, 12: 8,
};

function getExpectation(ageMonths) {
  const keys = Object.keys(FEED_EXPECTATIONS).map(Number).sort((a, b) => a - b);
  let matched = keys[0];
  for (const key of keys) { if (ageMonths >= key) matched = key; }
  return FEED_EXPECTATIONS[matched];
}

function getMaxGapHours(ageMonths) {
  const keys = Object.keys(MAX_FEED_GAP_HOURS).map(Number).sort((a, b) => a - b);
  let matched = keys[0];
  for (const key of keys) { if (ageMonths >= key) matched = key; }
  return MAX_FEED_GAP_HOURS[matched];
}

function getLastFeedMinutesAgo(feedLogs) {
  const todayFeeds = getItemsForDate(feedLogs, 0);
  if (todayFeeds.length === 0) return null;
  const latest = todayFeeds.reduce((a, b) =>
    new Date(a.timestamp) > new Date(b.timestamp) ? a : b
  );
  return minutesSince(latest.timestamp);
}

function getTrend(logArray, days = 5) {
  const counts = [];
  for (let i = 0; i < days; i++) { counts.push(countForDate(logArray, i)); }
  if (counts.filter(c => c > 0).length < 3) return 'insufficient_data';
  const recent = (counts[0] + counts[1]) / 2;
  const older = counts.slice(2).reduce((a, b) => a + b, 0) / (counts.length - 2);
  if (recent < older - 1.5) return 'decreasing';
  if (recent > older + 1.5) return 'increasing';
  return 'stable';
}

function getFiveDayAverage(logArray) {
  let total = 0; let daysWithData = 0;
  for (let i = 0; i < 5; i++) {
    const count = countForDate(logArray, i);
    if (count > 0 || i === 0) { total += count; daysWithData++; }
  }
  return daysWithData > 0 ? Math.round(total / daysWithData) : 0;
}

export function assessFeeding(logs, ageMonths) {
  const feedLogs = logs.feed || [];
  const diaperLogs = logs.diaper || [];
  const expectation = getExpectation(ageMonths);
  const maxGap = getMaxGapHours(ageMonths);

  const todayCount = countForDate(feedLogs, 0);
  const yesterdayCount = countForDate(feedLogs, 1);
  const fiveDayAvg = getFiveDayAverage(feedLogs);
  const lastFeedMinutesAgo = getLastFeedMinutesAgo(feedLogs);
  const trend = getTrend(feedLogs);
  const hour = currentHour();

  const todayFeeds = getItemsForDate(feedLogs, 0);
  const breastCount = todayFeeds.filter(l => l.details?.feedType === 'breast').length;
  const bottleCount = todayFeeds.filter(l => l.details?.feedType === 'bottle' || l.details?.feedType === 'formula').length;

  const todayDiapers = getItemsForDate(diaperLogs, 0);
  const todayWetDiapers = todayDiapers.filter(l =>
    l.details?.diaperType === 'wet' || l.details?.diaperType === 'both'
  ).length;

  let status = 'good';
  let severity = 'none';
  const alerts = [];

  if (todayCount < expectation.min * 0.4 && hour >= 14) {
    status = 'critical'; severity = 'critical'; alerts.push('feed_critically_low');
  } else if (todayCount < expectation.min * 0.6 && hour >= 12) {
    status = 'low'; severity = 'high'; alerts.push('feed_low');
  }

  if (lastFeedMinutesAgo !== null && lastFeedMinutesAgo > maxGap * 60) {
    alerts.push('feed_gap_long');
    if (severity === 'none') severity = 'high';
  }

  if (trend === 'decreasing') {
    alerts.push('feed_trend_decreasing');
    if (severity === 'none') severity = 'medium';
  }

  if (yesterdayCount > 0 && todayCount < yesterdayCount - 3 && hour >= 16) {
    alerts.push('feed_drop_from_yesterday');
    if (severity === 'none') severity = 'medium';
  }

  if (todayWetDiapers < CONFIG.lowWetDiaperThreshold && hour >= 16) {
    alerts.push('dehydration_risk');
    if (severity === 'none' || severity === 'medium') severity = 'high';
  }

  if (todayCount >= expectation.min && todayCount <= expectation.max) {
    status = 'good'; alerts.push('feed_on_target');
  } else if (todayCount > expectation.max) {
    status = 'high'; alerts.push('feed_above_target'); severity = 'low';
  }

  return {
    status, severity, todayCount, yesterdayCount, fiveDayAvg,
    expectedMin: expectation.min, expectedMax: expectation.max,
    lastFeedMinutesAgo, maxGapMinutes: maxGap * 60, trend,
    breastCount, bottleCount, todayWetDiapers, alerts,
  };
}

export function getPostLogFeedback(logs, ageMonths) {
  const assessment = assessFeeding(logs, ageMonths);
  const { todayCount, expectedMin, expectedMax, yesterdayCount } = assessment;

  let feedbackType = 'neutral';
  if (todayCount >= expectedMin && todayCount <= expectedMax) feedbackType = 'on_target';
  else if (todayCount > expectedMax) feedbackType = 'above_target';
  else if (todayCount >= expectedMin * 0.7) feedbackType = 'almost_there';
  else feedbackType = 'keep_going';

  return {
    feedbackType, todayCount, yesterdayCount, expectedMin, expectedMax,
    remaining: Math.max(0, expectedMin - todayCount),
  };
}