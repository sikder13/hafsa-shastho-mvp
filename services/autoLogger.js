// services/autoLogger.js
// Detects activities mentioned in conversation and auto-logs them
// KEY FIX: Distinguishes questions/queries from action statements
// "দুধ খাওয়ালাম" (I fed) → LOG
// "কয়বার দুধ খেয়েছে?" (How many times fed?) → DO NOT LOG

import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// QUESTION DETECTION — Must check BEFORE activity detection
// ============================================================

const QUESTION_INDICATORS = [
  // Bengali question words
  'কয়বার', 'কতবার', 'কত বার', 'কখন', 'কেন', 'কি ', 'কী ',
  'কিভাবে', 'কীভাবে', 'কোথায়', 'কার', 'কাকে', 'কোন',
  'কতক্ষণ', 'কত দিন', 'কতদিন',
  // Question markers
  '?', '؟',
  // Common question patterns
  'কি করব', 'কী করব', 'কি করা', 'কী করা',
  'ঠিক আছে কি', 'ঠিক আছে কী', 'ঠিক কি',
  'স্বাভাবিক কি', 'স্বাভাবিক কী', 'নরমাল কি', 'নরমাল কী',
  'কেমন ', 'কেমনে',
  'দরকার কি', 'দরকার কী', 'লাগবে কি', 'লাগবে কী',
  'উচিত কি', 'উচিত কী',
  'পারি কি', 'পারি কী', 'পারব কি', 'পারব কী',
  'হবে কি', 'হবে কী',
  'করব কি', 'করব কী',
  'দেব কি', 'দেব কী', 'দিব কি', 'দিব কী',
  'খাওয়াব কি', 'খাওয়াব কী',
  'শুরু করব', 'শুরু করি',
  'কতটুকু', 'কত টুকু',
  // Should/need patterns (asking for advice, not stating action)
  'উচিত', 'দরকার', 'লাগবে', 'প্রয়োজন',
  'ভালো হবে', 'ভালো হয়',
  'পরামর্শ', 'সাজেশন'
];

/**
 * Check if a message is a question or request for information
 * @param {string} text - User's message
 * @returns {boolean} True if this is a question (should NOT auto-log)
 */
function isQuestion(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase().trim();

  // Check for question indicators
  return QUESTION_INDICATORS.some(indicator =>
    lower.includes(indicator.toLowerCase())
  );
}

// ============================================================
// MAIN AUTO-LOG FUNCTION
// ============================================================

/**
 * Process a user message and auto-log detected activities
 * @param {string} messageText - User's message
 * @param {string} babyId - Baby's ID for storage
 * @returns {Promise<Object>} - {logged, activities, error?}
 */
export async function processAutoLog(messageText, babyId, currentLogs) {
  try {
    // CRITICAL: If this is a question, DO NOT auto-log
    if (isQuestion(messageText)) {
      console.log('🔍 Question detected, skipping auto-log:', messageText.substring(0, 50));
      return { logged: false, activities: [] };
    }

    const detectedActivities = detectActivities(messageText);

    if (detectedActivities.length === 0) {
      return { logged: false, activities: [] };
    }

    // Use current logs from AppContext if available, otherwise load from storage
    const logs = currentLogs || await loadLogs(babyId);
    const updatedLogs = {
      feed: [...(logs.feed || [])],
      sleep: [...(logs.sleep || [])],
      diaper: [...(logs.diaper || [])],
      food: [...(logs.food || [])],
    };
    const loggedActivities = [];

    for (const activity of detectedActivities) {
      const newLog = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        type: activity.type,
        source: 'auto_chat',
        autoLogged: true,
        details: null
      };

      updatedLogs[activity.type] = [newLog, ...(updatedLogs[activity.type] || [])];
      loggedActivities.push(activity);
    }

    await AsyncStorage.setItem(`daily_logs_${babyId}`, JSON.stringify(updatedLogs));
    console.log('✅ Auto-logged:', loggedActivities.map(a => a.type).join(', '));
    return {
      logged: true,
      activities: loggedActivities,
      updatedLogs: updatedLogs
    };

  } catch (error) {
    console.error('❌ Auto-log error:', error);
    return {
      logged: false,
      activities: [],
      error: error.message
    };
  }
}

// ============================================================
// ACTIVITY DETECTION — Only for action statements
// ============================================================

/**
 * Detect activities in text (only action statements, not questions)
 * @param {string} text - Text to analyze
 * @returns {Array} - Array of {type, confidence}
 */
function detectActivities(text) {
  const activities = [];

  if (!text || typeof text !== 'string') return activities;

  const lowerText = text.toLowerCase().trim();

  // FOOD FIRST (check before feed to avoid conflicts)
  const foundFood = FOOD_PATTERNS.some(p => lowerText.includes(p.toLowerCase()));

  if (foundFood) {
    activities.push({ type: 'food', confidence: 'high' });
    return activities; // Don't also log as feed
  }

  // FEED (only if food NOT detected)
  if (FEED_PATTERNS.some(p => lowerText.includes(p.toLowerCase()))) {
    activities.push({ type: 'feed', confidence: 'high' });
  }

  // SLEEP
  if (SLEEP_PATTERNS.some(p => lowerText.includes(p.toLowerCase()))) {
    activities.push({ type: 'sleep', confidence: 'high' });
  }

  // DIAPER
  if (DIAPER_PATTERNS.some(p => lowerText.includes(p.toLowerCase()))) {
    activities.push({ type: 'diaper', confidence: 'high' });
  }

  return activities;
}

// ============================================================
// DETECTION PATTERNS — Action statements only
// These patterns indicate the user DID something (past tense, active)
// NOT questions, NOT future tense, NOT third-party references
// ============================================================

const FOOD_PATTERNS = [
  // Compound food phrases
  'দাল ভাত খাওয়াইছি', 'দাল ভাত খাইয়েছি', 'দাল ভাত খাওয়ালাম',
  'দাল ভাত দিয়েছি', 'দাল ভাত দিলাম',
  'খিচুড়ি খাইয়েছি', 'খিচুড়ি খাওয়ালাম', 'খিচুড়ি দিয়েছি', 'খিচুড়ি দিলাম',
  'ভাত খাওয়াইছি', 'ভাত খাওয়ালাম', 'ভাত খাইয়েছি', 'ভাত দিয়েছি', 'ভাত দিলাম',
  'ডিম খাওয়ালাম', 'ডিম খাইয়েছি', 'ডিম দিয়েছি', 'ডিম দিলাম',
  'কলা খাওয়ালাম', 'কলা খাইয়েছি', 'কলা দিয়েছি', 'কলা দিলাম',
  'সবজি খাওয়ালাম', 'সবজি খাইয়েছি', 'সবজি দিয়েছি',
  'মাছ খাওয়ালাম', 'মাছ দিয়েছি',
  'মুরগি খাওয়ালাম', 'মুরগি দিয়েছি',
  // General food
  'খাবার খাওয়াইছি', 'খাবার খাইয়েছি', 'খাবার খাওয়ালাম', 'খাবার দিয়েছি', 'খাবার দিলাম',
  'সলিড খাওয়ালাম', 'সলিড দিয়েছি',
  'ফল দিয়েছি', 'ফল খাওয়ালাম'
];

const FEED_PATTERNS = [
  // Active feeding statements (past tense — "I fed")
  'দুধ খাওয়ালাম', 'দুধ খাওয়াইলাম', 'দুধ খাইয়েছি', 'দুধ খাওয়াইছি',
  'দুধ দিয়েছি', 'দুধ দিলাম', 'দুধ দিছি',
  'ফিড করেছি', 'ফিড দিয়েছি', 'ফিড দিলাম',
  'ব্রেস্টফিড', 'স্তন্যপান করালাম', 'স্তন্যপান করাইলাম',
  'বুকের দুধ দিয়েছি', 'বুকের দুধ দিলাম',
  'ফর্মুলা দিয়েছি', 'ফর্মুলা দিলাম',
  'বোতলে দুধ দিলাম', 'বোতল দিয়েছি', 'বোতল দিলাম',
  // "Just fed" patterns
  'এইমাত্র দুধ', 'এইমাত্রই দুধ', 'এখনই দুধ'
];

const SLEEP_PATTERNS = [
  // Active sleep statements ("baby is sleeping" / "I put baby to sleep")
  'ঘুমাচ্ছে', 'ঘুমিয়েছে', 'ঘুমাইছে', 'ঘুমিয়ে গেছে',
  'ঘুমায় গেছে', 'ঘুমাইয়া গেছে',
  'ঘুম দিয়েছি', 'ঘুম দিলাম',
  'শুইয়ে দিয়েছি', 'শুইয়ে দিলাম',
  'ঘুমাতে দিয়েছি', 'ঘুমাইয়ে দিয়েছি',
  'ঘুমিয়ে পড়েছে', 'ঘুমায় পড়ছে'
];

const DIAPER_PATTERNS = [
  // Active diaper change statements
  'ডায়াপার বদলালাম', 'ডায়াপার বদলাইলাম', 'ডায়াপার বদলেছি', 'ডায়াপার বদলাইছি',
  'ডায়াপার চেঞ্জ করলাম', 'ডায়াপার চেঞ্জ করেছি',
  'পায়খানা করেছে', 'পায়খানা হয়েছে',
  'প্রস্রাব করেছে', 'প্রস্রাব হয়েছে',
  'পটি করেছে', 'পটি হয়েছে',
  'সু সু করেছে', 'পু পু করেছে',
  'ডায়াপার ভিজে গেছে', 'ডায়াপার নোংরা'
];

// ============================================================
// HELPERS
// ============================================================

async function loadLogs(babyId) {
  try {
    const saved = await AsyncStorage.getItem(`daily_logs_${babyId}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        feed: parsed.feed || [],
        sleep: parsed.sleep || [],
        diaper: parsed.diaper || [],
        food: parsed.food || []
      };
    }
  } catch (error) {
    console.error('Error loading logs:', error);
  }
  return { feed: [], sleep: [], diaper: [], food: [] };
}

/**
 * Get Bengali activity name
 */
export function getActivityNameBengali(type) {
  const names = {
    feed: 'দুধ খাওয়ানো',
    sleep: 'ঘুম',
    diaper: 'ডায়াপার বদলানো',
    food: 'খাবার খাওয়ানো'
  };
  return names[type] || type;
}

/**
 * Format auto-log confirmation message
 */
export function formatAutoLogConfirmation(activities) {
  if (!activities || activities.length === 0) return '';
  const activityNames = activities.map(a => getActivityNameBengali(a.type)).join(', ');
  return `✓ ${activityNames} লগ করে রাখলাম`;
}