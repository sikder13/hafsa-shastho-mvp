// services/claudeAPI.js
// Claude API with TRUE streaming for React Native
// Uses XMLHttpRequest (not fetch) because RN fetch doesn't support ReadableStream
// Words appear as generated — first word in 2-4 seconds
//
// Calls Supabase Edge Function proxy (hafsa-ai) — API key stays on server.
// Auth: sends user's Supabase session token, Edge Function forwards to Anthropic.

import { CONFIG } from '../utils/constants';
import { supabase, supabaseAnonKey } from '../supabaseClient';

const EDGE_FUNCTION_URL = 'https://unnmjrrpqftpcknabqwq.supabase.co/functions/v1/hafsa-ai';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

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

  // Verify user is logged in, then call Edge Function with anon key
  supabase.auth.getSession().then(({ data: { session } }) => {
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
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return { success: false, message: 'সেশন শেষ হয়ে গেছে। আবার লগইন করুন।', error: 'No session' };
    }

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