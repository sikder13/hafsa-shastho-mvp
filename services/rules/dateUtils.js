// services/rules/dateUtils.js
// All date operations for the rules engine go through here
// Uses dayjs to avoid timezone bugs across Android/iOS devices
// NEVER use new Date().toDateString() in rule files — use these functions instead

import dayjs from 'dayjs';

/**
 * Get today's date key (YYYY-MM-DD) — timezone safe
 */
export function todayKey() {
  return dayjs().format('YYYY-MM-DD');
}

/**
 * Get date key for N days ago
 * @param {number} daysAgo - Positive number (1 = yesterday, 2 = day before)
 */
export function dateKeyDaysAgo(daysAgo) {
  return dayjs().subtract(daysAgo, 'day').format('YYYY-MM-DD');
}

/**
 * Get the date key (YYYY-MM-DD) from a timestamp
 * @param {string|Date} timestamp
 */
export function getDateKey(timestamp) {
  return dayjs(timestamp).format('YYYY-MM-DD');
}

/**
 * Check if a timestamp is from today
 * @param {string|Date} timestamp
 * @returns {boolean}
 */
export function isToday(timestamp) {
  return dayjs(timestamp).format('YYYY-MM-DD') === todayKey();
}

/**
 * Check if a timestamp is from a specific date offset
 * @param {string|Date} timestamp
 * @param {number} daysAgo - 0 = today, 1 = yesterday, etc.
 * @returns {boolean}
 */
export function isFromDaysAgo(timestamp, daysAgo) {
  return dayjs(timestamp).format('YYYY-MM-DD') === dateKeyDaysAgo(daysAgo);
}

/**
 * Count items from an array that match a specific date offset
 * @param {Array} items - Array with .timestamp field
 * @param {number} daysAgo - 0 = today, 1 = yesterday
 * @returns {number}
 */
export function countForDate(items, daysAgo) {
  if (!items || items.length === 0) return 0;
  const target = dateKeyDaysAgo(daysAgo);
  return items.filter(item => {
    try { return getDateKey(item.timestamp) === target; }
    catch { return false; }
  }).length;
}

/**
 * Get items from an array that match a specific date offset
 * @param {Array} items - Array with .timestamp field
 * @param {number} daysAgo - 0 = today, 1 = yesterday
 * @returns {Array}
 */
export function getItemsForDate(items, daysAgo) {
  if (!items || items.length === 0) return [];
  const target = dateKeyDaysAgo(daysAgo);
  return items.filter(item => {
    try { return getDateKey(item.timestamp) === target; }
    catch { return false; }
  });
}

/**
 * Get minutes elapsed since a timestamp
 * @param {string|Date} timestamp
 * @returns {number}
 */
export function minutesSince(timestamp) {
  return dayjs().diff(dayjs(timestamp), 'minute');
}

/**
 * Get days elapsed since a timestamp
 * @param {string|Date} timestamp
 * @returns {number}
 */
export function daysSince(timestamp) {
  return dayjs().diff(dayjs(timestamp), 'day');
}

/**
 * Get current hour (0-23)
 */
export function currentHour() {
  return dayjs().hour();
}

/**
 * Check if a date string (YYYY-MM-DD) matches a specific days-ago offset
 * Used for motherLogHistory which stores .date as YYYY-MM-DD
 * @param {string} dateStr - YYYY-MM-DD
 * @param {number} daysAgo
 * @returns {boolean}
 */
export function dateStrMatchesDaysAgo(dateStr, daysAgo) {
  return dateStr === dateKeyDaysAgo(daysAgo);
}