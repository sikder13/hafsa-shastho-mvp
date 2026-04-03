// services/notificationService.js
// Central notification service — handles ALL local push notifications
//
// Architecture:
//   This service is the ONLY file that uses expo-notifications.
//   Screens and AppContext call these functions to schedule/cancel notifications.
//   Notification-driven feed logging writes to AsyncStorage + triggers Supabase sync.
//
// Note: Notification response handlers run OUTSIDE React context,
// so they write directly to AsyncStorage and call supabaseService for sync.
// AppContext picks up changes on next loadAllData() or when the app foregrounds.

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../utils/constants';
import { toBengaliNumber } from '../utils/helpers';
import { syncDailyLog } from './supabaseService';

// ============================================================
// NOTIFICATION CATEGORY IDs
// ============================================================

const CATEGORY_FEED_ALERT = 'feed_alert';
const CATEGORY_MORNING_CATCHUP = 'morning_catchup';

// ============================================================
// NOTIFICATION CHANNEL (Android)
// ============================================================

const CHANNEL_ID = 'hafsa-shastho-default';

// ============================================================
// 1. REQUEST PERMISSIONS
// ============================================================

/**
 * Ask user for notification permission.
 * On Android, also creates the notification channel.
 * @returns {boolean} true if permission granted
 */
export async function requestPermissions() {
  try {
    // Physical device check — notifications don't work on simulators
    if (!Device.isDevice) {
      console.log('🔔 Notifications require a physical device');
      return false;
    }

    // Android: create notification channel first
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'হাফসা স্বাস্থ্য',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
      });
    }

    // Check existing permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Ask if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('🔔 Notification permission denied');
      return false;
    }

    console.log('🔔 Notification permission granted');
    return true;
  } catch (e) {
    console.log('🔔 Permission request error:', e.message);
    return false;
  }
}

// ============================================================
// 2. SCHEDULE VACCINE REMINDER
// ============================================================

/**
 * Schedule a notification 2 days before vaccine due date
 * @param {string} vaccineName - Bengali vaccine name
 * @param {Date|string} dueDate - When the vaccine is due
 */
export async function scheduleVaccineReminder(vaccineName, dueDate) {
  try {
    const due = new Date(dueDate);
    const reminderDate = new Date(due);
    reminderDate.setDate(reminderDate.getDate() - 2);

    // Don't schedule if reminder date is in the past
    if (reminderDate <= new Date()) {
      console.log('🔔 Vaccine reminder date already passed for:', vaccineName);
      return null;
    }

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '\uD83D\uDC89 টিকার সময়!',
        body: `${vaccineName} টিকা ${toBengaliNumber(2)} দিন পরে! প্রস্তুতি নিন।`,
        data: { type: 'vaccine_reminder', vaccineName },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderDate,
      },
    });

    console.log('🔔 Vaccine reminder scheduled:', vaccineName, '→', reminderDate.toISOString());
    return id;
  } catch (e) {
    console.log('🔔 Vaccine reminder error:', e.message);
    return null;
  }
}

// ============================================================
// 3. SCHEDULE FEED ALERT
// ============================================================

/**
 * Check if last feed was > 4 hours ago. If so, fire immediately.
 * Has action buttons: "এইমাত্র খাওয়ালাম" (log feed) and "পরে" (dismiss)
 * @param {string} babyName - Baby's name for notification text
 * @param {Date|string} lastFeedTime - Timestamp of last feed
 */
export async function scheduleFeedAlert(babyName, lastFeedTime) {
  try {
    const lastFeed = new Date(lastFeedTime);
    const now = new Date();
    const hoursSinceLastFeed = (now - lastFeed) / (1000 * 60 * 60);

    if (hoursSinceLastFeed <= 4) {
      return null; // Not time yet
    }

    const hours = Math.floor(hoursSinceLastFeed);

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '\uD83C\uDF7C দুধের সময়',
        body: `${babyName} শেষ দুধ ${toBengaliNumber(hours)} ঘন্টা আগে।`,
        categoryIdentifier: CATEGORY_FEED_ALERT,
        data: { type: 'feed_alert', babyName },
        sound: 'default',
      },
      trigger: null, // Fire immediately
    });

    console.log('🔔 Feed alert fired:', babyName, hours, 'hours since last feed');
    return id;
  } catch (e) {
    console.log('🔔 Feed alert error:', e.message);
    return null;
  }
}

// ============================================================
// 4. SCHEDULE CHECK-IN REMINDER
// ============================================================

/**
 * Fire at 8 PM daily if no mother check-in today.
 * Called by the app — it checks if check-in exists before scheduling.
 */
export async function scheduleCheckInReminder() {
  try {
    // Cancel any existing check-in reminder first
    await cancelNotificationsByType('checkin_reminder');

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '\uD83D\uDC9A চেক-ইন করুন',
        body: 'আজ চেক-ইন হয়নি। আপনি কেমন আছেন?',
        data: { type: 'checkin_reminder' },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 20,
        minute: 0,
      },
    });

    console.log('🔔 Check-in reminder scheduled for 8 PM daily');
    return id;
  } catch (e) {
    console.log('🔔 Check-in reminder error:', e.message);
    return null;
  }
}

// ============================================================
// 5. SCHEDULE EVENING SUMMARY
// ============================================================

/**
 * Fire at 9 PM daily with today's summary.
 */
export async function scheduleEveningSummary() {
  try {
    // Cancel any existing evening summary first
    await cancelNotificationsByType('evening_summary');

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '\uD83D\uDCCA আজকের সারাংশ',
        body: 'আজকের দিনটি কেমন গেল? সারাংশ দেখুন।',
        data: { type: 'evening_summary' },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 21,
        minute: 0,
      },
    });

    console.log('🔔 Evening summary scheduled for 9 PM daily');
    return id;
  } catch (e) {
    console.log('🔔 Evening summary error:', e.message);
    return null;
  }
}

// ============================================================
// 6. SCHEDULE MORNING CATCHUP
// ============================================================

/**
 * Fire at 8 AM daily with morning catchup question.
 * Action buttons: "১ বার", "২ বার", "৩ বার", "৪+ বার"
 * Each button logs that many feeds for last night (10 PM - 6 AM).
 * @param {string} babyName - Baby's name for notification text
 */
export async function scheduleMorningCatchup(babyName) {
  try {
    // Cancel any existing morning catchup first
    await cancelNotificationsByType('morning_catchup');

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'সুপ্রভাত!',
        body: `গতরাত কয়বার ${babyName} দুধ দিয়েছেন?`,
        categoryIdentifier: CATEGORY_MORNING_CATCHUP,
        data: { type: 'morning_catchup', babyName },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 8,
        minute: 0,
      },
    });

    console.log('🔔 Morning catchup scheduled for 8 AM daily');
    return id;
  } catch (e) {
    console.log('🔔 Morning catchup error:', e.message);
    return null;
  }
}

// ============================================================
// 7. SCHEDULE WEEKLY REPORT
// ============================================================

/**
 * Fire every Sunday at 10 AM.
 */
export async function scheduleWeeklyReport() {
  try {
    // Cancel any existing weekly report first
    await cancelNotificationsByType('weekly_report');

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '\uD83D\uDCCB সাপ্তাহিক রিপোর্ট',
        body: 'এই সপ্তাহের রিপোর্ট তৈরি।',
        data: { type: 'weekly_report' },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 1, // Sunday = 1 in expo-notifications
        hour: 10,
        minute: 0,
      },
    });

    console.log('🔔 Weekly report scheduled for Sunday 10 AM');
    return id;
  } catch (e) {
    console.log('🔔 Weekly report error:', e.message);
    return null;
  }
}

// ============================================================
// 8. SCHEDULE EPDS REMINDER
// ============================================================

/**
 * Fire 14 days after last EPDS assessment.
 * @param {Date|string} lastAssessmentDate - When the last EPDS was completed
 */
export async function scheduleEPDSReminder(lastAssessmentDate) {
  try {
    const lastDate = new Date(lastAssessmentDate);
    const reminderDate = new Date(lastDate);
    reminderDate.setDate(reminderDate.getDate() + 14);

    // Don't schedule if reminder date is in the past
    if (reminderDate <= new Date()) {
      console.log('🔔 EPDS reminder date already passed');
      return null;
    }

    // Cancel any existing EPDS reminder
    await cancelNotificationsByType('epds_reminder');

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '\uD83D\uDC9A মানসিক স্বাস্থ্য',
        body: 'মানসিক স্বাস্থ্য চেক-আপের সময়।',
        data: { type: 'epds_reminder' },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderDate,
      },
    });

    console.log('🔔 EPDS reminder scheduled:', reminderDate.toISOString());
    return id;
  } catch (e) {
    console.log('🔔 EPDS reminder error:', e.message);
    return null;
  }
}

// ============================================================
// 9. HANDLE NOTIFICATION RESPONSE
// ============================================================

/**
 * Handle when user taps a notification or action button.
 * For feed logging buttons: save to AsyncStorage + trigger Supabase sync.
 * For morning catchup: save N feeds with timestamps spread across last night.
 *
 * NOTE: This runs OUTSIDE React context. Cannot call AppContext functions.
 * We write directly to AsyncStorage and sync to Supabase.
 * AppContext picks up changes on next foreground/reload.
 *
 * @param {Object} response - expo-notifications response object
 */
export async function handleNotificationResponse(response) {
  try {
    const actionId = response.actionIdentifier;
    const data = response.notification?.request?.content?.data || {};
    const notificationType = data.type;

    console.log('🔔 Notification response:', notificationType, 'action:', actionId);

    // Default tap (no action button) — just opens the app
    if (actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      // App will handle navigation based on data.type
      return { type: notificationType, action: 'open' };
    }

    // Feed alert: "এইমাত্র খাওয়ালাম" (just fed)
    if (notificationType === 'feed_alert' && actionId === 'FEED_LOG_NOW') {
      await logFeedFromNotification(1, false);
      return { type: 'feed_alert', action: 'logged', count: 1 };
    }

    // Feed alert: "পরে" (later) — just dismiss
    if (notificationType === 'feed_alert' && actionId === 'FEED_LATER') {
      return { type: 'feed_alert', action: 'dismissed' };
    }

    // Morning catchup: log N feeds for last night
    if (notificationType === 'morning_catchup') {
      let feedCount = 0;

      switch (actionId) {
        case 'CATCHUP_1': feedCount = 1; break;
        case 'CATCHUP_2': feedCount = 2; break;
        case 'CATCHUP_3': feedCount = 3; break;
        case 'CATCHUP_4': feedCount = 4; break;
        default: return { type: 'morning_catchup', action: 'open' };
      }

      await logFeedFromNotification(feedCount, true);
      return { type: 'morning_catchup', action: 'logged', count: feedCount };
    }

    return { type: notificationType, action: 'unknown' };
  } catch (e) {
    console.log('🔔 Response handler error:', e.message);
    return { type: 'error', action: 'failed' };
  }
}

// ============================================================
// 10. CANCEL ALL NOTIFICATIONS
// ============================================================

/**
 * Cancel all scheduled notifications. Used on logout.
 */
export async function cancelAllNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('🔔 All notifications cancelled');
  } catch (e) {
    console.log('🔔 Cancel all error:', e.message);
  }
}

// ============================================================
// 11. SETUP NOTIFICATION CATEGORIES
// ============================================================

/**
 * Create notification categories with action buttons.
 * Call this ONCE on app startup (in App.js or AppContext).
 *
 * Categories:
 * - feed_alert: "এইমাত্র খাওয়ালাম" + "পরে"
 * - morning_catchup: "১ বার" + "২ বার" + "৩ বার" + "৪+ বার"
 */
export async function setupNotificationCategories() {
  try {
    await Notifications.setNotificationCategoryAsync(CATEGORY_FEED_ALERT, [
      {
        identifier: 'FEED_LOG_NOW',
        buttonTitle: 'এইমাত্র খাওয়ালাম',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'FEED_LATER',
        buttonTitle: 'পরে',
        options: { opensAppToForeground: false, isDestructive: true },
      },
    ]);

    await Notifications.setNotificationCategoryAsync(CATEGORY_MORNING_CATCHUP, [
      {
        identifier: 'CATCHUP_1',
        buttonTitle: `${toBengaliNumber(1)} বার`,
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'CATCHUP_2',
        buttonTitle: `${toBengaliNumber(2)} বার`,
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'CATCHUP_3',
        buttonTitle: `${toBengaliNumber(3)} বার`,
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'CATCHUP_4',
        buttonTitle: `${toBengaliNumber(4)}+ বার`,
        options: { opensAppToForeground: false },
      },
    ]);

    console.log('🔔 Notification categories set up');
  } catch (e) {
    console.log('🔔 Category setup error:', e.message);
  }
}

// ============================================================
// INTERNAL HELPERS
// ============================================================

/**
 * Log feed(s) directly to AsyncStorage + Supabase from notification handler.
 * Runs OUTSIDE React context — cannot use AppContext.
 *
 * For morning catchup (overnight = true):
 *   Spreads N feeds across 10 PM - 6 AM last night with even intervals.
 *
 * For feed alert (overnight = false):
 *   Logs one feed at current time.
 *
 * @param {number} count - Number of feeds to log
 * @param {boolean} overnight - If true, spread timestamps across last night
 */
async function logFeedFromNotification(count, overnight) {
  try {
    // Load baby profile to get baby ID and birth date
    const babyRaw = await AsyncStorage.getItem(STORAGE_KEYS.babyProfile);
    if (!babyRaw) {
      console.log('🔔 No baby profile — cannot log feed');
      return;
    }
    const baby = JSON.parse(babyRaw);
    if (!baby?.id) return;

    // Load existing logs
    const logsRaw = await AsyncStorage.getItem(STORAGE_KEYS.dailyLogs(baby.id));
    const logs = logsRaw ? JSON.parse(logsRaw) : { feed: [], sleep: [], diaper: [], food: [] };

    // Generate timestamps for the feeds
    const timestamps = [];
    if (overnight) {
      // Spread across last night 10 PM - 6 AM (8 hour window)
      const now = new Date();
      const lastNight10PM = new Date(now);
      lastNight10PM.setDate(lastNight10PM.getDate() - 1);
      lastNight10PM.setHours(22, 0, 0, 0);

      const thismorning6AM = new Date(now);
      thismorning6AM.setHours(6, 0, 0, 0);

      const totalWindowMs = thismorning6AM - lastNight10PM; // 8 hours in ms
      const interval = totalWindowMs / (count + 1);

      for (let i = 1; i <= count; i++) {
        timestamps.push(new Date(lastNight10PM.getTime() + interval * i));
      }
    } else {
      // Single feed at current time
      for (let i = 0; i < count; i++) {
        timestamps.push(new Date());
      }
    }

    // Create log entries
    const newEntries = timestamps.map((ts, index) => ({
      id: Date.now() + index + Math.random(),
      timestamp: ts.toISOString(),
      type: 'feed',
      source: 'notification',
      autoLogged: true,
      notes: overnight ? 'রাতের দুধ (নোটিফিকেশন থেকে)' : 'নোটিফিকেশন থেকে লগ',
    }));

    // Prepend new entries to feed logs
    logs.feed = [...newEntries, ...logs.feed];

    // Save to AsyncStorage
    await AsyncStorage.setItem(STORAGE_KEYS.dailyLogs(baby.id), JSON.stringify(logs));
    console.log(`🔔 Logged ${count} feed(s) from notification`);

    // Background sync each entry to Supabase (non-blocking)
    for (const entry of newEntries) {
      syncDailyLog(entry, baby.id, baby.birth_date)
        .catch(e => console.log('🔔 Feed sync bg:', e.message));
    }
  } catch (e) {
    console.log('🔔 Feed logging from notification error:', e.message);
  }
}

/**
 * Cancel scheduled notifications by type.
 * Uses the data.type field set on each notification.
 * @param {string} type - notification type to cancel
 */
async function cancelNotificationsByType(type) {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.content?.data?.type === type) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  } catch (e) {
    console.log('🔔 Cancel by type error:', e.message);
  }
}
