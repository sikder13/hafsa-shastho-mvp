/**
 * Hafsa Sastho (হাফসা স্বাস্থ্য)
 * Bangladesh's First AI Companion for Postpartum and Early Childhood Care
 * Copyright © 2026 Nahl Technologies Inc. All rights reserved.
 *
 * @author Udaay Sikder — Co-Founder & Dev
 */
// utils/constants.js
// All shared constants — colors, keys, config
// SINGLE SOURCE OF TRUTH — change once, updates everywhere

// ============================================================
// APP COLORS
// ============================================================
export const COLORS = {
    // Primary brand
    primary: '#4CAF50',
    primaryDark: '#2E7D32',
    primaryDarker: '#1B5E20',
    primaryLight: '#E8F5E9',
    primaryBorder: '#C8E6C9',
  
    // Feature colors
    feed: '#4CAF50',       // Green — breastfeeding/bottle
    food: '#FF9800',       // Orange — solid food
    sleep: '#2196F3',      // Blue — sleep
    diaper: '#9C27B0',     // Purple — diaper
    mother: '#E91E63',     // Pink — mother's health
    vaccine: '#FF9800',    // Orange — vaccine
    growth: '#2196F3',     // Blue — growth
  
    // Status colors
    success: '#4CAF50',
    warning: '#FF9800',
    danger: '#F44336',
    info: '#2196F3',
  
    // Mood colors
    moodHappy: '#4CAF50',
    moodOkay: '#FF9800',
    moodSad: '#2196F3',
    moodBad: '#F44336',
  
    // Bleeding status
    bleedingNone: '#4CAF50',
    bleedingLight: '#8BC34A',
    bleedingModerate: '#FF9800',
    bleedingHeavy: '#F44336',
  
    // Neutral
    background: '#F9F9F9',
    white: '#FFFFFF',
    dark: '#212121',
    gray: '#666666',
    lightGray: '#999999',
    border: '#E0E0E0',
    inputBg: '#F5F5F5',
    cardBg: '#FFFFFF',
  
    // Chat
    userBubble: '#4CAF50',
    aiBubble: '#FFFFFF',
    aiBorder: '#E0E0E0',
  };
  
  // ============================================================
  // ASYNCSTORAGE KEYS
  // ============================================================
  export const STORAGE_KEYS = {
    // Profiles
    babyProfile: 'baby_profile',
    motherProfile: 'mother_profile',
    onboardingComplete: 'onboarding_complete',
    userArea: 'user_area',
    userSettings: 'user_settings',
  
    // Daily data (append baby_id or user_id)
    dailyLogs: (babyId) => `daily_logs_${babyId}`,
    motherLog: (date) => `mother_log_${date}`,
    motherLogsHistory: 'mother_logs_history',
  
    // Feature data (append baby_id)
    vaccineStatus: (babyId) => `vaccine_status_${babyId}`,
    growthMeasurements: (babyId) => `growth_measurements_${babyId}`,
  
    // Chat
    chatHistory: 'chat_history',
  
    // Sync
    lastSyncTimestamp: 'last_sync_timestamp',
  };
  
  // ============================================================
  // APP CONFIG
  // ============================================================
  export const CONFIG = {
    // AI Chat
    maxChatHistory: 10,        // Messages sent to Claude API
    maxStoredMessages: 50,     // Messages stored locally
    maxResponseTokens: 800,    // Claude max_tokens
    systemPromptBudget: 600,   // Target system prompt size in tokens
    chatResponseTimeout: 15000, // 15 second timeout for API calls
  
    // Daily targets
    waterIntakeTarget: 8,       // Glasses per day
    mealsTarget: 3,             // Meals per day
    restHoursTarget: 8,         // Hours recommended rest
    breastfeedingTarget: 8,     // Sessions per day (newborn)
  
    // Alert thresholds
    depressionAlertDays: 5,     // Days of sad/bad mood to trigger alert
    bleedingAlertIncrease: 2,   // Days of increasing bleeding to trigger alert
    milkSupplyAlertDays: 3,     // Days of low supply to trigger alert
    noSupportAlertDays: 7,      // Days without support to trigger alert
    lowWetDiaperThreshold: 6,   // Fewer than this is concerning
    inactivityAlertHours: 24,   // Hours without logging to send notification
  
    // Edinburgh Depression Scale
    edinburghIntervalDays: 14,  // How often to show the scale
    edinburghConcernScore: 10,  // Score that triggers concern alert
  
    // Vaccine
    vaccineReminderDays: 2,     // Days before due date to remind
    postVaccineCareDays: 3,     // Days to show post-vaccine care card
  
    // Growth
    minGrowthVelocity: 400,     // Minimum grams/month for first 6 months
  
    // Notifications
    eveningSummaryHour: 20,     // 8 PM
    moodCheckIntervalDays: 3,   // Every 3 days
  };
  
  // ============================================================
  // BENGALI TEXT
  // ============================================================
  export const TEXT = {
    // Log type names
    logTypes: {
      feed: 'দুধ খাওয়ানো',
      sleep: 'ঘুম',
      diaper: 'ডায়াপার বদলানো',
      food: 'খাবার খাওয়ানো',
    },
  
    // Mood labels
    moods: {
      happy: 'খুশি',
      okay: 'ঠিক আছে',
      sad: 'বিষন্ন',
      bad: 'খারাপ',
    },
  
    // Mood emojis
    moodEmojis: {
      happy: '😊',
      okay: '😐',
      sad: '😢',
      bad: '😞',
    },
  
    // Bleeding labels
    bleeding: {
      none: 'নেই',
      light: 'হালকা',
      moderate: 'মাঝারি',
      heavy: 'বেশি',
    },
  
    // Pain level descriptions
    painLevels: {
      low: 'হালকা (১-৩)',
      medium: 'মাঝারি (৪-৬)',
      high: 'তীব্র (৭-১০)',
    },
  
    // Sleep quality
    sleepQuality: {
      good: 'ভালো',
      okay: 'মোটামুটি',
      bad: 'খারাপ',
    },
  
    // Anxiety levels
    anxiety: {
      low: 'কম',
      medium: 'মাঝারি',
      high: 'বেশি',
    },
  
    // Milk supply
    milkSupply: {
      low: 'কম',
      adequate: 'পর্যাপ্ত',
      excess: 'বেশি',
    },
  
    // C-section healing
    csectionHealing: {
      improving: 'ভালো হচ্ছে',
      same: 'একই আছে',
      worsening: 'খারাপ হচ্ছে',
    },
  
    // Growth status
    growthStatus: {
      underweight: 'কম ওজন',
      slightly_low: 'একটু কম',
      normal: 'স্বাভাবিক',
      slightly_high: 'একটু বেশি',
      overweight: 'বেশি ওজন',
    },
  
    // Common messages
    messages: {
      saving: 'সংরক্ষণ করা হচ্ছে...',
      saved: 'সংরক্ষিত হয়েছে',
      error: 'কিছু সমস্যা হয়েছে। আবার চেষ্টা করুন।',
      networkError: 'ইন্টারনেট সংযোগ পরীক্ষা করুন।',
      goBack: 'ফিরে যান',
      save: 'সংরক্ষণ করুন',
      cancel: 'বাতিল করুন',
      confirm: 'নিশ্চিত',
      seeDoctor: 'ডাক্তার দেখান',
    },
  };