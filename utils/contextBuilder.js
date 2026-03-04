// utils/contextBuilder.js
// Gathers baby data and formats it for Hafsa's system prompt

import AsyncStorage from '@react-native-async-storage/async-storage';

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

    // Calculate baby's age
    const ageInfo = calculateAge(baby.birth_date);

    // Get today's activity counts
    const todayLogs = getTodayActivity(logs);

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
    const saved = await AsyncStorage.getItem(`daily_logs_${babyId}`);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Error loading logs:', error);
  }
  
  return { feed: [], sleep: [], diaper: [], food: [] };
}

/**
 * Load vaccine status from storage
 */
async function loadVaccineStatus(babyId) {
  try {
    const saved = await AsyncStorage.getItem(`vaccine_status_${babyId}`);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Error loading vaccines:', error);
  }
  
  return {};
}

/**
 * Load growth measurements from storage
 */
async function loadGrowthMeasurements(babyId) {
  try {
    const saved = await AsyncStorage.getItem(`growth_measurements_${babyId}`);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Error loading growth:', error);
  }
  
  return [];
}

/**
 * Calculate baby's age in various formats
 */
function calculateAge(birthDate) {
  const birth = new Date(birthDate);
  const today = new Date();
  const diffTime = Math.abs(today - birth);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  const months = Math.floor(diffDays / 30);
  const days = diffDays % 30;
  
  let bengaliAge;
  if (months === 0) {
    bengaliAge = `${toBengaliNumber(diffDays)} দিন`;
  } else if (months < 12) {
    bengaliAge = `${toBengaliNumber(months)} মাস ${toBengaliNumber(days)} দিন`;
  } else {
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    bengaliAge = `${toBengaliNumber(years)} বছর ${toBengaliNumber(remainingMonths)} মাস`;
  }
  
  return {
    ageDays: diffDays,
    ageMonths: months,
    bengaliAge
  };
}

/**
 * Get today's activity counts
 */
function getTodayActivity(logs) {
  const today = new Date().toDateString();
  
  return {
    feed: countToday(logs.feed, today),
    sleep: countToday(logs.sleep, today),
    diaper: countToday(logs.diaper, today),
    food: countToday(logs.food, today)
  };
}

function countToday(logArray, today) {
  if (!logArray || logArray.length === 0) return 0;
  
  return logArray.filter(log => {
    return new Date(log.timestamp).toDateString() === today;
  }).length;
}

/**
 * Analyze vaccine status
 */
function analyzeVaccines(vaccineStatus, babyAgeDays) {
  // Bangladesh EPI schedule (simplified - full version in VaccineScreen)
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
    
    // Check if completed recently (last 3 days)
    if (status?.completed) {
      const completedDate = new Date(status.completedDate);
      const daysAgo = (Date.now() - completedDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysAgo <= 3) {
        recent.push(vaccine.nameBangla);
      }
    }
    
    // Check if due soon (next 7 days) and not completed
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
 * Convert number to Bengali
 */
function toBengaliNumber(num) {
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).split('').map(d => bengaliDigits[parseInt(d)] || d).join('');
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
