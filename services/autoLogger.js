// services/autoLogger.js
// Detects activities mentioned in conversation and auto-logs them

import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Process Claude's response and auto-log any detected activities
 * @param {string} responseText - Claude's response message
 * @param {string} babyId - Baby's ID for storage
 * @returns {Promise<Object>} - {logged: boolean, activities: Array, error?: string}
 */
export async function processAutoLog(responseText, babyId) {
  try {
    // Detect activities in the response
    const detectedActivities = detectActivities(responseText);
    
    if (detectedActivities.length === 0) {
      return { logged: false, activities: [] };
    }
    
    // Load existing logs
    const logs = await loadLogs(babyId);
    
    // Add new logs
    const updatedLogs = { ...logs };
    const loggedActivities = [];
    
    for (const activity of detectedActivities) {
      const newLog = {
        id: Date.now() + Math.random(), // Ensure unique ID
        timestamp: new Date().toISOString(),
        type: activity.type,
        autoLogged: true // Mark as auto-logged
      };
      
      updatedLogs[activity.type] = [newLog, ...updatedLogs[activity.type]];
      loggedActivities.push(activity);
    }
    
    // Save updated logs
    await AsyncStorage.setItem(`daily_logs_${babyId}`, JSON.stringify(updatedLogs));
    
    console.log('✅ Auto-logged:', loggedActivities.map(a => a.type).join(', '));
    
    return {
      logged: true,
      activities: loggedActivities
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

/**
 * Detect activities mentioned in text
 * @param {string} text - Text to analyze
 * @returns {Array} - Array of {type, confidence}
 */
function detectActivities(text) {
  const activities = [];
  
  // Validate input
  if (!text || typeof text !== 'string') {
    return activities;
  }
  
  const lowerText = text.toLowerCase().trim();
  
  // FOOD FIRST (check before feed to avoid conflicts)
  // Food patterns - MOST SPECIFIC PHRASES FIRST
  const foodPatterns = [
    // Compound phrases (most specific - check these FIRST)
    'দাল ভাত খাওয়াইছি',
    'দাল ভাত খাইয়েছি', 
    'দাল ভাত খাওয়ালাম',
    'দাল ভাত খাওয়াইলাম',
    'দাল ভাত দিয়েছি',
    'দাল ভাত দিলাম',
    'দাল ভাত দিছি',
    'খিচুড়ি খাইয়েছি',
    'খিচুড়ি খাওয়ালাম',
    'খিচুড়ি খাওয়াইলাম',
    'খিচুড়ি দিয়েছি',
    'খিচুড়ি দিলাম',
    'ভাত খাওয়াইছি',
    'ভাত খাওয়ালাম',
    'ভাত খাইয়েছি',
    'ভাত খাওয়াইলাম',
    'ভাত দিয়েছি',
    'ভাত দিলাম',
    'ডিম খাওয়ালাম',
    'ডিম খাইয়েছি',
    'ডিম খাওয়াইলাম',
    'ডিম দিয়েছি',
    'ডিম দিলাম',
    'কলা খাওয়ালাম',
    'কলা খাইয়েছি',
    'কলা খাওয়াইলাম',
    'কলা দিয়েছি',
    'কলা দিলাম',
    'সবজি খাওয়ালাম',
    'সবজি খাইয়েছি',
    'সবজি খাওয়াইলাম',
    'সবজি দিয়েছি',
    'মাছ খাওয়ালাম',
    'মাছ দিয়েছি',
    'মুরগি খাওয়ালাম',
    'মুরগি দিয়েছি',
    
    // General food keywords
    'দাল ভাত',
    'খাবার খাওয়াইছি',
    'খাবার খাইয়েছি',
    'খাবার খাওয়ালাম',
    'খাবার খাওয়াইলাম',
    'খাবার দিয়েছি',
    'খাবার দিলাম',
    'খাবার দিছি',
    'সলিড ফুড',
    'সলিড খাওয়ালাম',
    'সলিড দিয়েছি',
    'খিচুড়ি',
    'আপেল',
    'আম',
    'পেঁপে',
    'গাজর',
    'আলু',
    'মিষ্টি আলু',
    'মিষ্টিআলু',
    'সিরিয়াল',
    'পিউরি',
    'বিস্কুট',
    'পাউরুটি',
    'রুটি',
    'ফল দিয়েছি',
    'ফল খাওয়ালাম'
  ];
  
  const foundFood = foodPatterns.some(pattern => lowerText.includes(pattern.toLowerCase()));
  
  if (foundFood) {
    activities.push({ type: 'food', confidence: 'high' });
    // Return early - don't check for feed if food detected
    // This prevents "ভাত খাওয়ালাম" from also logging as feed
  }
  
  // Feed patterns - ONLY if food NOT detected
  if (!foundFood) {
    const feedPatterns = [
      'দুধ খাওয়ালাম',
      'দুধ খাওয়াইলাম',
      'দুধ খাওয়ালেম',
      'দুধ খাইয়েছি',
      'দুধ খাওয়াইছি',
      'খাওয়ালাম দুধ',
      'খাওয়াইলাম দুধ',
      'দুধ দিয়েছি',
      'দুধ দিলাম',
      'দুধ দিছি',
      'ফিড করেছি',
      'ফিড দিয়েছি',
      'ফিড দিলাম',
      'দুধ খেয়েছে',
      'খেয়েছে দুধ',
      'ব্রেস্টফিড',
      'স্তন্যপান করালাম',
      'স্তন্যপান করাইলাম',
      'বুকের দুধ দিয়েছি',
      'বুকের দুধ দিলাম',
      'বুকের দুধ',
      'ফর্মুলা দিয়েছি',
      'ফর্মুলা দিলাম',
      'বোতলে দুধ',
      'বোতল দিয়েছি',
      'বোতল দিলাম'
    ];
    
    if (feedPatterns.some(pattern => lowerText.includes(pattern.toLowerCase()))) {
      activities.push({ type: 'feed', confidence: 'high' });
    }
  }
  
  // Sleep patterns
  const sleepPatterns = [
    'ঘুমাচ্ছে',
    'ঘুমিয়েছে',
    'ঘুমাইছে',
    'ঘুমায়েছে',
    'ঘুমিয়ে গেছে',
    'ঘুমায় গেছে',
    'ঘুমাইয়া গেছে',
    'ঘুম দিয়েছি',
    'ঘুম দিলাম',
    'ঘুম দিছি',
    'ঘুম হয়েছে',
    'শুয়ে আছে',
    'শুইয়ে দিয়েছি',
    'শুইয়ে দিলাম',
    'ঘুমাতে দিয়েছি',
    'ঘুমাইয়ে দিয়েছি',
    'ঘুমের মধ্যে',
    'ঘুমন্ত',
    'ঘুমিয়ে পড়েছে',
    'ঘুমায় পড়ছে'
  ];
  
  if (sleepPatterns.some(pattern => lowerText.includes(pattern.toLowerCase()))) {
    activities.push({ type: 'sleep', confidence: 'high' });
  }
  
  // Diaper patterns
  const diaperPatterns = [
    'ডায়াপার বদলালাম',
    'ডায়াপার বদলাইলাম',
    'ডায়াপার বদলেছি',
    'ডায়াপার বদলাইছি',
    'ডায়াপার চেঞ্জ',
    'ডায়াপার পরিবর্তন',
    'পায়খানা করেছে',
    'পায়খানা হয়েছে',
    'পায়খানা করছে',
    'প্রস্রাব করেছে',
    'প্রস্রাব হয়েছে',
    'পটি করেছে',
    'পটি হয়েছে',
    'সু সু করেছে',
    'পু পু করেছে',
    'সু সু হয়েছে',
    'পু পু হয়েছে',
    'ডায়াপার ভিজে গেছে',
    'ডায়াপার ভিজা',
    'ডায়াপার নোংরা'
  ];
  
  if (diaperPatterns.some(pattern => lowerText.includes(pattern.toLowerCase()))) {
    activities.push({ type: 'diaper', confidence: 'high' });
  }
  
  return activities;
}

/**
 * Load logs from storage
 */
async function loadLogs(babyId) {
  try {
    const saved = await AsyncStorage.getItem(`daily_logs_${babyId}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      
      // Ensure all activity types exist
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
  
  // Return empty structure if nothing saved
  return {
    feed: [],
    sleep: [],
    diaper: [],
    food: []
  };
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
  
  const activityNames = activities
    .map(a => getActivityNameBengali(a.type))
    .join(', ');
  
  return `✓ ${activityNames} লগ করে রাখলাম`;
}
