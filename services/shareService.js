// services/shareService.js
// Central sharing service — formats and shares content via native share sheet
//
// Every share is a free advertisement seen by 10-50 people
// in the mother's WhatsApp groups, Facebook, Messenger, etc.
//
// All functions use React Native's Share API and return { success, error? }.

import { Share } from 'react-native';
import { toBengaliNumber } from '../utils/helpers';

const APP_LINK = 'https://nahltech.com/product/hafsa-sastho';
const APP_TAGLINE = 'হাফসা স্বাস্থ্য — মা ও শিশুর AI সহায়ক';

// ============================================================
// 1. SHARE MILESTONE
// ============================================================

/**
 * Share milestone celebration via native share sheet.
 * @param {Object} milestone - { shareText, title, ... } from milestoneService
 * @param {Object} baby - { name }
 * @returns {{ success: boolean, error?: string }}
 */
export async function shareMilestone(milestone, baby) {
  try {
    const babyName = baby?.name || 'শিশু';
    const detail = milestone?.detail || milestone?.title || '';
    const message = `👶 ${babyName} আজ ${detail}! ✅ | হাফসা স্বাস্থ্য অ্যাপ দিয়ে ট্র্যাক করছি। ডাউনলোড করুন: ${APP_LINK}`;

    await Share.share({ message });
    return { success: true };
  } catch (e) {
    console.log('Share milestone error:', e.message);
    return { success: false, error: e.message };
  }
}

// ============================================================
// 2. SHARE WEEKLY SUMMARY
// ============================================================

/**
 * Share weekly summary report.
 * @param {Object} baby - { name }
 * @param {Object} weekData - { avgFeeds, avgSleep, avgDiapers, weight, vaccinesDone }
 * @returns {{ success: boolean, error?: string }}
 */
export async function shareWeeklySummary(baby, weekData) {
  try {
    const babyName = baby?.name || 'শিশু';
    const message = `📊 ${babyName} এর সাপ্তাহিক রিপোর্ট
🍼 দুধ: দিনে গড়ে ${toBengaliNumber(weekData.avgFeeds)} বার
😴 ঘুম: দিনে গড়ে ${toBengaliNumber(weekData.avgSleep)} বার
💩 ডায়াপার: দিনে গড়ে ${toBengaliNumber(weekData.avgDiapers)} বার
⚖️ ওজন: ${toBengaliNumber(weekData.weight)} কেজি
💉 টিকা: ${toBengaliNumber(weekData.vaccinesDone)}/${toBengaliNumber(18)} সম্পন্ন

${APP_TAGLINE}
ডাউনলোড করুন: ${APP_LINK}`;

    await Share.share({ message });
    return { success: true };
  } catch (e) {
    console.log('Share weekly error:', e.message);
    return { success: false, error: e.message };
  }
}

// ============================================================
// 3. SHARE DAILY SUMMARY
// ============================================================

/**
 * Share today's summary.
 * @param {Object} baby - { name }
 * @param {Object} todayData - { feeds, sleeps, diapers }
 * @returns {{ success: boolean, error?: string }}
 */
export async function shareDailySummary(baby, todayData) {
  try {
    const babyName = baby?.name || 'শিশু';
    const message = `📋 আজকের রিপোর্ট — ${babyName}
🍼 দুধ: ${toBengaliNumber(todayData.feeds)} বার
😴 ঘুম: ${toBengaliNumber(todayData.sleeps)} বার
💩 ডায়াপার: ${toBengaliNumber(todayData.diapers)} বার
✅ সব ঠিক আছে!

হাফসা স্বাস্থ্য অ্যাপ: ${APP_LINK}`;

    await Share.share({ message });
    return { success: true };
  } catch (e) {
    console.log('Share daily error:', e.message);
    return { success: false, error: e.message };
  }
}

// ============================================================
// 4. SHARE GROWTH REPORT
// ============================================================

/**
 * Share growth measurement report.
 * @param {Object} baby - { name }
 * @param {Object} measurements - { weight, height, percentileStatus }
 * @returns {{ success: boolean, error?: string }}
 */
export async function shareGrowthReport(baby, measurements) {
  try {
    const babyName = baby?.name || 'শিশু';

    let message = `📈 ${babyName} এর বৃদ্ধি রিপোর্ট
⚖️ ওজন: ${toBengaliNumber(measurements.weight)} কেজি`;

    if (measurements.percentileStatus) {
      message += ` (${measurements.percentileStatus})`;
    }

    if (measurements.height) {
      message += `\n📏 উচ্চতা: ${toBengaliNumber(measurements.height)} সেমি`;
    }

    if (measurements.whoStatus) {
      message += `\n📊 WHO মান অনুযায়ী: ${measurements.whoStatus}`;
    }

    message += `\n\nহাফসা স্বাস্থ্য অ্যাপ: ${APP_LINK}`;

    await Share.share({ message });
    return { success: true };
  } catch (e) {
    console.log('Share growth error:', e.message);
    return { success: false, error: e.message };
  }
}

// ============================================================
// 5. SHARE VACCINE CARD
// ============================================================

/**
 * Share digital vaccine card.
 * @param {Object} baby - { name }
 * @param {Object} vaccineStatus - { vaccineId: { completed, completedDate } }
 * @param {Array} epiSchedule - BD_EPI_SCHEDULE
 * @returns {{ success: boolean, error?: string }}
 */
export async function shareVaccineCard(baby, vaccineStatus, epiSchedule) {
  try {
    const babyName = baby?.name || 'শিশু';
    let completedCount = 0;
    const lines = [];

    for (const vaccine of epiSchedule) {
      const status = vaccineStatus?.[vaccine.id];
      if (status?.completed) {
        completedCount++;
        const date = status.completedDate
          ? new Date(status.completedDate).toLocaleDateString('bn-BD')
          : '';
        lines.push(`✅ ${vaccine.nameBangla} — ${date}`);
      } else {
        lines.push(`⬜ ${vaccine.nameBangla} — বাকি`);
      }
    }

    const totalVaccines = epiSchedule.length;
    const message = `💉 ${babyName} এর টিকা কার্ড
${lines.join('\n')}
${toBengaliNumber(completedCount)}/${toBengaliNumber(totalVaccines)} সম্পন্ন

হাফসা স্বাস্থ্য — ডিজিটাল টিকা কার্ড
${APP_LINK}`;

    await Share.share({ message });
    return { success: true };
  } catch (e) {
    console.log('Share vaccine card error:', e.message);
    return { success: false, error: e.message };
  }
}
