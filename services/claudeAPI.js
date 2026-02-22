// services/claudeAPI.js
// Handles all communication with Anthropic Claude API

import { ANTHROPIC_API_KEY } from '@env';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

/**
 * Send a message to Claude and get response
 * @param {Array} messages - Conversation history [{role: 'user'|'assistant', content: string}]
 * @param {string} systemPrompt - System instructions for Claude
 * @returns {Promise<Object>} - {success: boolean, message: string, error?: string}
 */
export async function sendMessageToClaude(messages, systemPrompt) {
  try {
    console.log('📤 Sending to Claude:', messages.length, 'messages');
    
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Claude API Error:', data);
      
      // Handle specific error types
      if (data.error?.type === 'invalid_request_error') {
        return {
          success: false,
          message: 'দুঃখিত, কিছু সমস্যা হয়েছে। আবার চেষ্টা করুন।',
          error: data.error.message
        };
      }
      
      if (data.error?.type === 'authentication_error') {
        return {
          success: false,
          message: 'সংযোগ সমস্যা। পরে আবার চেষ্টা করুন।',
          error: 'Authentication failed'
        };
      }
      
      return {
        success: false,
        message: 'দুঃখিত, আমি এই মুহূর্তে সাড়া দিতে পারছি না।',
        error: 'Unknown API error'
      };
    }
    
    // Extract Claude's response
    const claudeMessage = data.content[0].text;
    
    console.log('✅ Claude responded:', claudeMessage.substring(0, 100) + '...');
    
    return {
      success: true,
      message: claudeMessage,
      usage: data.usage // Track API usage
    };
    
  } catch (error) {
    console.error('❌ Network Error:', error);
    return {
      success: false,
      message: 'ইন্টারনেট সংযোগ পরীক্ষা করুন এবং আবার চেষ্টা করুন।',
      error: error.message
    };
  }
}

/**
 * Format conversation history for Claude API
 * @param {Array} chatHistory - [{id, role, content, timestamp}]
 * @returns {Array} - Formatted for Claude [{role, content}]
 */
export function formatMessagesForClaude(chatHistory) {
  return chatHistory.map(msg => ({
    role: msg.role, // 'user' or 'assistant'
    content: msg.content
  }));
}

/**
 * Check if API key is configured
 * @returns {boolean}
 */
export function isAPIKeyConfigured() {
  return ANTHROPIC_API_KEY && ANTHROPIC_API_KEY.length > 0;
}
