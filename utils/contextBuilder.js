// utils/contextBuilder.js
// Builds complete context for Hafsa AI — the bridge between app data and intelligence
//
// Architecture:
//   AppContext data → contextBuilder → structured context object → hafsaPrompt → Claude API
//
// This module gathers data from two sources:
//   1. AppContext (in-memory, preferred — already loaded)
//   2. AsyncStorage (fallback — when AppContext data not passed)
//
// The output is a single context object that hafsaPrompt.js consumes to build
// the dynamic system prompt. Every piece of data Hafsa needs is here.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { calculateAge, countToday, safeJSONParse, getRecoveryStage, toBengaliNumber } from './helpers';
import { STORAGE_KEYS, CONFIG } from './constants';

// ============================================================
// MAIN ENTRY POINT
// ============================================================

/**
 * Build complete context for Hafsa AI
 *
 * @param {Object} params
 * @param {Object} params.baby           - Baby profile from AppContext
 * @param {Object} params.motherProfile  - Mother profile from AppContext
 * @param {Object} params.logs           - Daily logs {feed:[], sleep:[], diaper:[], food:[]}
 * @param {Object} params.todayMotherLog - Today's mother check-in
 * @param {Array}  params.motherLogHistory - Last 30 days of mother logs
 * @param {Object} params.vaccineStatus  - Vaccine completion status
 * @param {Array}  params.growthMeasurements - All growth measurements
 *
 * @returns {Object} Complete context object for system prompt
 */
export async function buildFullContext({
  baby,
  motherProfile = null,
  logs = null,
  todayMotherLog = null,
  motherLogHistory = [],
  vaccineStatus = null,
  growthMeasurements = []
} = {}) {
  if (!baby) {
    return getEmptyContext();
  }

  try {
    // Load any missing data from AsyncStorage (fallback)
    const [resolvedLogs, resolvedVaccines, resolvedGrowth, resolvedMotherProfile, resolvedEPDS] =
      await Promise.all([
        logs || loadFromStorage(STORAGE_KEYS.dailyLogs(baby.id), { feed: [], sleep: [], diaper: [], food: [] }),
        vaccineStatus || loadFromStorage(STORAGE_KEYS.vaccineStatus(baby.id), {}),
        growthMeasurements.length > 0 ? growthMeasurements : loadFromStorage(STORAGE_KEYS.growthMeasurements(baby.id), []),
        motherProfile || loadFromStorage(STORAGE_KEYS.motherProfile, null),
        loadEPDSHistory()
      ]);

    // Build each context section
    const babyContext = buildBabySection(baby, resolvedLogs);
    const motherContext = buildMotherSection(baby, resolvedMotherProfile, todayMotherLog, motherLogHistory, resolvedEPDS);
    const vaccineContext = buildVaccineSection(resolvedVaccines, babyContext.ageDays);
    const growthContext = buildGrowthSection(resolvedGrowth, baby.gender);
    const patternContext = buildPatternSection(resolvedLogs, motherLogHistory);
    const suggestedQuestions = buildSuggestedQuestions(babyContext, motherContext, vaccineContext, growthContext, patternContext);

    return {
      baby: babyContext,
      mother: motherContext,
      vaccine: vaccineContext,
      growth: growthContext,
      patterns: patternContext,
      suggestedQuestions,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error building context:', error);
    return getEmptyContext(baby);
  }
}

// ============================================================
// BABY SECTION
// ============================================================

function buildBabySection(baby, logs) {
  const ageInfo = calculateAge(baby.birth_date);
  const today = {
    feed: countToday(logs.feed),
    sleep: countToday(logs.sleep),
    diaper: countToday(logs.diaper),
    food: countToday(logs.food)
  };

  // Find last feed time
  const lastFeed = getLastEntryTime(logs.feed);
  const lastSleep = getLastEntryTime(logs.sleep);

  // Get feed details from today (if available)
  const todayFeedDetails = getTodayEntries(logs.feed);
  const breastCount = todayFeedDetails.filter(l => l.details?.feedType === 'breast').length;
  const bottleCount = todayFeedDetails.filter(l => l.details?.feedType === 'bottle' || l.details?.feedType === 'formula').length;

  // Yesterday's counts for comparison
  const yesterday = {
    feed: countForDate(logs.feed, -1),
    sleep: countForDate(logs.sleep, -1),
    diaper: countForDate(logs.diaper, -1),
    food: countForDate(logs.food, -1)
  };

  // 5-day average
  const feedLast5 = getLast7DaysCount(logs.feed).slice(0, 5);
  const sleepLast5 = getLast7DaysCount(logs.sleep).slice(0, 5);
  const fiveDayAvgFeed = feedLast5.length > 0 ? Math.round(feedLast5.reduce((a, b) => a + b, 0) / feedLast5.length) : 0;
  const fiveDayAvgSleep = sleepLast5.length > 0 ? Math.round(sleepLast5.reduce((a, b) => a + b, 0) / sleepLast5.length) : 0;

  // Feed trend (last 5 days)
  const feedTrendData = getLast7DaysCount(logs.feed).slice(0, 5);
  let feedTrend = 'stable';
  if (feedTrendData.length >= 3) {
    const recent = feedTrendData.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
    const older = feedTrendData.slice(2).reduce((a, b) => a + b, 0) / (feedTrendData.length - 2);
    if (recent < older - 1) feedTrend = 'decreasing';
    else if (recent > older + 1) feedTrend = 'increasing';
  }

  return {
    name: baby.name,
    gender: baby.gender,
    birthDate: baby.birth_date,
    bengaliAge: ageInfo.bengaliAge,
    ageDays: ageInfo.ageDays,
    ageMonths: ageInfo.ageMonths,
    ageWeeks: Math.floor(ageInfo.ageDays / 7),

    today,
    yesterday,
    fiveDayAvgFeed,
    fiveDayAvgSleep,
    feedTrend,
    lastFeedMinutesAgo: lastFeed ? minutesAgo(lastFeed) : null,
    lastSleepMinutesAgo: lastSleep ? minutesAgo(lastSleep) : null,
    breastCountToday: breastCount,
    bottleCountToday: bottleCount,

    // Age-based expectations
    expectedFeeds: getExpectedFeeds(ageInfo.ageMonths),
    expectedSleepHours: getExpectedSleep(ageInfo.ageMonths),
    solidFoodReady: ageInfo.ageMonths >= 6
  };
}

// ============================================================
// MOTHER SECTION
// ============================================================

function buildMotherSection(baby, motherProfile, todayLog, logHistory, epdsHistory) {
  if (!motherProfile) {
    return null;
  }

  const ageInfo = calculateAge(baby.birth_date);
  const postpartumDays = ageInfo.ageDays;
  const isCsection = motherProfile.delivery_type === 'csection';
  const recovery = getRecoveryStage(postpartumDays, isCsection ? 'csection' : 'normal');

  // Mood pattern analysis
  const moodPattern = analyzeMoodPattern(logHistory);

  // Sleep pattern
  const sleepPattern = analyzeSleepPattern(logHistory);

  // Support pattern
  const supportPattern = analyzeSupportPattern(logHistory);

  // Latest EPDS
  const latestEPDS = epdsHistory && epdsHistory.length > 0 ? epdsHistory[0] : null;

  return {
    name: motherProfile.name,
    deliveryType: motherProfile.delivery_type,
    isFirstBaby: motherProfile.is_first_baby,
    concerns: motherProfile.concerns || [],
    postpartumDays,
    isCsection,

    recovery: {
      stage: recovery.stage,
      description: recovery.description,
      percentComplete: recovery.percentComplete
    },

    today: todayLog ? {
      mood: todayLog.mood,
      bleeding: todayLog.bleeding,
      pain: todayLog.pain,
      breastPain: todayLog.breastPain,
      csectionHealing: todayLog.csectionHealing,
      waterIntake: todayLog.waterIntake,
      mealsEaten: todayLog.mealsEaten,
      sleepHours: todayLog.sleepHours,
      hadHelp: todayLog.hadHelp,
      breastfeedingSessions: todayLog.breastfeedingSessions,
      checkedIn: true
    } : { checkedIn: false },

    moodPattern,
    sleepPattern,
    supportPattern,

    epds: latestEPDS ? {
      score: latestEPDS.score,
      date: latestEPDS.date,
      q10Concern: latestEPDS.q10Concern,
      daysSince: Math.floor((Date.now() - new Date(latestEPDS.date).getTime()) / (1000 * 60 * 60 * 24))
    } : null,

    // Flags for urgent attention
    flags: buildMotherFlags(todayLog, moodPattern, sleepPattern, supportPattern, latestEPDS)
  };
}

// ============================================================
// VACCINE SECTION
// ============================================================

function buildVaccineSection(vaccineStatus, babyAgeDays) {
  const EPI_SCHEDULE = [
    { id: 'bcg', nameBangla: 'বিসিজি', ageDays: 0 },
    { id: 'polio0', nameBangla: 'পোলিও-০', ageDays: 0 },
    { id: 'penta1', nameBangla: 'পেন্টা-১', ageDays: 42 },
    { id: 'polio1', nameBangla: 'পোলিও-১', ageDays: 42 },
    { id: 'pcv1', nameBangla: 'পিসিভি-১', ageDays: 42 },
    { id: 'penta2', nameBangla: 'পেন্টা-২', ageDays: 70 },
    { id: 'polio2', nameBangla: 'পোলিও-২', ageDays: 70 },
    { id: 'pcv2', nameBangla: 'পিসিভি-২', ageDays: 70 },
    { id: 'penta3', nameBangla: 'পেন্টা-৩', ageDays: 98 },
    { id: 'polio3', nameBangla: 'পোলিও-৩', ageDays: 98 },
    { id: 'pcv3', nameBangla: 'পিসিভি-৩', ageDays: 98 },
    { id: 'ipv', nameBangla: 'আইপিভি', ageDays: 98 },
    { id: 'mr1', nameBangla: 'এমআর-১', ageDays: 270 },
    { id: 'mr2', nameBangla: 'এমআর-২', ageDays: 450 }
  ];

  const upcoming = [];
  const overdue = [];
  const recentlyCompleted = [];
  let completedCount = 0;

  EPI_SCHEDULE.forEach(vaccine => {
    const status = vaccineStatus[vaccine.id];

    if (status?.completed) {
      completedCount++;
      const daysAgo = Math.floor(
        (Date.now() - new Date(status.completedDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysAgo <= 3) {
        recentlyCompleted.push({ name: vaccine.nameBangla, daysAgo });
      }
    } else {
      const daysUntilDue = vaccine.ageDays - babyAgeDays;
      if (daysUntilDue <= 7 && daysUntilDue >= -7) {
        if (daysUntilDue >= 0) {
          upcoming.push({ name: vaccine.nameBangla, daysUntil: daysUntilDue });
        } else {
          overdue.push({ name: vaccine.nameBangla, daysOverdue: Math.abs(daysUntilDue) });
        }
      } else if (daysUntilDue < -7) {
        overdue.push({ name: vaccine.nameBangla, daysOverdue: Math.abs(daysUntilDue) });
      }
    }
  });

  return {
    completedCount,
    totalCount: EPI_SCHEDULE.length,
    upcoming,
    overdue,
    recentlyCompleted,
    hasPostVaccineCare: recentlyCompleted.length > 0
  };
}

// ============================================================
// GROWTH SECTION
// ============================================================

function buildGrowthSection(measurements, gender) {
  if (!measurements || measurements.length === 0) {
    return { hasMeasurements: false };
  }

  // Sort by date, newest first
  const sorted = [...measurements].sort((a, b) => new Date(b.date) - new Date(a.date));
  const latest = sorted[0];
  const previous = sorted.length > 1 ? sorted[1] : null;

  // Calculate velocity if we have 2+ measurements
  let velocityGramsPerMonth = null;
  if (previous && latest.weight && previous.weight) {
    const daysBetween = Math.max(1,
      (new Date(latest.date) - new Date(previous.date)) / (1000 * 60 * 60 * 24)
    );
    const weightDiffGrams = (latest.weight - previous.weight) * 1000;
    velocityGramsPerMonth = Math.round((weightDiffGrams / daysBetween) * 30);
  }

  return {
    hasMeasurements: true,
    latest: {
      weight: latest.weight,
      height: latest.height,
      date: latest.date
    },
    measurementCount: sorted.length,
    velocityGramsPerMonth,
    isGoodVelocity: velocityGramsPerMonth !== null ? velocityGramsPerMonth >= CONFIG.minGrowthVelocity : null
  };
}

// ============================================================
// PATTERN ANALYSIS
// ============================================================

function buildPatternSection(logs, motherLogHistory) {
  // Baby feeding pattern (last 7 days)
  const feedPattern = analyzeFeedPattern(logs.feed);
  const sleepBabyPattern = analyzeBabySleepPattern(logs.sleep);

  return {
    baby: {
      feedTrend: feedPattern.trend,        // 'increasing', 'stable', 'decreasing'
      avgDailyFeeds: feedPattern.avgDaily,
      sleepTrend: sleepBabyPattern.trend,
      avgDailySleeps: sleepBabyPattern.avgDaily
    },
    mother: {
      // Already computed in mother section, but adding cross-references here
      consecutiveSadDays: getConsecutiveSadDays(motherLogHistory),
      consecutiveNoHelpDays: getConsecutiveNoHelpDays(motherLogHistory),
      avgSleepHours: getAvgMotherSleep(motherLogHistory)
    }
  };
}

// ============================================================
// SUGGESTED QUESTIONS ENGINE
// ============================================================

function buildSuggestedQuestions(baby, mother, vaccine, growth, patterns) {
  const questions = [];

  // Vaccine-related
  if (vaccine.upcoming.length > 0) {
    questions.push({
      text: `${vaccine.upcoming[0].name} টিকার আগে কি প্রস্তুতি নেব?`,
      priority: 9
    });
  }
  if (vaccine.hasPostVaccineCare) {
    questions.push({
      text: 'টিকার পর জ্বর হলে কি করব?',
      priority: 10
    });
  }
  if (vaccine.overdue.length > 0) {
    questions.push({
      text: `${vaccine.overdue[0].name} টিকা মিস হয়ে গেছে, এখন কি করব?`,
      priority: 8
    });
  }

  // Age-based
  if (baby.ageMonths >= 5 && baby.ageMonths < 7) {
    questions.push({
      text: 'কখন থেকে শক্ত খাবার শুরু করব?',
      priority: 7
    });
  }
  if (baby.ageMonths < 3) {
    questions.push({
      text: `${baby.name} কি যথেষ্ট ঘুমাচ্ছে?`,
      priority: 5
    });
  }

  // Feed-related
  if (baby.lastFeedMinutesAgo && baby.lastFeedMinutesAgo > 240) {
    questions.push({
      text: `${toBengaliNumber(Math.round(baby.lastFeedMinutesAgo / 60))} ঘন্টা দুধ খাওয়াই না, ঠিক আছে?`,
      priority: 8
    });
  }

  // Mother-related
  if (mother) {
    if (mother.today.checkedIn && mother.today.mood === 'sad' || mother.today.mood === 'bad') {
      questions.push({
        text: 'মন ভালো না, কি করতে পারি?',
        priority: 9
      });
    }
    if (mother.isCsection && mother.postpartumDays <= 42) {
      questions.push({
        text: 'সিজারের সেলাই কবে পুরো সারবে?',
        priority: 6
      });
    }
    if (mother.today.checkedIn && mother.today.bleeding === 'heavy') {
      questions.push({
        text: 'রক্তপাত বেশি হচ্ছে, স্বাভাবিক কি?',
        priority: 10
      });
    }
    if (mother.sleepPattern.avgHours && mother.sleepPattern.avgHours < 4) {
      questions.push({
        text: 'ঘুম খুব কম হচ্ছে, কি করব?',
        priority: 7
      });
    }
    if (mother.concerns.includes('milk')) {
      questions.push({
        text: 'দুধ বাড়ানোর উপায় কি?',
        priority: 6
      });
    }
  }

  // Growth
  if (growth.hasMeasurements && growth.isGoodVelocity === false) {
    questions.push({
      text: `${baby.name} এর ওজন কম বাড়ছে, চিন্তার কি?`,
      priority: 8
    });
  }

  // Sort by priority (highest first) and return top 4
  return questions
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 4)
    .map(q => q.text);
}

// ============================================================
// MOTHER FLAGS (Urgent Attention Indicators)
// ============================================================

function buildMotherFlags(todayLog, moodPattern, sleepPattern, supportPattern, epds) {
  const flags = [];

  if (todayLog?.bleeding === 'heavy') {
    flags.push('heavy_bleeding');
  }
  if (todayLog?.pain === 'high') {
    flags.push('severe_pain');
  }
  if (todayLog?.csectionHealing === 'worsening') {
    flags.push('csection_worsening');
  }
  if (moodPattern.consecutiveSadDays >= CONFIG.depressionAlertDays) {
    flags.push('prolonged_sadness');
  }
  if (sleepPattern.avgHours && sleepPattern.avgHours < 3) {
    flags.push('critical_sleep_deprivation');
  }
  if (supportPattern.consecutiveNoHelpDays >= CONFIG.noSupportAlertDays) {
    flags.push('no_support');
  }
  if (epds && epds.score >= 13) {
    flags.push('high_epds_score');
  }
  if (epds && epds.q10Concern) {
    flags.push('self_harm_concern');
  }

  return flags;
}

// ============================================================
// PATTERN ANALYSIS HELPERS
// ============================================================

function analyzeMoodPattern(history) {
  if (!history || history.length === 0) {
    return { consecutiveSadDays: 0, dominantMood: null, trend: 'unknown' };
  }

  const recent = history.slice(0, 7);
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

  const dominantMood = Object.entries(moodCounts)
    .sort((a, b) => b[1] - a[1])[0];

  return {
    consecutiveSadDays: consecutiveSad,
    dominantMood: dominantMood[1] > 0 ? dominantMood[0] : null,
    totalDaysTracked: recent.length,
    sadDayCount: moodCounts.sad + moodCounts.bad,
    trend: consecutiveSad >= 3 ? 'concerning' : (moodCounts.happy > moodCounts.sad + moodCounts.bad) ? 'positive' : 'mixed'
  };
}

function analyzeSleepPattern(history) {
  if (!history || history.length === 0) {
    return { avgHours: null, trend: 'unknown' };
  }

  const sleepMap = { '1-2': 1.5, '3-4': 3.5, '5-6': 5.5, '7+': 7.5 };
  const recent = history.slice(0, 7).filter(l => l.sleepHours);

  if (recent.length === 0) return { avgHours: null, trend: 'unknown' };

  const totalHours = recent.reduce((sum, l) => sum + (sleepMap[l.sleepHours] || 0), 0);
  const avgHours = Math.round((totalHours / recent.length) * 10) / 10;

  return {
    avgHours,
    daysTracked: recent.length,
    trend: avgHours < 3 ? 'critical' : avgHours < 5 ? 'low' : 'adequate'
  };
}

function analyzeSupportPattern(history) {
  if (!history || history.length === 0) {
    return { consecutiveNoHelpDays: 0, helpRate: null };
  }

  const recent = history.slice(0, 7).filter(l => l.hadHelp !== undefined && l.hadHelp !== null);
  if (recent.length === 0) return { consecutiveNoHelpDays: 0, helpRate: null };

  let consecutiveNoHelp = 0;
  let currentStreak = 0;
  const helpedDays = recent.filter(l => l.hadHelp === true).length;

  for (const log of recent) {
    if (log.hadHelp === false) {
      currentStreak++;
      consecutiveNoHelp = Math.max(consecutiveNoHelp, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  return {
    consecutiveNoHelpDays: consecutiveNoHelp,
    helpRate: Math.round((helpedDays / recent.length) * 100)
  };
}

function analyzeFeedPattern(feedLogs) {
  if (!feedLogs || feedLogs.length === 0) {
    return { trend: 'unknown', avgDaily: 0 };
  }

  const last7Days = getLast7DaysCount(feedLogs);
  if (last7Days.length < 3) return { trend: 'unknown', avgDaily: 0 };

  const avgDaily = Math.round(last7Days.reduce((a, b) => a + b, 0) / last7Days.length);
  const recentHalf = last7Days.slice(0, Math.ceil(last7Days.length / 2));
  const olderHalf = last7Days.slice(Math.ceil(last7Days.length / 2));
  const recentAvg = recentHalf.reduce((a, b) => a + b, 0) / recentHalf.length;
  const olderAvg = olderHalf.reduce((a, b) => a + b, 0) / olderHalf.length;

  const trend = recentAvg > olderAvg + 1 ? 'increasing' :
                recentAvg < olderAvg - 1 ? 'decreasing' : 'stable';

  return { trend, avgDaily };
}

function analyzeBabySleepPattern(sleepLogs) {
  if (!sleepLogs || sleepLogs.length === 0) {
    return { trend: 'unknown', avgDaily: 0 };
  }

  const last7Days = getLast7DaysCount(sleepLogs);
  if (last7Days.length < 3) return { trend: 'unknown', avgDaily: 0 };

  const avgDaily = Math.round(last7Days.reduce((a, b) => a + b, 0) / last7Days.length);
  return { trend: 'stable', avgDaily };
}

// ============================================================
// UTILITY HELPERS
// ============================================================

function getLastEntryTime(logArray) {
  if (!logArray || logArray.length === 0) return null;
  const today = new Date().toDateString();
  const todayEntries = logArray.filter(l => new Date(l.timestamp).toDateString() === today);
  if (todayEntries.length === 0) return null;
  return todayEntries[0].timestamp; // Most recent (logs are prepended)
}

function getTodayEntries(logArray) {
  if (!logArray) return [];
  const today = new Date().toDateString();
  return logArray.filter(l => new Date(l.timestamp).toDateString() === today);
}

function minutesAgo(timestamp) {
  return Math.floor((Date.now() - new Date(timestamp).getTime()) / (1000 * 60));
}

function countForDate(logArray, daysOffset) {
  if (!logArray) return 0;
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  const dateStr = date.toDateString();
  return logArray.filter(l => new Date(l.timestamp).toDateString() === dateStr).length;
}

function getLast7DaysCount(logArray) {
  const counts = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toDateString();
    const count = logArray.filter(l => new Date(l.timestamp).toDateString() === dateStr).length;
    counts.push(count);
  }
  return counts;
}

function getConsecutiveSadDays(history) {
  if (!history || history.length === 0) return 0;
  let count = 0;
  for (const log of history) {
    if (log.mood === 'sad' || log.mood === 'bad') {
      count++;
    } else {
      break;
    }
  }
  return count;
}

function getConsecutiveNoHelpDays(history) {
  if (!history || history.length === 0) return 0;
  let count = 0;
  for (const log of history) {
    if (log.hadHelp === false) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

function getAvgMotherSleep(history) {
  const sleepMap = { '1-2': 1.5, '3-4': 3.5, '5-6': 5.5, '7+': 7.5 };
  if (!history || history.length === 0) return null;
  const recent = history.slice(0, 7).filter(l => l.sleepHours);
  if (recent.length === 0) return null;
  const total = recent.reduce((sum, l) => sum + (sleepMap[l.sleepHours] || 0), 0);
  return Math.round((total / recent.length) * 10) / 10;
}

function getExpectedFeeds(ageMonths) {
  if (ageMonths < 1) return '৮-১২ বার/দিন';
  if (ageMonths < 3) return '৮-১২ বার/দিন';
  if (ageMonths < 6) return '৬-৮ বার/দিন';
  if (ageMonths < 12) return '৪-৬ বার/দিন + শক্ত খাবার';
  return '৩-৪ বার দুধ + ৩ বেলা খাবার';
}

function getExpectedSleep(ageMonths) {
  if (ageMonths < 3) return '১৪-১৭ ঘন্টা';
  if (ageMonths < 6) return '১২-১৫ ঘন্টা';
  if (ageMonths < 12) return '১২-১৪ ঘন্টা';
  return '১১-১৪ ঘন্টা';
}

async function loadFromStorage(key, defaultValue) {
  try {
    const saved = await AsyncStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultValue;
  } catch {
    return defaultValue;
  }
}

async function loadEPDSHistory() {
  try {
    const saved = await AsyncStorage.getItem('epds_history');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function getEmptyContext(baby = null) {
  return {
    baby: baby ? {
      name: baby.name,
      gender: baby.gender,
      birthDate: baby.birth_date,
      bengaliAge: 'অজানা',
      ageDays: 0, ageMonths: 0, ageWeeks: 0,
      today: { feed: 0, sleep: 0, diaper: 0, food: 0 },
      lastFeedMinutesAgo: null, lastSleepMinutesAgo: null,
      breastCountToday: 0, bottleCountToday: 0,
      expectedFeeds: '', expectedSleepHours: '',
      solidFoodReady: false
    } : null,
    mother: null,
    vaccine: { completedCount: 0, totalCount: 14, upcoming: [], overdue: [], recentlyCompleted: [], hasPostVaccineCare: false },
    growth: { hasMeasurements: false },
    patterns: { baby: { feedTrend: 'unknown', avgDailyFeeds: 0, sleepTrend: 'unknown', avgDailySleeps: 0 }, mother: { consecutiveSadDays: 0, consecutiveNoHelpDays: 0, avgSleepHours: null } },
    suggestedQuestions: [],
    timestamp: new Date().toISOString()
  };
}

// ============================================================
// LEGACY SUPPORT — old buildBabyContext still works
// ============================================================

/**
 * @deprecated Use buildFullContext instead
 */
export async function buildBabyContext(baby) {
  const ctx = await buildFullContext({ baby });
  return {
    babyName: ctx.baby?.name || 'শিশু',
    babyAge: ctx.baby?.bengaliAge || 'নতুন',
    ageDays: ctx.baby?.ageDays || 0,
    ageMonths: ctx.baby?.ageMonths || 0,
    recentLogs: ctx.baby?.today || {},
    upcomingVaccines: (ctx.vaccine?.upcoming || []).map(v => v.name),
    recentVaccines: (ctx.vaccine?.recentlyCompleted || []).map(v => v.name),
    latestGrowth: ctx.growth?.latest || null,
    allLogs: null,
    allVaccines: null,
    allGrowth: null
  };
}