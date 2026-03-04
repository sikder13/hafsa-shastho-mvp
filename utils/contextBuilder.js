// utils/contextBuilder.js
// Gathers baby data and formats it for Hafsa's system prompt

import AsyncStorage from '@react-native-async-storage/async-storage';
import { calculateAge, countToday, safeJSONParse } from './helpers';
import { STORAGE_KEYS } from './constants';

/**
 * Build complete context about baby for Hafsa
 * @param {Object} baby - Baby profile {id, name, birth_date}
 * @returns {Promise<Object>} - Formatted context
 */
export async function buildBabyContext(baby) {
  try {
    // Load all data sources
    const [logs, vaccines, growth] = await Promise.all([
      loadDailyLogs(baby.id),
      loadVaccineStatus(baby.id),
      loadGrowthMeasurements(baby.id)
    ]);

    // Calculate baby's age using shared helper
    const ageInfo = calculateAge(baby.birth_date);

    // Get today's activity counts
    const todayLogs = {
      feed: countToday(logs.feed),
      sleep: countToday(logs.sleep),
      diaper: countToday(logs.diaper),
      food: countToday(logs.food)
    };

    // Get recent and upcoming vaccines
    const vaccineInfo = analyzeVaccines(vaccines, ageInfo.ageDays);

    // Get latest growth data
    const latestGrowth = growth && growth.length > 0 ? growth[0] : null;

    // Build context object
    return {
      // Baby basics
      babyName: baby.name,
      babyAge: ageInfo.bengaliAge,
      ageDays: ageInfo.ageDays,
      ageMonths: ageInfo.ageMonths,

      // Recent logs
      recentLogs: {
        feed: todayLogs.feed,
        sleep: todayLogs.sleep,
        diaper: todayLogs.diaper,
        food: todayLogs.food
      },

      // Vaccine context
      upcomingVaccines: vaccineInfo.upcoming,
      recentVaccines: vaccineInfo.recent,

      // Growth data
      latestGrowth: latestGrowth ? {
        weight: latestGrowth.weight,
        height: latestGrowth.height,
        date: latestGrowth.date
      } : null,

      // Full data for advanced queries
      allLogs: logs,
      allVaccines: vaccines,
      allGrowth: growth
    };

  } catch (error) {
    console.error('Error building context:', error);
    
    // Return minimal context on error
    return {
      babyName: baby.name,
      babyAge: 'অজানা',
      recentLogs: {},
      upcomingVaccines: [],
      recentVaccines: []
    };
  }
}

/**
 * Load daily logs from storage
 */
async function loadDailyLogs(babyId) {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEYS.dailyLogs(babyId));
    return safeJSONParse(saved, { feed: [], sleep: [], diaper: [], food: [] });
  } catch (error) {
    console.error('Error loading logs:', error);
    return { feed: [], sleep: [], diaper: [], food: [] };
  }
}

/**
 * Load vaccine status from storage
 */
async function loadVaccineStatus(babyId) {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEYS.vaccineStatus(babyId));
    return safeJSONParse(saved, {});
  } catch (error) {
    console.error('Error loading vaccines:', error);
    return {};
  }
}

/**
 * Load growth measurements from storage
 */
async function loadGrowthMeasurements(babyId) {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEYS.growthMeasurements(babyId));
    return safeJSONParse(saved, []);
  } catch (error) {
    console.error('Error loading growth:', error);
    return [];
  }
}

/**
 * Analyze vaccine status
 */
function analyzeVaccines(vaccineStatus, babyAgeDays) {
  const vaccines = [
    { id: 'bcg', name: 'BCG', nameBangla: 'বিসিজি', ageDays: 0 },
    { id: 'polio0', name: 'Polio-0', nameBangla: 'পোলিও-০', ageDays: 0 },
    { id: 'penta1', name: 'Penta-1', nameBangla: 'পেন্টা-১', ageDays: 42 },
    { id: 'polio1', name: 'Polio-1', nameBangla: 'পোলিও-১', ageDays: 42 },
    { id: 'penta2', name: 'Penta-2', nameBangla: 'পেন্টা-২', ageDays: 70 },
    { id: 'polio2', name: 'Polio-2', nameBangla: 'পোলিও-২', ageDays: 70 },
    { id: 'penta3', name: 'Penta-3', nameBangla: 'পেন্টা-৩', ageDays: 98 },
    { id: 'polio3', name: 'Polio-3', nameBangla: 'পোলিও-৩', ageDays: 98 },
    { id: 'pcv1', name: 'PCV-1', nameBangla: 'পিসিভি-১', ageDays: 42 },
    { id: 'pcv2', name: 'PCV-2', nameBangla: 'পিসিভি-২', ageDays: 70 },
    { id: 'pcv3', name: 'PCV-3', nameBangla: 'পিসিভি-৩', ageDays: 98 },
    { id: 'mr', name: 'MR', nameBangla: 'এমআর', ageDays: 270 }
  ];

  const upcoming = [];
  const recent = [];

  vaccines.forEach(vaccine => {
    const status = vaccineStatus[vaccine.id];
    
    if (status?.completed) {
      const completedDate = new Date(status.completedDate);
      const daysAgo = (Date.now() - completedDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysAgo <= 3) {
        recent.push(vaccine.nameBangla);
      }
    }
    
    if (!status?.completed) {
      const daysUntil = vaccine.ageDays - babyAgeDays;
      
      if (daysUntil >= 0 && daysUntil <= 7) {
        upcoming.push(vaccine.nameBangla);
      }
    }
  });

  return { upcoming, recent };
}

/**
 * Get summary text for debugging
 */
export function getContextSummary(context) {
  return `
Baby: ${context.babyName} (${context.babyAge})
Today: Feed ${context.recentLogs.feed}, Sleep ${context.recentLogs.sleep}, Diaper ${context.recentLogs.diaper}
Upcoming vaccines: ${context.upcomingVaccines.join(', ') || 'None'}
Recent vaccines: ${context.recentVaccines.join(', ') || 'None'}
  `.trim();
}