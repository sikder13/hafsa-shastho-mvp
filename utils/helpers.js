/**
 * Hafsa Sastho (হাফসা স্বাস্থ্য)
 * Bangladesh's First AI Companion for Postpartum and Early Childhood Care
 * Copyright © 2026 Nahl Technologies Inc. All rights reserved.
 *
 * @author Udaay Sikder — Co-Founder & Dev
 */
// utils/helpers.js
// Shared utility functions used across all screens
// SINGLE SOURCE OF TRUTH — never duplicate these in screen files

/**
 * Convert any number to Bengali digits
 * Used everywhere: dashboard, logs, growth, vaccine, chat
 * @param {number|string} num - Number to convert
 * @returns {string} Bengali digit string
 */
export function toBengaliNumber(num) {
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(num).split('').map(d => bengaliDigits[parseInt(d)] || d).join('');
  }
  
  /**
   * Calculate baby's age in days, months, years
   * Returns both raw numbers and Bengali formatted string
   * @param {string} birthDate - Baby's birth date (YYYY-MM-DD or DD-MM-YYYY)
   * @returns {Object} { ageDays, ageMonths, ageYears, bengaliAge, postpartumDays }
   */
  export function calculateAge(birthDate) {
    try {
      let birth;
  
      // Handle both YYYY-MM-DD and DD-MM-YYYY formats
      if (birthDate.includes('-')) {
        const parts = birthDate.split('-');
        if (parts[0].length === 4) {
          // YYYY-MM-DD format (from database)
          birth = new Date(parts[0], parts[1] - 1, parts[2]);
        } else {
          // DD-MM-YYYY format (from user input)
          birth = new Date(parts[2], parts[1] - 1, parts[0]);
        }
      } else {
        birth = new Date(birthDate);
      }
  
      const today = new Date();
      const diffTime = Math.abs(today - birth);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
      const totalMonths = Math.floor(diffDays / 30);
      const remainingDays = diffDays % 30;
      const years = Math.floor(totalMonths / 12);
      const months = totalMonths % 12;
  
      // Build Bengali age string
      let bengaliAge;
      if (years > 0) {
        bengaliAge = `${toBengaliNumber(years)} বছর ${toBengaliNumber(months)} মাস`;
      } else if (totalMonths > 0) {
        bengaliAge = `${toBengaliNumber(totalMonths)} মাস ${toBengaliNumber(remainingDays)} দিন`;
      } else {
        bengaliAge = `${toBengaliNumber(diffDays)} দিন`;
      }
  
      return {
        ageDays: diffDays,
        ageMonths: totalMonths,
        ageYears: years,
        remainingMonths: months,
        remainingDays: remainingDays,
        bengaliAge: bengaliAge,
        postpartumDays: diffDays // Same as ageDays — used for mother's recovery tracking
      };
    } catch (error) {
      console.error('Error calculating age:', error);
      return {
        ageDays: 0,
        ageMonths: 0,
        ageYears: 0,
        remainingMonths: 0,
        remainingDays: 0,
        bengaliAge: 'গণনা করা যায়নি',
        postpartumDays: 0
      };
    }
  }
  
  /**
   * Calculate age in months only (for growth chart and vaccine calculations)
   * More precise than calculateAge().ageMonths for medical purposes
   * @param {string} birthDate - YYYY-MM-DD format
   * @returns {number} Age in months
   */
  export function calculateAgeInMonths(birthDate) {
    try {
      const birth = new Date(birthDate);
      const today = new Date();
  
      let months = (today.getFullYear() - birth.getFullYear()) * 12;
      months += today.getMonth() - birth.getMonth();
  
      if (today.getDate() < birth.getDate()) {
        months--;
      }
  
      return Math.max(0, months);
    } catch (error) {
      console.error('Error calculating age in months:', error);
      return 0;
    }
  }
  
  /**
   * Format a date to Bengali DD-MM-YYYY
   * @param {string|Date} dateInput - Date to format
   * @returns {string} Bengali formatted date
   */
  export function formatDateBengali(dateInput) {
    try {
      const date = new Date(dateInput);
      const day = date.getDate();
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      return `${toBengaliNumber(day)}-${toBengaliNumber(month)}-${toBengaliNumber(year)}`;
    } catch (error) {
      return 'তারিখ অজানা';
    }
  }
  
  /**
   * Format user-typed date input as DD-MM-YYYY with auto-dashes
   * Used in BabyProfileScreen and OnboardingScreen
   * @param {string} text - Raw text input
   * @returns {string} Formatted date string
   */
  export function formatDateInput(text) {
    const numbers = text.replace(/\D/g, '');
  
    if (numbers.length <= 2) {
      return numbers;
    } else if (numbers.length <= 4) {
      return `${numbers.slice(0, 2)}-${numbers.slice(2)}`;
    } else {
      return `${numbers.slice(0, 2)}-${numbers.slice(2, 4)}-${numbers.slice(4, 8)}`;
    }
  }
  
  /**
   * Format time to Bengali HH:MM
   * @param {string|Date} timestamp - Timestamp to format
   * @returns {string} Bengali formatted time
   */
  export function formatTimeBengali(timestamp) {
    try {
      const date = new Date(timestamp);
      const hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${toBengaliNumber(hours)}:${toBengaliNumber(minutes)}`;
    } catch (error) {
      return '';
    }
  }
  
  /**
   * Get time-appropriate Bengali greeting
   * @returns {string} Bengali greeting
   */
  export function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'সুপ্রভাত';
    if (hour < 17) return 'শুভ অপরাহ্ন';
    if (hour < 21) return 'শুভ সন্ধ্যা';
    return 'শুভ রাত্রি';
  }
  
  /**
   * Get today's date as a string for comparison
   * @returns {string} Today's date string
   */
  export function getTodayString() {
    return new Date().toDateString();
  }
  
  /**
   * Count items from an array that belong to today
   * @param {Array} items - Array of objects with timestamp field
   * @returns {number} Count of today's items
   */
  export function countToday(items) {
    if (!items || items.length === 0) return 0;
    const today = getTodayString();
    return items.filter(item => {
      try {
        return new Date(item.timestamp).toDateString() === today;
      } catch {
        return false;
      }
    }).length;
  }
  
  /**
   * Safely parse JSON from AsyncStorage
   * Returns fallback value if parsing fails
   * @param {string} jsonString - JSON string to parse
   * @param {*} fallback - Value to return if parsing fails
   * @returns {*} Parsed value or fallback
   */
  export function safeJSONParse(jsonString, fallback = null) {
    try {
      if (!jsonString) return fallback;
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('JSON parse error:', error);
      return fallback;
    }
  }
  
  /**
   * Get the recovery stage description based on days postpartum and delivery type
   * Used by PostpartumTracker and AI Chat
   * @param {number} daysSinceBirth - Days since delivery
   * @param {string} deliveryType - 'csection' or 'normal'
   * @returns {Object} { stage, description, percentComplete }
   */
  export function getRecoveryStage(daysSinceBirth, deliveryType = 'normal') {
    if (deliveryType === 'csection') {
      if (daysSinceBirth <= 7) {
        return { stage: 'early', description: 'সেলাই শুকানো শুরু', percentComplete: 10 };
      } else if (daysSinceBirth <= 14) {
        return { stage: 'healing', description: 'সেলাই শুকাচ্ছে', percentComplete: 25 };
      } else if (daysSinceBirth <= 21) {
        return { stage: 'improving', description: 'ক্ষত সারছে', percentComplete: 40 };
      } else if (daysSinceBirth <= 42) {
        return { stage: 'recovering', description: 'ভেতরে সারছে', percentComplete: 65 };
      } else if (daysSinceBirth <= 56) {
        return { stage: 'almost', description: 'প্রায় সুস্থ', percentComplete: 85 };
      } else {
        return { stage: 'recovered', description: 'সম্পূর্ণ সুস্থ', percentComplete: 100 };
      }
    } else {
      // Normal delivery
      if (daysSinceBirth <= 7) {
        return { stage: 'early', description: 'প্রাথমিক সেরে ওঠা', percentComplete: 20 };
      } else if (daysSinceBirth <= 14) {
        return { stage: 'healing', description: 'সেরে উঠছেন', percentComplete: 45 };
      } else if (daysSinceBirth <= 21) {
        return { stage: 'improving', description: 'অনেকটা ভালো', percentComplete: 70 };
      } else if (daysSinceBirth <= 42) {
        return { stage: 'recovering', description: 'প্রায় সুস্থ', percentComplete: 90 };
      } else {
        return { stage: 'recovered', description: 'সম্পূর্ণ সুস্থ', percentComplete: 100 };
      }
    }
  }