/**
 * Hafsa Sastho (হাফসা স্বাস্থ্য)
 * Bangladesh's First AI Companion for Postpartum and Early Childhood Care
 * Copyright © 2026 Nahl Technologies Inc. All rights reserved.
 *
 * @author Udaay Sikder — Co-Founder & Dev
 */
// services/supabaseService.js
// Central Supabase sync service — the ONLY file that talks to Supabase
//
// Architecture:
//   Screen → AppContext (AsyncStorage) → supabaseService (background sync)
//   Screen NEVER imports supabase directly (except AuthScreen for auth)
//
// Offline-first:
//   - Writes go to AsyncStorage immediately (handled by AppContext)
//   - This service syncs to Supabase in background
//   - Failed syncs are queued and retried
//   - On login, Supabase data hydrates AsyncStorage

import { supabase } from '../supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SYNC_QUEUE_KEY = 'supabase_sync_queue';

// Cache the Supabase baby UUID to avoid repeated lookups
let _cachedBabyId = null;

/**
 * Get the real Supabase UUID for the user's baby
 * Local baby IDs are like 'baby-1710000000' but Supabase uses UUIDs
 */
async function getSupabaseBabyId(userId) {
  if (_cachedBabyId) return _cachedBabyId;

  try {
    const { data, error } = await supabase
      .from('babies')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (error || !data) return null;
    _cachedBabyId = data.id;
    return data.id;
  } catch (e) {
    console.log('Baby ID lookup failed:', e.message);
    return null;
  }
}

// ============================================================
// AUTH HELPERS
// ============================================================

/**
 * Get current authenticated user ID
 * @returns {string|null} user UUID or null
 */
export async function getCurrentUserId() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch (e) {
    console.log('Auth check failed:', e.message);
    return null;
  }
}

/**
 * Listen for auth state changes
 * @param {Function} callback - receives (event, session)
 * @returns {Function} unsubscribe function
 */
export function onAuthStateChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return () => subscription.unsubscribe();
}

// ============================================================
// PROFILE SYNC
// ============================================================

/**
 * Create or update user profile in Supabase
 * Called after onboarding or profile edit
 */
export async function syncProfile(profileData) {
  const userId = await getCurrentUserId();
  if (!userId) return { success: false, error: 'Not authenticated' };

  try {
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        name: profileData.name || '',
        phone: profileData.phone || null,
        email: profileData.email || null,
        division: profileData.division || null,
        district: profileData.district || null,
        delivery_type: profileData.delivery_type || 'normal',
        is_first_baby: profileData.is_first_baby !== false,
        concerns: profileData.concerns || [],
        language: profileData.language || 'bn',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (error) throw error;
    return { success: true };
  } catch (e) {
    console.log('Profile sync failed:', e.message);
    await queueSync('profile', profileData);
    return { success: false, error: e.message };
  }
}

// ============================================================
// BABY SYNC
// ============================================================

/**
 * Create or update baby profile in Supabase
 */
export async function syncBaby(babyData) {
  const userId = await getCurrentUserId();
  if (!userId) return { success: false, error: 'Not authenticated' };

  try {
    // Check if baby exists in Supabase
    const { data: existing } = await supabase
      .from('babies')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('babies')
        .update({
          name: babyData.name,
          birth_date: babyData.birth_date,
          gender: babyData.gender || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) throw error;
      return { success: true, babyId: existing.id };
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('babies')
        .insert({
          user_id: userId,
          name: babyData.name,
          birth_date: babyData.birth_date,
          gender: babyData.gender || null,
        })
        .select('id')
        .single();

      if (error) throw error;
      return { success: true, babyId: data.id };
    }
  } catch (e) {
    console.log('Baby sync failed:', e.message);
    await queueSync('baby', babyData);
    return { success: false, error: e.message };
  }
}

// ============================================================
// DAILY LOGS SYNC
// ============================================================

/**
 * Sync a single daily log entry to Supabase
 * Called after every addLog or auto-log
 */
export async function syncDailyLog(logEntry, babyId, babyBirthDate) {
    const userId = await getCurrentUserId();
    if (!userId) return { success: false, error: 'Not authenticated' };
  
    try {
      // Get the real Supabase baby UUID (local ID might be 'baby-xxxxx')
      const realBabyId = await getSupabaseBabyId(userId);
      if (!realBabyId) return { success: false, error: 'No baby in Supabase' };
  
      // Calculate baby age in days
      const birthDate = new Date(babyBirthDate);
      const logDate = new Date(logEntry.timestamp);
      const ageDays = Math.floor((logDate - birthDate) / (1000 * 60 * 60 * 24));
  
      const { error } = await supabase
        .from('daily_logs')
        .insert({
          baby_id: realBabyId,
          user_id: userId,
          log_type: logEntry.type,
          timestamp: logEntry.timestamp,
          source: logEntry.source || (logEntry.autoLogged ? 'auto_chat' : 'manual'),
          auto_logged: logEntry.autoLogged || false,
          baby_age_days: ageDays,
          details: logEntry.details || null,
          notes: logEntry.notes || null,
          synced_from_local: true,
        });
  
      if (error) throw error;
      return { success: true };
    } catch (e) {
      console.log('Daily log sync failed:', e.message);
      await queueSync('daily_log', { logEntry, babyId, babyBirthDate });
      return { success: false, error: e.message };
    }
  }

// ============================================================
// MOTHER DAILY LOG SYNC
// ============================================================

/**
 * Sync mother's daily check-in to Supabase
 * Uses upsert — one row per (user_id, date)
 */
export async function syncMotherLog(logData, postpartumDay) {
  const userId = await getCurrentUserId();
  if (!userId) return { success: false, error: 'Not authenticated' };

  try {
    const { error } = await supabase
      .from('mother_daily_logs')
      .upsert({
        user_id: userId,
        date: logData.date,
        postpartum_day: postpartumDay || 0,
        mood: logData.mood || null,
        bleeding: logData.bleeding || null,
        pain: logData.pain || null,
        breast_pain: logData.breastPain !== undefined ? logData.breastPain : null,
        csection_healing: logData.csectionHealing || null,
        sleep_hours: logData.sleepHours || null,
        water_intake: logData.waterIntake || 0,
        meals_eaten: logData.mealsEaten || 0,
        breastfeeding_sessions: logData.breastfeedingSessions || 0,
        had_help: logData.hadHelp !== undefined ? logData.hadHelp : null,
        notes: logData.notes || null,
        completed_at: logData.completedAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,date' });

    if (error) throw error;
    return { success: true };
  } catch (e) {
    console.log('Mother log sync failed:', e.message);
    await queueSync('mother_log', { logData, postpartumDay });
    return { success: false, error: e.message };
  }
}

// ============================================================
// GROWTH RECORDS SYNC
// ============================================================

/**
 * Sync a growth measurement to Supabase
 */
export async function syncGrowthRecord(measurement, babyId) {
    const userId = await getCurrentUserId();
    if (!userId) return { success: false, error: 'Not authenticated' };
  
    try {
      const realBabyId = await getSupabaseBabyId(userId);
      if (!realBabyId) return { success: false, error: 'No baby in Supabase' };
  
      const { error } = await supabase
        .from('growth_records')
        .insert({
          baby_id: realBabyId,
          user_id: userId,
          weight_kg: measurement.weight,
          height_cm: measurement.height || null,
          age_months: measurement.ageMonths || null,
          percentile: measurement.percentile || null,
          recorded_date: measurement.date ? new Date(measurement.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          notes: measurement.notes || null,
        });
  
      if (error) throw error;
      return { success: true };
    } catch (e) {
      console.log('Growth sync failed:', e.message);
      await queueSync('growth', { measurement, babyId });
      return { success: false, error: e.message };
    }
  }
// ============================================================
// VACCINE RECORDS SYNC
// ============================================================

/**
 * Sync vaccine status to Supabase
 */
export async function syncVaccineRecord(vaccineId, vaccineData, babyId) {
    const userId = await getCurrentUserId();
    if (!userId) return { success: false, error: 'Not authenticated' };
  
    try {
      const realBabyId = await getSupabaseBabyId(userId);
      if (!realBabyId) return { success: false, error: 'No baby in Supabase' };
  
      const { error } = await supabase
        .from('vaccine_records')
        .upsert({
            baby_id: realBabyId,
            user_id: userId,
            vaccine_name: vaccineId,
            age_days: vaccineData.ageDays || null,
            status: vaccineData.completed ? 'completed' : 'pending',
            completed_date: vaccineData.completedDate ? new Date(vaccineData.completedDate).toISOString().split('T')[0] : null,
          }, { onConflict: 'baby_id,vaccine_name' });
  
      if (error) throw error;
      return { success: true };
    } catch (e) {
      console.log('Vaccine sync failed:', e.message);
      await queueSync('vaccine', { vaccineId, vaccineData, babyId });
      return { success: false, error: e.message };
    }
  }
// ============================================================
// AI INTERACTIONS SYNC (RLHF)
// ============================================================

/**
 * Sync AI chat interaction with RLHF feedback to Supabase
 * Called after every Hafsa response
 */
export async function syncAIInteraction(interactionData) {
  const userId = await getCurrentUserId();
  if (!userId) return { success: false, error: 'Not authenticated' };

  try {
    const { data, error } = await supabase
      .from('ai_interactions')
      .insert({
        user_id: userId,
        baby_age_days: interactionData.babyAgeDays || null,
        postpartum_day: interactionData.postpartumDay || null,
        user_message: interactionData.userMessage,
        hafsa_response: interactionData.hafsaResponse,
        feedback: interactionData.feedback || null,
        topic: interactionData.topic || 'general',
        auto_logged: interactionData.autoLogged || false,
        auto_log_type: interactionData.autoLogType || null,
        response_time_ms: interactionData.responseTimeMs || null,
        model: interactionData.model || 'sonnet',
        input_method: interactionData.inputMethod || 'text',
      })
      .select('id')
      .single();

    if (error) throw error;
    return { success: true, id: data.id };
  } catch (e) {
    console.log('AI interaction sync failed:', e.message);
    await queueSync('ai_interaction', interactionData);
    return { success: false, error: e.message };
  }
}

/**
 * Update RLHF feedback on an existing AI interaction
 * Called when user taps thumbs up/down
 */
export async function updateAIFeedback(interactionId, feedback) {
  const userId = await getCurrentUserId();
  if (!userId) return { success: false, error: 'Not authenticated' };

  try {
    const { error } = await supabase
      .from('ai_interactions')
      .update({ feedback })
      .eq('id', interactionId)
      .eq('user_id', userId);

    if (error) throw error;
    return { success: true };
  } catch (e) {
    console.log('Feedback update failed:', e.message);
    return { success: false, error: e.message };
  }
}

// ============================================================
// CHAT HISTORY SYNC
// ============================================================

/**
 * Sync a chat message to Supabase
 * Called after every user message and Hafsa response
 */
export async function syncChatMessage(messageData) {
    const userId = await getCurrentUserId();
    if (!userId) return { success: false, error: 'Not authenticated' };
  
    try {
      const { error } = await supabase
        .from('chat_history')
        .insert({
          user_id: userId,
          role: messageData.role,
          content: messageData.content,
          is_welcome: messageData.isWelcome || false,
          auto_logged: messageData.autoLogged || false,
          auto_log_message: messageData.autoLogMessage || null,
        });
  
      if (error) throw error;
      return { success: true };
    } catch (e) {
      console.log('Chat sync failed:', e.message);
      return { success: false, error: e.message };
    }
  }
  
  /**
   * Load chat history from Supabase (for cloud restore)
   * Returns last 50 messages
   */
  export async function loadChatHistory() {
    const userId = await getCurrentUserId();
    if (!userId) return { success: false, data: [] };
  
    try {
      const { data, error } = await supabase
        .from('chat_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(50);
  
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (e) {
      console.log('Chat history load failed:', e.message);
      return { success: false, data: [] };
    }
  }

// ============================================================
// EPDS ASSESSMENT SYNC
// ============================================================

/**
 * Sync Edinburgh Postnatal Depression Scale assessment
 */
export async function syncEPDS(epdsData, postpartumDay) {
  const userId = await getCurrentUserId();
  if (!userId) return { success: false, error: 'Not authenticated' };

  try {
    const { error } = await supabase
      .from('epds_assessments')
      .insert({
        user_id: userId,
        postpartum_day: postpartumDay || 0,
        total_score: epdsData.totalScore,
        answers: epdsData.answers || {},
        risk_level: epdsData.riskLevel || 'normal',
        self_harm_flag: epdsData.selfHarmFlag || false,
      });

    if (error) throw error;
    return { success: true };
  } catch (e) {
    console.log('EPDS sync failed:', e.message);
    await queueSync('epds', { epdsData, postpartumDay });
    return { success: false, error: e.message };
  }
}

// ============================================================
// USER CONSENTS (PDPO 2025)
// ============================================================

/**
 * Record user consent for legal compliance
 */
export async function recordConsent(consentType, consentVersion, granted) {
  const userId = await getCurrentUserId();
  if (!userId) return { success: false, error: 'Not authenticated' };

  try {
    const { error } = await supabase
      .from('user_consents')
      .insert({
        user_id: userId,
        consent_type: consentType,
        consent_version: consentVersion,
        granted: granted,
      });

    if (error) throw error;
    return { success: true };
  } catch (e) {
    console.log('Consent sync failed:', e.message);
    return { success: false, error: e.message };
  }
}

// ============================================================
// SUBSCRIPTION
// ============================================================

/**
 * Create initial subscription (trial tier) after signup
 */
export async function createTrialSubscription() {
  const userId = await getCurrentUserId();
  if (!userId) return { success: false, error: 'Not authenticated' };

  try {
    const { error } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: userId,
        tier: 'trial',
        trial_start_date: new Date().toISOString(),
        trial_end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        payment_status: 'trial',
      }, { onConflict: 'id' });

    if (error) throw error;
    return { success: true };
  } catch (e) {
    console.log('Subscription create failed:', e.message);
    return { success: false, error: e.message };
  }
}

// ============================================================
// DATA HYDRATION — Pull Supabase data into AsyncStorage on login
// ============================================================

/**
 * Pull all user data from Supabase into AsyncStorage
 * Called once after login/signup, and on manual refresh
 */
export async function hydrateFromCloud() {
  const userId = await getCurrentUserId();
  if (!userId) return { success: false, error: 'Not authenticated' };

  try {
    // Fetch all data in parallel
    const [
      { data: profile },
      { data: babies },
      { data: motherLogs },
      { data: subscription },
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('babies').select('*').eq('user_id', userId),
      supabase.from('mother_daily_logs').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(30),
      supabase.from('subscriptions').select('*').eq('user_id', userId).single(),
    ]);

    const result = { profile, babies, motherLogs, subscription };

    // If we have a baby, fetch baby-specific data
    if (babies && babies.length > 0) {
      const babyId = babies[0].id;

      const [
        { data: dailyLogs },
        { data: growthRecords },
        { data: vaccineRecords },
      ] = await Promise.all([
        supabase.from('daily_logs').select('*').eq('baby_id', babyId).order('timestamp', { ascending: false }).limit(200),
        supabase.from('growth_records').select('*').eq('baby_id', babyId).order('recorded_date', { ascending: false }),
        supabase.from('vaccine_records').select('*').eq('baby_id', babyId),
      ]);

      result.dailyLogs = dailyLogs;
      result.growthRecords = growthRecords;
      result.vaccineRecords = vaccineRecords;
    }

    console.log('☁️ Cloud hydration complete');
    return { success: true, data: result };
  } catch (e) {
    console.log('Cloud hydration failed:', e.message);
    return { success: false, error: e.message };
  }
}

// ============================================================
// SYNC QUEUE — Retry failed operations when back online
// ============================================================

/**
 * Add a failed operation to the sync queue
 */
async function queueSync(type, data) {
  try {
    const existing = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    const queue = existing ? JSON.parse(existing) : [];
    queue.push({
      type,
      data,
      timestamp: new Date().toISOString(),
      retries: 0,
    });
    // Keep queue manageable
    const trimmed = queue.slice(-100);
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(trimmed));
    console.log(`📋 Queued ${type} for retry (${trimmed.length} items in queue)`);
  } catch (e) {
    console.log('Queue save error:', e);
  }
}

/**
 * Process all queued sync operations
 * Call this when app comes online or on app start
 */
export async function processSyncQueue() {
  try {
    const existing = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    if (!existing) return { processed: 0 };

    const queue = JSON.parse(existing);
    if (queue.length === 0) return { processed: 0 };

    console.log(`📋 Processing ${queue.length} queued syncs...`);

    const remaining = [];
    let processed = 0;

    for (const item of queue) {
      let result = { success: false };

      try {
        switch (item.type) {
          case 'profile':
            result = await syncProfile(item.data);
            break;
          case 'baby':
            result = await syncBaby(item.data);
            break;
          case 'daily_log':
            result = await syncDailyLog(item.data.logEntry, item.data.babyId, item.data.babyBirthDate);
            break;
          case 'mother_log':
            result = await syncMotherLog(item.data.logData, item.data.postpartumDay);
            break;
          case 'growth':
            result = await syncGrowthRecord(item.data.measurement, item.data.babyId);
            break;
          case 'vaccine':
            result = await syncVaccineRecord(item.data.vaccineId, item.data.vaccineData, item.data.babyId);
            break;
          case 'ai_interaction':
            result = await syncAIInteraction(item.data);
            break;
          case 'epds':
            result = await syncEPDS(item.data.epdsData, item.data.postpartumDay);
            break;
        }
      } catch (e) {
        // Individual item failed
      }

      if (result.success) {
        processed++;
      } else {
        item.retries = (item.retries || 0) + 1;
        if (item.retries < 5) {
          remaining.push(item);
        }
        // Drop items after 5 retries
      }
    }

    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(remaining));
    console.log(`✅ Processed ${processed}/${queue.length} syncs, ${remaining.length} remaining`);
    return { processed, remaining: remaining.length };
  } catch (e) {
    console.log('Queue processing error:', e);
    return { processed: 0 };
  }
}

/**
 * Sync daily AI usage count to Supabase ai_usage table.
 * @param {string} userId
 * @param {number} count - chat_questions_today
 */
export async function syncAIUsage(userId, count) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('ai_usage').upsert({
      user_id: userId,
      usage_date: today,
      chat_questions_today: count,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,usage_date' });
    if (error) console.log('AI usage sync error:', error.message);
  } catch (e) {
    console.log('AI usage sync failed:', e.message);
  }
}