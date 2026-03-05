// screens/ChatScreen.js
// Hafsa Aapa AI Chat — STREAMING responses + full context
// Words appear as generated — first word in 1-2 seconds

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { streamMessageToClaude, sendMessageToClaude } from '../services/claudeAPI';
import { buildHafsaPrompt, buildOpeningMessage, detectEmergency } from '../services/hafsaPrompt';
import { buildFullContext } from '../utils/contextBuilder';
import { processAutoLog, formatAutoLogConfirmation } from '../services/autoLogger';
import { useApp } from '../context/AppContext';
import MessageBubble from '../components/MessageBubble';
import { COLORS } from '../utils/constants';

export default function ChatScreen({ baby, onBack }) {
  const {
    motherProfile,
    logs,
    todayMotherLog,
    motherLogHistory,
    vaccineStatus,
    growthMeasurements
  } = useApp();

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);
  const scrollViewRef = useRef(null);
  const abortRef = useRef(null);
  const contextRef = useRef(null);

  useEffect(() => {
    initializeChat();
    return () => {
      // Cleanup: abort any ongoing stream on unmount
      if (abortRef.current) abortRef.current();
    };
  }, []);

  const initializeChat = async () => {
    const context = await buildFullContext({
      baby,
      motherProfile,
      logs,
      todayMotherLog,
      motherLogHistory,
      vaccineStatus,
      growthMeasurements
    });

    contextRef.current = context;

    if (context.suggestedQuestions && context.suggestedQuestions.length > 0) {
      setSuggestedQuestions(context.suggestedQuestions);
    }

    const openingText = buildOpeningMessage(context);

    setMessages([{
      id: Date.now(),
      role: 'assistant',
      content: openingText,
      timestamp: new Date(),
      isWelcome: true
    }]);
  };

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 50);
  }, []);

  const handleSend = async (messageText) => {
    const userMessage = (messageText || inputText).trim();
    if (!userMessage || loading) return;

    setInputText('');
    setSuggestedQuestions([]);

    // Emergency check
    if (detectEmergency(userMessage)) {
      Alert.alert(
        '⚠️ জরুরি',
        'আপনার শিশুকে এখনই ডাক্তার দেখান বা জরুরি সেবা নিন।\n\nজরুরি সেবা: ৯৯৯',
        [
          { text: 'ঠিক আছে', style: 'cancel' },
          { text: '📞 ৯৯৯ কল', onPress: () => Alert.alert('জরুরি সেবা', '৯৯৯ এ কল করুন') }
        ]
      );
    }

    // Add user message
    const newUserMsg = {
      id: Date.now(),
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newUserMsg]);
    setLoading(true);
    setStreamingText('');
    scrollToBottom();

    try {
      // Rebuild context
      const freshContext = await buildFullContext({
        baby,
        motherProfile,
        logs,
        todayMotherLog,
        motherLogHistory,
        vaccineStatus,
        growthMeasurements
      });
      contextRef.current = freshContext;

      const systemPrompt = buildHafsaPrompt(freshContext);

      const conversationHistory = messages
        .filter(m => !m.isWelcome)
        .concat([newUserMsg])
        .map(msg => ({ role: msg.role, content: msg.content }));

      // Auto-log from user message (question-aware)
      const autoLogResult = await processAutoLog(userMessage, baby.id);

      // Try streaming first
      let streamWorked = false;

      const abort = streamMessageToClaude(
        conversationHistory,
        systemPrompt,
        // onChunk — update streaming text as words arrive
        (chunk, fullText) => {
          streamWorked = true;
          setStreamingText(fullText);
          scrollToBottom();
        },
        // onDone — finalize message
        ({ fullText }) => {
          if (fullText && fullText.trim()) {
            const hafsaMsg = {
              id: Date.now() + 1,
              role: 'assistant',
              content: fullText,
              timestamp: new Date(),
              autoLogged: autoLogResult.logged,
              autoLogMessage: autoLogResult.logged
                ? formatAutoLogConfirmation(autoLogResult.activities)
                : null
            };

            setMessages(prev => [...prev, hafsaMsg]);
            setStreamingText('');
            setLoading(false);
            scrollToBottom();
          } else if (!streamWorked) {
            // Stream returned empty — fallback to non-streaming
            fallbackSend(conversationHistory, systemPrompt, autoLogResult);
          } else {
            setStreamingText('');
            setLoading(false);
          }
        },
        // onError — fallback to non-streaming
        (error) => {
          console.log('Stream error, falling back:', error);
          setStreamingText('');
          fallbackSend(conversationHistory, systemPrompt, autoLogResult);
        }
      );

      abortRef.current = abort;

    } catch (error) {
      Alert.alert('ত্রুটি', 'কিছু সমস্যা হয়েছে। আবার চেষ্টা করুন।');
      console.error('Chat error:', error);
      setLoading(false);
      setStreamingText('');
    }
  };

  // Fallback: non-streaming API call
  const fallbackSend = async (conversationHistory, systemPrompt, autoLogResult) => {
    try {
      const result = await sendMessageToClaude(conversationHistory, systemPrompt);

      if (result.success) {
        const hafsaMsg = {
          id: Date.now() + 1,
          role: 'assistant',
          content: result.message,
          timestamp: new Date(),
          autoLogged: autoLogResult?.logged || false,
          autoLogMessage: autoLogResult?.logged
            ? formatAutoLogConfirmation(autoLogResult.activities)
            : null
        };

        setMessages(prev => [...prev, hafsaMsg]);
        scrollToBottom();
      } else {
        Alert.alert('ত্রুটি', result.message);
      }
    } catch (error) {
      Alert.alert('ত্রুটি', 'কিছু সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setLoading(false);
      setStreamingText('');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9F9F9' }}>

      {/* HEADER */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: COLORS.primaryLight,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.primaryBorder
      }}>
        <TouchableOpacity
          onPress={() => {
            if (abortRef.current) abortRef.current();
            onBack();
          }}
          style={{ marginRight: 12, padding: 4 }}
        >
          <Text style={{ fontSize: 24 }}>←</Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 24, marginRight: 8 }}>💚</Text>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.primaryDark }}>
              হাফসা আপা
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: COLORS.primary, marginTop: 2 }}>
            {motherProfile?.name ? `${motherProfile.name} ও ${baby.name} এর সহায়ক` : `${baby.name} এর AI সহায়ক`}
          </Text>
        </View>
      </View>

      {/* MESSAGES */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          onContentSizeChange={scrollToBottom}
        >
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isUser={msg.role === 'user'}
            />
          ))}

          {/* SUGGESTED QUESTIONS */}
          {suggestedQuestions.length > 0 && messages.length <= 1 && !loading && (
            <View style={{ marginTop: 8, marginBottom: 12 }}>
              <Text style={{ fontSize: 13, color: COLORS.gray, marginBottom: 8 }}>
                জিজ্ঞেস করতে পারেন:
              </Text>
              {suggestedQuestions.map((q, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => handleSend(q)}
                  style={{
                    backgroundColor: COLORS.white,
                    borderWidth: 1.5,
                    borderColor: COLORS.primaryBorder,
                    borderRadius: 20,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    marginBottom: 8,
                    alignSelf: 'flex-start'
                  }}
                >
                  <Text style={{ fontSize: 14, color: COLORS.primaryDark }}>
                    {q}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* STREAMING RESPONSE — Shows text as it arrives */}
          {loading && streamingText ? (
            <View style={{
              alignSelf: 'flex-start',
              maxWidth: '85%',
              backgroundColor: 'white',
              borderRadius: 16,
              borderTopLeftRadius: 4,
              padding: 12,
              paddingHorizontal: 16,
              borderWidth: 1,
              borderColor: '#E0E0E0',
              marginBottom: 12
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ fontSize: 14, marginRight: 6 }}>💚</Text>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: COLORS.primaryDark }}>
                  হাফসা আপা
                </Text>
              </View>
              <Text style={{ fontSize: 15, color: '#333', lineHeight: 24 }}>
                {streamingText}
                <Text style={{ color: COLORS.primary }}>▊</Text>
              </Text>
            </View>
          ) : loading ? (
            // Show thinking indicator before first chunk arrives
            <View style={{
              alignSelf: 'flex-start',
              padding: 12,
              paddingHorizontal: 16,
              backgroundColor: 'white',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#E0E0E0',
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 12
            }}>
              <Text style={{ fontSize: 20, marginRight: 8 }}>💚</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: COLORS.primary, fontSize: 22, marginRight: 2 }}>•</Text>
                <Text style={{ color: COLORS.primary, fontSize: 22, marginRight: 2, opacity: 0.6 }}>•</Text>
                <Text style={{ color: COLORS.primary, fontSize: 22, opacity: 0.3 }}>•</Text>
              </View>
            </View>
          ) : null}
        </ScrollView>

        {/* INPUT */}
        <View style={{
          flexDirection: 'row',
          padding: 12,
          paddingHorizontal: 16,
          backgroundColor: 'white',
          borderTopWidth: 1,
          borderTopColor: '#E0E0E0'
        }}>
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="মেসেজ লিখুন..."
            placeholderTextColor="#999"
            style={{
              flex: 1,
              backgroundColor: '#F5F5F5',
              borderRadius: 24,
              paddingHorizontal: 16,
              paddingVertical: 12,
              fontSize: 16,
              marginRight: 12,
              maxHeight: 100
            }}
            multiline
            editable={!loading}
            onSubmitEditing={() => handleSend()}
          />

          <TouchableOpacity
            onPress={() => handleSend()}
            disabled={loading || !inputText.trim()}
            style={{
              backgroundColor: loading || !inputText.trim() ? '#BDBDBD' : COLORS.primary,
              width: 48,
              height: 48,
              borderRadius: 24,
              justifyContent: 'center',
              alignItems: 'center'
            }}
          >
            <Text style={{ fontSize: 20, color: 'white' }}>→</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

    </SafeAreaView>
  );
}