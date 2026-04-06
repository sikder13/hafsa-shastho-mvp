/**
 * Hafsa Sastho (হাফসা স্বাস্থ্য)
 * Bangladesh's First AI Companion for Postpartum and Early Childhood Care
 * Copyright © 2026 Nahl Technologies Inc. All rights reserved.
 *
 * @author Udaay Sikder — Co-Founder & Dev
 */
// services/claudeAPI.js
// Claude API with TRUE streaming for React Native
// Uses XMLHttpRequest (not fetch) because RN fetch doesn't support ReadableStream
// Words appear as generated — first word in 2-4 seconds
//
// Calls Supabase Edge Function proxy (hafsa-ai) — API key stays on server.
// Auth: sends user's Supabase session token, Edge Function forwards to Anthropic.

import { CONFIG } from '../utils/constants';
import { supabase, supabaseAnonKey } from '../supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncAIUsage } from './supabaseService';

const EDGE_FUNCTION_URL = 'https://unnmjrrpqftpcknabqwq.supabase.co/functions/v1/hafsa-ai';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

// ============================================================
// RATE LIMITING — 10 messages + 2 bonus per 24 hours
// ============================================================

const DAILY_LIMIT = 10;
const BONUS_LIMIT = 2;
const TOTAL_LIMIT = DAILY_LIMIT + BONUS_LIMIT; // 12

async function checkAndIncrementUsage() {
  const today = new Date().toISOString().split('T')[0];
  const key = 'ai_usage_' + today;

  try {
    const stored = await AsyncStorage.getItem(key);
    const count = stored ? parseInt(stored, 10) : 0;

    if (count >= TOTAL_LIMIT) {
      return { allowed: false, count, isBonus: false, limitReached: true };
    }

    const newCount = count + 1;
    await AsyncStorage.setItem(key, newCount.toString());

    // Clean up yesterday's key (prevent AsyncStorage bloat)
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    AsyncStorage.removeItem('ai_usage_' + yesterday).catch(() => {});

    return {
      allowed: true,
      count: newCount,
      isBonus: newCount > DAILY_LIMIT,
      bonusJustUnlocked: count === DAILY_LIMIT,
      remaining: TOTAL_LIMIT - newCount,
      limitReached: false,
    };
  } catch (e) {
    return { allowed: true, count: 0, isBonus: false, limitReached: false, remaining: TOTAL_LIMIT };
  }
}

/**
 * Read current daily usage count without incrementing.
 */
export async function getDailyUsageCount() {
  const today = new Date().toISOString().split('T')[0];
  const key = 'ai_usage_' + today;
  try {
    const stored = await AsyncStorage.getItem(key);
    return stored ? parseInt(stored, 10) : 0;
  } catch (e) {
    return 0;
  }
}

// ============================================================
// STREAMING via XMLHttpRequest (works in React Native)
// ============================================================

/**
 * Stream message to Claude — words appear as generated
 * @param {Array} messages - [{role, content}]
 * @param {string} systemPrompt - System instructions
 * @param {Function} onChunk - Called with (newText, fullTextSoFar)
 * @param {Function} onDone - Called with {fullText}
 * @param {Function} onError - Called with {message, error}
 * @returns {Function} abort function
 */
export function streamMessageToClaude(messages, systemPrompt, onChunk, onDone, onError) {
  const limitedMessages = messages.slice(-(CONFIG.maxChatHistory || 10));

  console.log('📤 XHR Streaming to Claude:', limitedMessages.length, 'messages');

  const xhr = new XMLHttpRequest();
  let fullText = '';
  let lastProcessedIndex = 0;
  let isComplete = false;

  // Timeout
  const timeoutId = setTimeout(() => {
    if (!isComplete) {
      xhr.abort();
      onError?.({
        message: 'সাড়া দিতে অনেক সময় লাগছে। আবার চেষ্টা করুন।',
        error: 'Timeout'
      });
    }
  }, 30000);

  // Check rate limit, verify session, then call Edge Function
  checkAndIncrementUsage().then(usageCheck => {
    if (!usageCheck.allowed) {
      const limitMsg = 'আজকের সব মেসেজ শেষ হয়েছে (১২/১২)। আগামীকাল আবার হাফসা আপা আপনার পাশে থাকবে! 💚\n\nদুধ, ঘুম, ডায়াপার লগ সবসময় কাজ করবে — শিশু ট্যাবে যান।';
      isComplete = true;
      clearTimeout(timeoutId);
      onDone?.({ fullText: limitMsg });
      return;
    }

    // Sync usage to Supabase in background
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s?.user?.id) syncAIUsage(s.user.id, usageCheck.count).catch(() => {});
    }).catch(() => {});

    return supabase.auth.getSession();
  }).then(result => {
    if (!result) return; // rate limited — already handled above
    const { data: { session } } = result;

    if (!session?.access_token) {
      onError?.({ message: 'সেশন শেষ হয়ে গেছে। আবার লগইন করুন।', error: 'No session' });
      return;
    }

    xhr.open('POST', EDGE_FUNCTION_URL);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', `Bearer ${supabaseAnonKey}`);
    xhr.setRequestHeader('apikey', supabaseAnonKey);

    // This is the key: onprogress fires as data arrives incrementally
    xhr.onprogress = function () {
      try {
        const newData = xhr.responseText.substring(lastProcessedIndex);
        lastProcessedIndex = xhr.responseText.length;

        if (!newData) return;

        // Parse SSE events from the new chunk
        const lines = newData.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              fullText += parsed.delta.text;
              onChunk?.(parsed.delta.text, fullText);
            }
          } catch {
            // Skip unparseable lines
          }
        }
      } catch (e) {
        console.error('Stream parse error:', e);
      }
    };

    xhr.onload = function () {
      isComplete = true;
      clearTimeout(timeoutId);

      if (xhr.status >= 200 && xhr.status < 300) {
        // Process any remaining data
        const remaining = xhr.responseText.substring(lastProcessedIndex);
        if (remaining) {
          const lines = remaining.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                fullText += parsed.delta.text;
                onChunk?.(parsed.delta.text, fullText);
              }
            } catch {}
          }
        }

        console.log('✅ Stream complete:', fullText.substring(0, 80) + '...');
        onDone?.({ fullText });
      } else {
        // API error
        let errorMsg = 'দুঃখিত, আমি এই মুহূর্তে সাড়া দিতে পারছি না।';
        try {
          const errData = JSON.parse(xhr.responseText);
          if (errData.error?.type === 'authentication_error') {
            errorMsg = 'সংযোগ সমস্যা। পরে আবার চেষ্টা করুন।';
          } else if (errData.error?.type === 'overloaded_error') {
            errorMsg = 'সার্ভার ব্যস্ত। ৩০ সেকেন্ড পর আবার চেষ্টা করুন।';
          }
        } catch {}
        onError?.({ message: errorMsg, error: `HTTP ${xhr.status}` });
      }
    };

    xhr.onerror = function () {
      isComplete = true;
      clearTimeout(timeoutId);

      // If we got partial text, still deliver it
      if (fullText.length > 0) {
        console.log('⚠ Stream errored with partial text, delivering:', fullText.substring(0, 50));
        onDone?.({ fullText });
      } else {
        onError?.({
          message: 'ইন্টারনেট সংযোগ পরীক্ষা করুন এবং আবার চেষ্টা করুন।',
          error: 'Network error'
        });
      }
    };

    xhr.onabort = function () {
      isComplete = true;
      clearTimeout(timeoutId);
      // If we got partial text, deliver it
      if (fullText.length > 0) {
        onDone?.({ fullText });
      }
    };

    xhr.send(JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: CONFIG.maxResponseTokens || 512,
      system: systemPrompt,
      messages: limitedMessages,
      stream: true
    }));
  }).catch(e => {
    onError?.({ message: 'সেশন পরীক্ষায় সমস্যা। আবার চেষ্টা করুন।', error: e.message });
  });

  // Return abort function
  return () => {
    if (!isComplete) {
      isComplete = true;
      clearTimeout(timeoutId);
      xhr.abort();
    }
  };
}

// ============================================================
// NON-STREAMING FALLBACK
// ============================================================

export async function sendMessageToClaude(messages, systemPrompt) {
  const limitedMessages = messages.slice(-(CONFIG.maxChatHistory || 10));

  try {
    // Rate limit check
    const usageCheck = await checkAndIncrementUsage();
    if (!usageCheck.allowed) {
      return {
        success: true,
        message: 'আজকের সব মেসেজ শেষ হয়েছে (১২/১২)। আগামীকাল আবার হাফসা আপা আপনার পাশে থাকবে! 💚\n\nদুধ, ঘুম, ডায়াপার লগ সবসময় কাজ করবে — শিশু ট্যাবে যান।'
      };
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return { success: false, message: 'সেশন শেষ হয়ে গেছে। আবার লগইন করুন।', error: 'No session' };
    }

    // Sync usage to Supabase in background
    if (session?.user?.id) syncAIUsage(session.user.id, usageCheck.count).catch(() => {});

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.chatResponseTimeout || 15000);

    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: CONFIG.maxResponseTokens || 512,
        system: systemPrompt,
        messages: limitedMessages
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: 'দুঃখিত, আমি এই মুহূর্তে সাড়া দিতে পারছি না।',
        error: data.error?.message || 'API error'
      };
    }

    return {
      success: true,
      message: data.content[0].text,
      usage: data.usage
    };

  } catch (error) {
    if (error.name === 'AbortError') {
      return { success: false, message: 'সাড়া দিতে অনেক সময় লাগছে।', error: 'Timeout' };
    }
    return { success: false, message: 'ইন্টারনেট সংযোগ পরীক্ষা করুন।', error: error.message };
  }
}

/**
 * Check if API is accessible (user is authenticated)
 */
export async function isAPIKeyConfigured() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session?.access_token;
  } catch {
    return false;
  }
}