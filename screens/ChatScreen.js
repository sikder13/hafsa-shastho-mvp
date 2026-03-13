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
import { getAIContext } from '../services/intelligenceService';
import { BD_EPI_SCHEDULE } from '../data/bdEPISchedule';
import { processAutoLog, formatAutoLogConfirmation } from '../services/autoLogger';
import { useApp } from '../context/AppContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MessageBubble from '../components/MessageBubble';
import { COLORS } from '../utils/constants';
import { useVoiceInput } from '../services/voiceService';

export default function ChatScreen({ baby, onBack }) {
  const {
    motherProfile,
    logs,
    setLogs: setGlobalLogs,
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
  // Voice input
  const {
    isListening, partialText, finalText,
    startListening, stopListening, cancelListening,
    isAvailable: voiceAvailable, error: voiceError
  } = useVoiceInput();

  // When voice finalText arrives, put it in input field for review
  useEffect(() => {
    if (finalText) {
      setInputText(prev => prev ? prev + ' ' + finalText : finalText);
    }
  }, [finalText]);

  // Show voice error briefly
  useEffect(() => {
    if (voiceError) {
      Alert.alert('🎤', voiceError);
    }
  }, [voiceError]);

  useEffect(() => {
    initializeChat();
    return () => {
      // Cleanup: abort any ongoing stream on unmount
      if (abortRef.current) abortRef.current();
    };
  }, []);

  const initializeChat = async () => {
    // Get pre-computed assessments from intelligence service
    const aiContext = getAIContext({
      baby, motherProfile, logs, todayMotherLog,
      motherLogHistory, vaccineStatus, growthMeasurements,
      epdsData: null, epiSchedule: BD_EPI_SCHEDULE,
    });

    // Also build legacy context for opening message and suggested questions
    const legacyContext = await buildFullContext({
      baby, motherProfile, logs, todayMotherLog,
      motherLogHistory, vaccineStatus, growthMeasurements
    });

    contextRef.current = { ...legacyContext, aiContext };

    if (legacyContext.suggestedQuestions && legacyContext.suggestedQuestions.length > 0) {
      setSuggestedQuestions(legacyContext.suggestedQuestions);
    }

    // Load saved conversation (if from today)
    try {
      const saved = await AsyncStorage.getItem('chat_messages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.date === new Date().toDateString() && parsed.messages?.length > 0) {
          setMessages(parsed.messages);
          return;
        }
      }
    } catch (e) {
      console.log('No saved chat to load');
    }

    // No saved conversation — show fresh opening message
    const openingText = buildOpeningMessage(legacyContext);

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
     // Get pre-computed assessments from intelligence service
     const aiContext = getAIContext({
      baby, motherProfile, logs, todayMotherLog,
      motherLogHistory, vaccineStatus, growthMeasurements,
      epdsData: null, epiSchedule: BD_EPI_SCHEDULE,
    });

    // Build legacy context for prompt compatibility
    const freshContext = await buildFullContext({
      baby, motherProfile, logs, todayMotherLog,
      motherLogHistory, vaccineStatus, growthMeasurements
    });

    // Merge: legacy context + pre-computed assessments
    contextRef.current = { ...freshContext, aiContext };

    // Build prompt with pre-computed assessments injected
    const systemPrompt = buildHafsaPrompt(freshContext, aiContext.assessments);

      const conversationHistory = messages
        .filter(m => !m.isWelcome)
        .concat([newUserMsg])
        .map(msg => ({ role: msg.role, content: msg.content }));

      // Auto-log from user message (question-aware)
      // Pass current logs so auto-logger works with fresh data
      const autoLogResult = await processAutoLog(userMessage, baby.id, logs);

     // Sync auto-logged data to AppContext so HomeScreen and BabyHub see it
     if (autoLogResult.logged && autoLogResult.updatedLogs) {
      setGlobalLogs(autoLogResult.updatedLogs);
    } 

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
            // Save conversation to AsyncStorage
            saveConversation([...messages, newUserMsg, hafsaMsg]);
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
        saveConversation([...messages, hafsaMsg]);
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
  const saveConversation = async (msgs) => {
    try {
      await AsyncStorage.setItem('chat_messages', JSON.stringify({
        date: new Date().toDateString(),
        messages: msgs.slice(-30)
      }));
    } catch (e) {
      console.log('Error saving chat:', e);
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
        {onBack && (
          <TouchableOpacity
            onPress={() => {
              if (abortRef.current) abortRef.current();
              onBack();
            }}
            style={{ marginRight: 12, padding: 4 }}
          >
            <Text style={{ fontSize: 24 }}>←</Text>
          </TouchableOpacity>
        )}

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

        {/* VOICE RECORDING INDICATOR */}
        {isListening && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: '#FFEBEE',
            borderTopWidth: 1,
            borderTopColor: '#FFCDD2',
          }}>
            <Text style={{ fontSize: 16, marginRight: 8 }}>🔴</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, color: '#D32F2F', fontWeight: 'bold' }}>
                শুনছি... বলুন
              </Text>
              {partialText ? (
                <Text style={{ fontSize: 15, color: '#333', marginTop: 4, fontStyle: 'italic' }}>
                  {partialText}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={cancelListening}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                backgroundColor: '#FFCDD2',
                borderRadius: 12,
              }}
            >
              <Text style={{ fontSize: 13, color: '#D32F2F', fontWeight: 'bold' }}>বাতিল</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* INPUT */}
        <View style={{
          flexDirection: 'row',
          padding: 12,
          paddingHorizontal: 16,
          backgroundColor: 'white',
          borderTopWidth: 1,
          borderTopColor: '#E0E0E0',
          alignItems: 'flex-end',
        }}>
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder={isListening ? 'শুনছি...' : 'মেসেজ লিখুন বা 🎤 চাপুন...'}
            placeholderTextColor="#999"
            style={{
              flex: 1,
              backgroundColor: isListening ? '#FFF3E0' : '#F5F5F5',
              borderRadius: 24,
              paddingHorizontal: 16,
              paddingVertical: 12,
              fontSize: 16,
              marginRight: 8,
              maxHeight: 100,
              borderWidth: isListening ? 1.5 : 0,
              borderColor: isListening ? '#FF9800' : 'transparent',
            }}
            multiline
            editable={!loading && !isListening}
            onSubmitEditing={() => handleSend()}
          />

          {/* MICROPHONE BUTTON — shows when input is empty and not loading */}
          {voiceAvailable && !inputText.trim() && !loading && !isListening && (
            <TouchableOpacity
              onPress={startListening}
              style={{
                backgroundColor: '#FFF3E0',
                width: 48,
                height: 48,
                borderRadius: 24,
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 8,
                borderWidth: 1.5,
                borderColor: '#FF9800',
              }}
            >
              <Text style={{ fontSize: 22 }}>🎤</Text>
            </TouchableOpacity>
          )}

          {/* STOP RECORDING BUTTON — shows when listening */}
          {isListening && (
            <TouchableOpacity
              onPress={stopListening}
              style={{
                backgroundColor: '#D32F2F',
                width: 48,
                height: 48,
                borderRadius: 24,
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 8,
              }}
            >
              <Text style={{ fontSize: 18, color: 'white' }}>⏹</Text>
            </TouchableOpacity>
          )}

          {/* SEND BUTTON */}
          <TouchableOpacity
            onPress={() => handleSend()}
            disabled={loading || !inputText.trim() || isListening}
            style={{
              backgroundColor: loading || !inputText.trim() || isListening ? '#BDBDBD' : COLORS.primary,
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