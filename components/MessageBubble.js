// components/MessageBubble.js
// Reusable message bubble with RLHF feedback (thumbs up/down on AI responses)
// Feedback stored for future Bengali LLM fine-tuning

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatTimeBengali } from '../utils/helpers';
import { COLORS } from '../utils/constants';

const FEEDBACK_STORAGE_KEY = 'ai_feedback';

export default function MessageBubble({ message, isUser, previousUserMessage }) {
  const [feedback, setFeedback] = useState(null); // 'up' | 'down' | null

  // Load saved feedback for this message
  useEffect(() => {
    if (!isUser && message.id) {
      loadFeedback();
    }
  }, [message.id]);

  const loadFeedback = async () => {
    try {
      const saved = await AsyncStorage.getItem(`${FEEDBACK_STORAGE_KEY}_${message.id}`);
      if (saved) setFeedback(saved);
    } catch (e) {
      // Ignore
    }
  };

  const handleFeedback = async (rating) => {
    // Toggle: tap same button again to remove feedback
    const newRating = feedback === rating ? null : rating;
    setFeedback(newRating);

    try {
      if (newRating) {
        // Store individual feedback
        await AsyncStorage.setItem(`${FEEDBACK_STORAGE_KEY}_${message.id}`, newRating);

        // Store in feedback log for batch export to Supabase later
        const feedbackEntry = {
          messageId: message.id,
          rating: newRating,
          hafsaResponse: message.content,
          userMessage: previousUserMessage || null,
          timestamp: new Date().toISOString(),
          autoLogged: message.autoLogged || false,
        };

        const logKey = 'ai_feedback_log';
        const existing = await AsyncStorage.getItem(logKey);
        const log = existing ? JSON.parse(existing) : [];

        // Update existing entry or add new
        const idx = log.findIndex(l => l.messageId === message.id);
        if (idx >= 0) {
          log[idx] = feedbackEntry;
        } else {
          log.push(feedbackEntry);
        }

        // Keep last 500 entries
        const trimmed = log.slice(-500);
        await AsyncStorage.setItem(logKey, JSON.stringify(trimmed));
      } else {
        // Removed feedback
        await AsyncStorage.removeItem(`${FEEDBACK_STORAGE_KEY}_${message.id}`);
      }
    } catch (e) {
      console.log('Feedback save error:', e);
    }
  };

  return (
    <View
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        backgroundColor: isUser ? COLORS.userBubble : COLORS.aiBubble,
        padding: 12,
        paddingHorizontal: 16,
        borderRadius: 16,
        marginBottom: 12,
        maxWidth: '80%',
        borderWidth: isUser ? 0 : 1,
        borderColor: COLORS.aiBorder,
        shadowColor: isUser ? 'transparent' : '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1
      }}
    >
      {/* Hafsa header */}
      {!isUser && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Text style={{ fontSize: 16, marginRight: 6 }}>💚</Text>
          <Text style={{ fontSize: 13, color: COLORS.primary, fontWeight: 'bold' }}>
            হাফসা আপা
          </Text>
        </View>
      )}

      {/* Message content */}
      <Text
        style={{
          fontSize: 16,
          color: isUser ? 'white' : COLORS.dark,
          lineHeight: 22
        }}
      >
        {message.content}
      </Text>

      {/* Timestamp */}
      <Text
        style={{
          fontSize: 11,
          color: isUser ? 'rgba(255,255,255,0.7)' : COLORS.lightGray,
          marginTop: 6,
          textAlign: 'right'
        }}
      >
        {formatTimeBengali(message.timestamp)}
      </Text>

      {/* Auto-log confirmation */}
      {message.autoLogged && (
        <View style={{
          marginTop: 8,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: isUser ? 'rgba(255,255,255,0.3)' : COLORS.border
        }}>
          <Text style={{
            fontSize: 12,
            color: isUser ? 'rgba(255,255,255,0.9)' : COLORS.primary,
            fontStyle: 'italic'
          }}>
            {message.autoLogMessage}
          </Text>
        </View>
      )}

      {/* RLHF Feedback — only on Hafsa's messages, not welcome message */}
      {!isUser && !message.isWelcome && (
        <View style={{
          marginTop: 10,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          flexDirection: 'row',
          alignItems: 'center',
        }}>
          <Text style={{ fontSize: 11, color: COLORS.lightGray, marginRight: 10 }}>
            উত্তর কেমন?
          </Text>

          <TouchableOpacity
            onPress={() => handleFeedback('up')}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 12,
              backgroundColor: feedback === 'up' ? '#E8F5E9' : 'transparent',
              borderWidth: 1,
              borderColor: feedback === 'up' ? COLORS.primary : '#E0E0E0',
              marginRight: 8,
            }}
          >
            <Text style={{ fontSize: 16 }}>
              {feedback === 'up' ? '👍' : '👍🏽'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleFeedback('down')}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 12,
              backgroundColor: feedback === 'down' ? '#FFEBEE' : 'transparent',
              borderWidth: 1,
              borderColor: feedback === 'down' ? '#D32F2F' : '#E0E0E0',
            }}
          >
            <Text style={{ fontSize: 16 }}>
              {feedback === 'down' ? '👎' : '👎🏽'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}