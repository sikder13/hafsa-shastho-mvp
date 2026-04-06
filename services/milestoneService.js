/**
 * Hafsa Sastho (হাফসা স্বাস্থ্য)
 * Bangladesh's First AI Companion for Postpartum and Early Childhood Care
 * Copyright © 2026 Nahl Technologies Inc. All rights reserved.
 *
 * @author Udaay Sikder — Co-Founder & Dev
 */
// services/milestoneService.js
// Milestone detection and celebration tracking
//
// Architecture:
//   Computes all achieved milestones from current data,
//   filters out already-celebrated ones (persisted in AsyncStorage),
//   and returns only NEW milestones for display.
//
// This is NOT health logic — it's celebration/gamification.
// Health assessments remain in services/rules/*.

import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import { toBengaliNumber } from '../utils/helpers';

const CELEBRATED_KEY = 'celebrated_milestones';

// ============================================================
// MILESTONE DEFINITIONS
// ============================================================

const AGE_MILESTONES = [
  { days: 7,   id: 'age_1week',   label: '১ সপ্তাহ পূর্ণ' },
  { days: 30,  id: 'age_1month',  label: '১ মাস' },
  { days: 60,  id: 'age_2month',  label: '২ মাস' },
  { days: 90,  id: 'age_3month',  label: '৩ মাস' },
  { days: 120, id: 'age_4month',  label: '৪ মাস' },
  { days: 150, id: 'age_5month',  label: '৫ মাস' },
  { days: 180, id: 'age_6month',  label: '৬ মাস' },
];

const WEIGHT_THRESHOLDS = [4, 5, 6, 7, 8, 9, 10];

const STREAK_MILESTONES = [
  { days: 3,  id: 'streak_3',  label: `${toBengaliNumber(3)} দিন` },
  { days: 7,  id: 'streak_7',  label: `${toBengaliNumber(1)} সপ্তাহ` },
  { days: 14, id: 'streak_14', label: `${toBengaliNumber(2)} সপ্তাহ` },
  { days: 30, id: 'streak_30', label: `${toBengaliNumber(30)} দিন` },
];

const RECOVERY_MILESTONES = [
  { days: 10, id: 'recovery_10', title: '🩹 সেলাই শুকানোর সময় হয়েছে!', subtitle: 'সেলাই শুকাচ্ছে — যত্ন নিন' },
  { days: 21, id: 'recovery_21', title: '💪 ৩ সপ্তাহ! ক্ষত শুকাচ্ছে!', subtitle: 'আপনি দারুণ সুস্থ হচ্ছেন' },
  { days: 42, id: 'recovery_42', title: '🎉 ৬ সপ্তাহ! সম্পূর্ণ সুস্থতার কাছাকাছি!', subtitle: 'প্রায় পুরোপুরি সেরে উঠেছেন' },
];

// ============================================================
// 1. CHECK MILESTONES — main function
// ============================================================

// Recency window: a milestone only shows if achieved within this many days
const RECENCY_WINDOW = 3;

/**
 * Detect RECENTLY achieved milestones (within 3 days).
 * A milestone that happened weeks/months ago is silently skipped — never shown.
 * Returns only milestones that are BOTH recent AND not yet celebrated.
 *
 * @param {Object} baby - { name, birth_date, gender }
 * @param {Object} logs - { feed: [], sleep: [], diaper: [], food: [] }
 * @param {Object} vaccineStatus - { vaccineId: { completed, completedDate } }
 * @param {Object} motherProfile - { delivery_type, ... }
 * @param {Array} growthMeasurements - [{ weight, height, date }]
 * @param {Array} epiSchedule - BD_EPI_SCHEDULE
 * @returns {Array} Array of recent uncelebrated milestone objects
 */
export async function checkMilestones(baby, logs, vaccineStatus, motherProfile, growthMeasurements, epiSchedule) {
  if (!baby?.birth_date) return [];

  try {
    const celebrated = await getCelebratedMilestones();
    const achieved = [];

    const ageDays = dayjs().diff(dayjs(baby.birth_date), 'day');
    const babyName = baby.name || 'শিশু';

    // --- Age milestones ---
    // Only show if baby age is within [milestone_days, milestone_days + 3]
    for (const m of AGE_MILESTONES) {
      if (celebrated.includes(m.id)) continue;
      if (ageDays >= m.days && ageDays <= m.days + RECENCY_WINDOW) {
        const extra = m.days === 180 ? ' শক্ত খাবার শুরু করার সময়!' : '';
        achieved.push({
          id: m.id,
          type: 'age',
          icon: '🎉',
          title: `🎉 ${babyName} আজ ${m.label}!${extra}`,
          subtitle: `${babyName} এর ${m.label} উদযাপন! 🎉`,
          shareText: generateShareText({ type: 'age', detail: m.label }, baby),
          celebratedAt: null,
        });
      }
    }

    // --- Weight milestones ---
    // Only show if the latest measurement was recorded within 3 days
    // AND it crossed a weight threshold
    if (growthMeasurements && growthMeasurements.length > 0) {
      const latest = growthMeasurements[0];
      const latestWeight = latest?.weight;
      const measurementDate = latest?.date;

      if (latestWeight && measurementDate) {
        const daysSinceMeasurement = dayjs().diff(dayjs(measurementDate), 'day');

        if (daysSinceMeasurement <= RECENCY_WINDOW) {
          for (const kg of WEIGHT_THRESHOLDS) {
            const id = `weight_${kg}kg`;
            if (celebrated.includes(id)) continue;
            if (latestWeight >= kg) {
              achieved.push({
                id,
                type: 'weight',
                icon: '🎉',
                title: `🎉 ${babyName} ${toBengaliNumber(kg)} কেজি হয়েছে!`,
                subtitle: 'বাড়ছে সুন্দর!',
                shareText: generateShareText({ type: 'weight', detail: `${toBengaliNumber(kg)} কেজি` }, baby),
                celebratedAt: null,
              });
            }
          }
        }
      }
    }

    // --- Logging streak milestones ---
    // Only show if streak count EXACTLY matches a milestone number today
    const streak = calculateLoggingStreak(logs);
    for (const m of STREAK_MILESTONES) {
      if (celebrated.includes(m.id)) continue;
      if (streak === m.days) {
        const messages = {
          streak_3: `🔥 ${m.label} ধরে লগ করছেন! চালিয়ে যান!`,
          streak_7: `🔥 ${m.label} ধরে লগ! এখন প্যাটার্ন দেখা যাচ্ছে!`,
          streak_14: `🔥 ${m.label}! আপনি দারুণ মা!`,
          streak_30: `🏆 ${m.label}! অসাধারণ!`,
        };
        achieved.push({
          id: m.id,
          type: 'streak',
          icon: m.days === 30 ? '🏆' : '🔥',
          title: messages[m.id],
          subtitle: `${toBengaliNumber(streak)} দিন ধরে একটানা লগ করছেন`,
          shareText: generateShareText({ type: 'streak', detail: `${m.label} ধরে একটানা লগ` }, baby),
          celebratedAt: null,
        });
      }
    }

    // --- Vaccine milestones ---
    // Only show if vaccine was marked complete within 3 days
    if (vaccineStatus && epiSchedule) {
      const completedCount = Object.values(vaccineStatus).filter(v => v.completed).length;
      const totalVaccines = epiSchedule.length;

      for (const vaccine of epiSchedule) {
        const status = vaccineStatus[vaccine.id];
        if (!status?.completed) continue;

        const id = `vaccine_${vaccine.id}`;
        if (celebrated.includes(id)) continue;

        const completedDate = status.completedDate;
        if (completedDate) {
          const daysSinceCompleted = dayjs().diff(dayjs(completedDate), 'day');
          if (daysSinceCompleted <= RECENCY_WINDOW) {
            achieved.push({
              id,
              type: 'vaccine',
              icon: '💉',
              title: `💉 ${vaccine.nameBangla} সম্পন্ন!`,
              subtitle: `${toBengaliNumber(completedCount)}/${toBengaliNumber(totalVaccines)} টিকা হয়েছে!`,
              shareText: generateShareText({ type: 'vaccine', detail: `${vaccine.nameBangla} টিকা সম্পন্ন` }, baby),
              celebratedAt: null,
            });
          }
        }
      }
    }

    // --- Recovery milestones (C-section only) ---
    // Only show if postpartum day is within [milestone_day, milestone_day + 3]
    if (motherProfile?.delivery_type === 'csection') {
      for (const m of RECOVERY_MILESTONES) {
        if (celebrated.includes(m.id)) continue;
        if (ageDays >= m.days && ageDays <= m.days + RECENCY_WINDOW) {
          achieved.push({
            id: m.id,
            type: 'recovery',
            icon: '🩹',
            title: m.title,
            subtitle: m.subtitle,
            shareText: generateShareText({ type: 'recovery', detail: m.title }, baby),
            celebratedAt: null,
          });
        }
      }
    }

    return achieved;
  } catch (e) {
    console.log('Milestone check error:', e.message);
    return [];
  }
}

// ============================================================
// 2. MARK AS CELEBRATED
// ============================================================

/**
 * Save milestone ID to celebrated list so it won't show again.
 * @param {string} milestoneId
 */
export async function markAsCelebrated(milestoneId) {
  try {
    const celebrated = await getCelebratedMilestones();
    if (!celebrated.includes(milestoneId)) {
      celebrated.push(milestoneId);
      await AsyncStorage.setItem(CELEBRATED_KEY, JSON.stringify(celebrated));
    }
  } catch (e) {
    console.log('Mark celebrated error:', e.message);
  }
}

// ============================================================
// 3. GET CELEBRATED MILESTONES
// ============================================================

/**
 * Load list of already-celebrated milestone IDs from AsyncStorage.
 * @returns {Array<string>} Array of milestone ID strings
 */
export async function getCelebratedMilestones() {
  try {
    const raw = await AsyncStorage.getItem(CELEBRATED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.log('Load celebrated error:', e.message);
    return [];
  }
}

// ============================================================
// 4. GENERATE SHARE TEXT
// ============================================================

/**
 * Generate formatted WhatsApp share message.
 * @param {Object} milestone - { type, detail }
 * @param {Object} baby - { name }
 * @returns {string} Formatted share text
 */
export function generateShareText(milestone, baby) {
  const babyName = baby?.name || 'শিশু';
  return `👶 ${babyName} আজ ${milestone.detail}! ✅ | হাফসা স্বাস্থ্য অ্যাপ দিয়ে ট্র্যাক করছি। ডাউনলোড করুন: https://nahltech.com/product/hafsa-sastho`;
}

// ============================================================
// INTERNAL HELPERS
// ============================================================

/**
 * Calculate consecutive days with at least 1 log entry.
 * Counts backwards from today.
 * @param {Object} logs - { feed: [], sleep: [], diaper: [], food: [] }
 * @returns {number} Consecutive days with logs
 */
function calculateLoggingStreak(logs) {
  if (!logs) return 0;

  // Merge all log types into one array of timestamps
  const allLogs = [
    ...(logs.feed || []),
    ...(logs.sleep || []),
    ...(logs.diaper || []),
    ...(logs.food || []),
  ];

  if (allLogs.length === 0) return 0;

  // Build a set of date keys that have at least one log
  const logDates = new Set();
  for (const log of allLogs) {
    try {
      logDates.add(dayjs(log.timestamp).format('YYYY-MM-DD'));
    } catch {
      // skip invalid timestamps
    }
  }

  // Count consecutive days backwards from today
  let streak = 0;
  let checkDate = dayjs();

  for (let i = 0; i < 60; i++) {
    const dateKey = checkDate.format('YYYY-MM-DD');
    if (logDates.has(dateKey)) {
      streak++;
      checkDate = checkDate.subtract(1, 'day');
    } else {
      break;
    }
  }

  return streak;
}
