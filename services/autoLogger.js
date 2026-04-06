/**
 * Hafsa Sastho (হাফসা স্বাস্থ্য)
 * Bangladesh's First AI Companion for Postpartum and Early Childhood Care
 * Copyright © 2026 Nahl Technologies Inc. All rights reserved.
 *
 * @author Udaay Sikder — Co-Founder & Dev
 */
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
export async function processAutoLog(messageText, babyId, currentLogs, babyAgeDays) {
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

    // Filter out food logs if baby is too young for solid food (under 150 days / ~5 months)
    const filteredActivities = detectedActivities.filter(activity => {
      if (activity.type === 'food' && babyAgeDays && babyAgeDays < 150) {
        console.log('🚫 Food log skipped — baby is only', babyAgeDays, 'days old (need 150+)');
        return false;
      }
      return true;
    });

    if (filteredActivities.length === 0) {
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

    for (const activity of filteredActivities) {
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

  // ============================================================
  // GLOBAL EXCLUSIONS — if ANY of these match, do NOT auto-log
  // Prevents false positives from questions, future tense, shopping
  // ============================================================
  const EXCLUSIONS = [
    // Questions (already handled by isQuestion, but double safety)
    '?', 'কি?', 'কী?', 'কেন?', 'কত?', 'কখন?', 'কিভাবে?',
    // Future tense / planning
    'খাওয়াব', 'দিব', 'দিবো', 'করব', 'করবো', 'দেব', 'দেবো',
    'খাওয়াতে হবে', 'দিতে হবে', 'করতে হবে',
    // Shopping / buying
    'কিনতে', 'কিনব', 'কিনলাম', 'কিনেছি', 'দরকার', 'লাগবে',
    'আনতে', 'আনব', 'আনলাম',
    // Asking about / discussing (not doing)
    'কয়বার', 'কতবার', 'কতক্ষণ', 'কখন খাওয়াব', 'কি খাওয়াব',
    'উচিত', 'পারি', 'যায়', 'ভালো হবে',
  ];

  if (EXCLUSIONS.some(ex => lowerText.includes(ex))) {
    return activities;
  }

  // ============================================================
  // TIER 1: Exact phrase match (highest confidence)
  // ============================================================

  // FOOD FIRST (check before feed to avoid conflicts)
  const foundFoodT1 = FOOD_PATTERNS.some(p => lowerText.includes(p.toLowerCase()));
  if (foundFoodT1) {
    activities.push({ type: 'food', confidence: 'high' });
    return activities;
  }

  // FEED
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

  // If Tier 1 found something, return
  if (activities.length > 0) return activities;

  // ============================================================
  // TIER 2: Root word + action verb matching (fallback)
  // Only runs if Tier 1 found nothing
  // Requires: subject keyword + action verb stem
  // ============================================================

  // Action verb stems — indicates something HAPPENED (past/present, not future)
  const ACTION_VERBS = [
    'খেল', 'খেয়েছে', 'খাইছে', 'খাইলো', 'খাইসে', 'খাচ্ছে',
    'খেয়ে', 'খায়ছে', 'খালো', 'খাইয়া',
    'করেছে', 'করছে', 'করসে', 'করলো', 'করল', 'কইরছে', 'কইরসে',
    'হয়েছে', 'হইছে', 'হচ্ছে', 'হইসে', 'হলো', 'হল',
    'দিলাম', 'দিয়েছি', 'দিছি', 'দিসি', 'দিয়াইছি', 'দিলাইছি',
    'খাওয়ালাম', 'খাওয়াইলাম', 'খাওয়াইছি', 'খাওয়াইসি',
    'খালাম', 'খাইয়েছি', 'খাওয়াচ্ছি',
    'বদলালাম', 'বদলাইলাম', 'বদলাইছি', 'বদলাইসি', 'পাল্টালাম', 'পাল্টাইছি',
    'পড়েছে', 'পড়ছে', 'পড়লো', 'পড়সে',
    'গেছে', 'গেল', 'গেসে', 'যাচ্ছে',
    'শুইছে', 'শুইসে', 'শুইয়েছে',
  ];

  const hasAction = ACTION_VERBS.some(v => lowerText.includes(v));
  if (!hasAction) return activities;

  // --- FOOD (Tier 2) --- check before feed
  const FOOD_ROOTS = [
    'ভাত', 'দাল', 'ডাল', 'খিচুড়ি', 'খিচুরি', 'ডিম', 'কলা', 'আপেল', 'আম',
    'সবজি', 'মাছ', 'মুরগি', 'সুজি', 'সেরেলাক', 'নুডলস', 'পাউরুটি', 'দই',
    'ফল', 'পেপে', 'পেয়ারা', 'খাবার', 'সলিড', 'solid', 'food',
  ];

  if (FOOD_ROOTS.some(root => lowerText.includes(root))) {
    activities.push({ type: 'food', confidence: 'medium' });
    return activities;
  }

  // --- FEED (Tier 2) ---
  const FEED_ROOTS = ['দুধ', 'milk', 'ফিড', 'feed', 'বুকের', 'ব্রেস্ট', 'ফর্মুলা', 'বোতল'];

  if (FEED_ROOTS.some(root => lowerText.includes(root))) {
    activities.push({ type: 'feed', confidence: 'medium' });
  }

  // --- SLEEP (Tier 2) ---
  const SLEEP_ROOTS = ['ঘুম', 'ঘুমা', 'শুই', 'শোয়া', 'নিদ্রা', 'sleep', 'নিন্দা'];

  if (SLEEP_ROOTS.some(root => lowerText.includes(root))) {
    // Extra check: "ঘুম হয়নি" or "ঘুম হচ্ছে না" = NOT sleeping
    const negatives = ['হয়নি', 'হচ্ছে না', 'হয় না', 'পারছে না', 'পারছি না', 'নাই', 'পায় না'];
    if (!negatives.some(neg => lowerText.includes(neg))) {
      activities.push({ type: 'sleep', confidence: 'medium' });
    }
  }

  // --- DIAPER (Tier 2) ---
  const DIAPER_ROOTS = [
    'ডায়াপার', 'diaper', 'পটি', 'পায়খানা', 'প্রস্রাব',
    'সু সু', 'পু পু', 'হিসু', 'পেচ্ছাপ', 'পেচ্ছাব',
    'ন্যাপি', 'nappy',
  ];

  if (DIAPER_ROOTS.some(root => lowerText.includes(root))) {
    activities.push({ type: 'diaper', confidence: 'medium' });
  }

  return activities;
}

// ============================================================
// DETECTION PATTERNS — Action statements only
// These patterns indicate the user DID something (past tense, active)
// NOT questions, NOT future tense, NOT third-party references
// ============================================================

const FOOD_PATTERNS = [
  // === Compound food: dal bhat ===
  'দাল ভাত খাওয়াইছি', 'দাল ভাত খাইয়েছি', 'দাল ভাত খাওয়ালাম',
  'দাল ভাত দিয়েছি', 'দাল ভাত দিলাম', 'দাল ভাত দিছি',
  'দাল ভাত খেল', 'দাল ভাত খাইছে', 'দাল ভাত খেয়েছে',
  'ডাল ভাত খাওয়ালাম', 'ডাল ভাত দিলাম', 'ডাল ভাত খেল',

  // === Khichuri ===
  'খিচুড়ি খাইয়েছি', 'খিচুড়ি খাওয়ালাম', 'খিচুড়ি দিয়েছি', 'খিচুড়ি দিলাম',
  'খিচুড়ি খেল', 'খিচুড়ি খাইছে', 'খিচুড়ি খেয়েছে', 'খিচুড়ি দিছি',
  'খিচুরি খাওয়ালাম', 'খিচুরি দিলাম', 'খিচুরি খেল',

  // === Rice ===
  'ভাত খাওয়াইছি', 'ভাত খাওয়ালাম', 'ভাত খাইয়েছি', 'ভাত দিয়েছি', 'ভাত দিলাম',
  'ভাত খেল', 'ভাত খাইছে', 'ভাত খেয়েছে', 'ভাত দিছি',

  // === Egg ===
  'ডিম খাওয়ালাম', 'ডিম খাইয়েছি', 'ডিম দিয়েছি', 'ডিম দিলাম',
  'ডিম খেল', 'ডিম খাইছে', 'ডিম খেয়েছে', 'ডিম দিছি',

  // === Banana ===
  'কলা খাওয়ালাম', 'কলা খাইয়েছি', 'কলা দিয়েছি', 'কলা দিলাম',
  'কলা খেল', 'কলা খাইছে', 'কলা খেয়েছে', 'কলা দিছি',

  // === Vegetables ===
  'সবজি খাওয়ালাম', 'সবজি খাইয়েছি', 'সবজি দিয়েছি',
  'সবজি খেল', 'সবজি খাইছে', 'সবজি দিছি',

  // === Fish ===
  'মাছ খাওয়ালাম', 'মাছ দিয়েছি', 'মাছ দিলাম',
  'মাছ খেল', 'মাছ খাইছে', 'মাছ দিছি',

  // === Chicken ===
  'মুরগি খাওয়ালাম', 'মুরগি দিয়েছি', 'মুরগি দিলাম',
  'মুরগি খেল', 'মুরগি খাইছে', 'মুরগি দিছি',

  // === Fruits ===
  'ফল দিয়েছি', 'ফল খাওয়ালাম', 'ফল খেল', 'ফল খাইছে',
  'আপেল দিলাম', 'আপেল খেল', 'আপেল খাইছে',
  'আম দিলাম', 'আম খেল', 'আম খাইছে',
  'পেপে দিলাম', 'পেপে খেল', 'পেয়ারা দিলাম', 'পেয়ারা খেল',

  // === Other common foods ===
  'সুজি খাওয়ালাম', 'সুজি দিলাম', 'সুজি খেল', 'সুজি খাইছে',
  'সেরেলাক দিলাম', 'সেরেলাক খেল', 'সেরেলাক খাইছে', 'সেরেলাক দিছি',
  'নুডলস দিলাম', 'নুডলস খেল', 'পাউরুটি দিলাম', 'পাউরুটি খেল',
  'দই দিলাম', 'দই খেল', 'দই খাইছে',
  'পুডিং দিলাম', 'পুডিং খেল',

  // === General food ===
  'খাবার খাওয়াইছি', 'খাবার খাইয়েছি', 'খাবার খাওয়ালাম', 'খাবার দিয়েছি', 'খাবার দিলাম',
  'খাবার খেল', 'খাবার খাইছে', 'খাবার খেয়েছে', 'খাবার দিছি',
  'সলিড খাওয়ালাম', 'সলিড দিয়েছি', 'সলিড খেল',
  'solid দিলাম', 'solid food দিলাম', 'food দিলাম',

  // === Informal/colloquial ===
  'খাওয়াইছি', 'খাওয়াইলাম', 'খাওয়াইসি', 'খাওয়ালাম ভাত',
  'খেল ভাত', 'খাইছে ভাত', 'খাইলো ভাত',
  'দিয়াইছি খাবার', 'দিছি খাবার', 'খাওয়াই দিছি',
];

const FEED_PATTERNS = [
  // === Mother-subject: "I fed" (standard) ===
  'দুধ খাওয়ালাম', 'দুধ খাওয়াইলাম', 'দুধ খাইয়েছি', 'দুধ খাওয়াইছি',
  'দুধ দিয়েছি', 'দুধ দিলাম', 'দুধ দিছি',

  // === Mother-subject: informal/shortened ===
  'দুধ খালাম', 'দুধ খাওয়াইসি', 'দুধ খাওয়াইছ', 'দুধ খাওলাম',
  'দুধ দিসি', 'দুধ দিছ', 'দুধ খাওয়াচ্ছি', 'দুধ খাওয়াই দিলাম',

  // === Baby-subject: "baby ate/drank" ===
  'দুধ খেল', 'দুধ খেয়েছে', 'দুধ খাইছে', 'দুধ খাইলো', 'দুধ খাইসে',
  'দুধ খেলো', 'দুধ খেয়ে নিল', 'দুধ খেয়ে নিছে', 'দুধ পান করেছে',
  'দুধ খাচ্ছে', 'দুধ খায়', 'খেল দুধ', 'খাইছে দুধ', 'খাইলো দুধ',

  // === Breast milk specific ===
  'বুকের দুধ দিয়েছি', 'বুকের দুধ দিলাম', 'বুকের দুধ খাইছে',
  'বুকের দুধ খেল', 'বুকের দুধ খাওয়ালাম', 'বুক থেকে খাইছে',
  'ব্রেস্টফিড', 'স্তন্যপান করালাম', 'স্তন্যপান করাইলাম',

  // === Bottle/formula ===
  'বোতলে দুধ দিলাম', 'বোতল দিয়েছি', 'বোতল দিলাম',
  'ফর্মুলা দিয়েছি', 'ফর্মুলা দিলাম', 'ফর্মুলা খাইছে',
  'বোতলে খাইছে', 'বোতলে খেল',

  // === English mix (code-switching) ===
  'ফিড করেছি', 'ফিড দিয়েছি', 'ফিড দিলাম', 'ফিড করলাম',
  'feed দিলাম', 'feed দিয়েছি', 'milk দিলাম', 'milk খাইছে',

  // === Ultra-short / colloquial ===
  'এইমাত্র দুধ', 'এইমাত্রই দুধ', 'এখনই দুধ',
  'দুধ খাওয়ানো হইছে', 'দুধ খাওয়ানো হয়েছে', 'দুধ হইছে',
  'খাওয়াইছি', 'খাওয়াইলাম', 'খাইয়েছি',

  // === Chittagong dialect ===
  'দুধ দিয়াইছি', 'দুধ দিয়াছি', 'দুধ খাওয়াইয়া দিছি',

  // === Sylheti dialect ===
  'দুধ দিলাইছি', 'দুধ খাওয়াইলাইছি',

  // === Noakhali/Barishal dialect ===
  'দুধ খাওয়াইচি', 'দুধ দিচি', 'দুধ খাওচি',
];

const SLEEP_PATTERNS = [
  // === Standard: "baby is sleeping" ===
  'ঘুমাচ্ছে', 'ঘুমিয়েছে', 'ঘুমাইছে', 'ঘুমিয়ে গেছে',
  'ঘুমায় গেছে', 'ঘুমাইয়া গেছে', 'ঘুমায়া গেছে',

  // === Mother-subject: "I put baby to sleep" ===
  'ঘুম দিয়েছি', 'ঘুম দিলাম', 'ঘুম দিছি',
  'শুইয়ে দিয়েছি', 'শুইয়ে দিলাম', 'শুইয়া দিছি', 'শুয়াইয়া দিছি',
  'ঘুমাতে দিয়েছি', 'ঘুমাইয়ে দিয়েছি', 'ঘুম পাড়াইছি', 'ঘুম পাড়ালাম',

  // === Baby-subject: "baby fell asleep" ===
  'ঘুমিয়ে পড়েছে', 'ঘুমায় পড়ছে', 'ঘুমাইয়া পড়ছে',
  'ঘুমায় পড়েছে', 'ঘুম পড়ছে', 'ঘুম পড়েছে',

  // === Informal/colloquial ===
  'ঘুমাইছে', 'ঘুমাইসে', 'ঘুমাইলো', 'ঘুমিয়ে গেল',
  'ঘুম গেল', 'ঘুম গেছে', 'ঘুমায়', 'ঘুম পারছে',
  'ঘুম পাড়াইসি', 'ঘুম পাড়াইছ',

  // === Ultra-short ===
  'ঘুমাচ্ছে এখন', 'এখন ঘুমাচ্ছে', 'ঘুম পড়লো', 'ঘুম পরছে',
  'ঘুম পরলো', 'শুয়ে পড়েছে', 'শুয়ে পড়ছে', 'শুইছে', 'শুইসে',

  // === English mix ===
  'sleep করছে', 'sleep হয়ে গেছে', 'sleeping', 'ঘুম পরলাম',
  'নিদ্রা', 'নিদ্রায়', 'ঘুম পাড়িয়ে দিলাম',

  // === Chittagong/Sylheti dialect ===
  'ঘুমাইয়্যা গেছে', 'ঘুমাইগ্যা', 'ঘুমাইগেছে',
  'নিন্দা গেছে', 'শুইয়া গেছে', 'শুইয়া পড়ছে',
];

const DIAPER_PATTERNS = [
  // === Standard: diaper change ===
  'ডায়াপার বদলালাম', 'ডায়াপার বদলাইলাম', 'ডায়াপার বদলেছি', 'ডায়াপার বদলাইছি',
  'ডায়াপার চেঞ্জ করলাম', 'ডায়াপার চেঞ্জ করেছি', 'ডায়াপার চেইঞ্জ করলাম',

  // === Informal diaper ===
  'ডায়াপার বদলাইসি', 'ডায়াপার বদলাইছ', 'ডায়াপার পাল্টালাম', 'ডায়াপার পাল্টাইছি',
  'ডায়াপার দিলাম', 'নতুন ডায়াপার দিলাম', 'ডায়াপার দিছি',
  'ডায়াপার ভিজে গেছে', 'ডায়াপার নোংরা', 'ডায়াপার নষ্ট',
  'ডায়াপার খুললাম', 'ডায়াপার খুলেছি', 'ডায়াপার খুলসি',

  // === Baby-subject: bodily functions ===
  'পায়খানা করেছে', 'পায়খানা হয়েছে', 'পায়খানা করছে', 'পায়খানা হইছে',
  'পায়খানা করসে', 'পায়খানা করলো', 'পায়খানা কইরছে', 'পায়খানা কইরসে',
  'প্রস্রাব করেছে', 'প্রস্রাব হয়েছে', 'প্রস্রাব হইছে', 'প্রস্রাব করসে',
  'পটি করেছে', 'পটি হয়েছে', 'পটি করসে', 'পটি করলো', 'পটি হইছে',

  // === Baby talk / colloquial ===
  'সু সু করেছে', 'পু পু করেছে', 'সু সু হইছে', 'পু পু হইছে',
  'সু সু করসে', 'পু পু করসে', 'সু সু', 'পু পু',
  'হিসু করেছে', 'হিসু হইছে', 'হিসু করসে',
  'পেচ্ছাপ করেছে', 'পেচ্ছাপ হয়েছে', 'পেচ্ছাব করেছে',

  // === English mix ===
  'diaper change করলাম', 'diaper বদলালাম', 'diaper চেঞ্জ',
  'potty করেছে', 'potty হয়েছে',

  // === Cloth nappy (rural) ===
  'কাপড় বদলালাম', 'কাপড় বদলাইছি', 'কাপড় ভিজে গেছে',
  'ন্যাপি বদলালাম', 'ন্যাপি বদলাইছি', 'ন্যাপি চেঞ্জ',

  // === Chittagong/Sylheti dialect ===
  'পায়খানা কইরছে', 'প্রস্রাব কইরছে', 'ডায়াপার বদলাইয়া দিছি',
  'পটি কইরছে', 'হিসু কইরছে',
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