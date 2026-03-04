// screens/ChatScreen.js
// Production chat interface with full Hafsa integration

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sendMessageToClaude } from '../services/claudeAPI';
import { buildHafsaPrompt, detectEmergency } from '../services/hafsaPrompt';
import { buildBabyContext } from '../utils/contextBuilder';
import { processAutoLog, formatAutoLogConfirmation } from '../services/autoLogger';
import MessageBubble from '../components/MessageBubble';

export default function ChatScreen({ baby, onBack }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [babyContext, setBabyContext] = useState(null);
  const scrollViewRef = useRef(null);

  useEffect(() => {
    initializeChat();
  }, []);

  const initializeChat = async () => {
    // Load baby context
    const context = await buildBabyContext(baby);
    setBabyContext(context);
    
    // Add welcome message
    const welcomeMessage = {
      id: Date.now(),
      role: 'assistant',
      content: `আসসালামু আলাইকুম! আমি হাফসা আপা। ${baby.name} এর ব্যাপারে যেকোনো প্রশ্ন করুন। 💚`,
      timestamp: new Date(),
      isWelcome: true
    };
    
    setMessages([welcomeMessage]);
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    
    const userMessage = inputText.trim();
    setInputText('');
    
    // Check for emergency keywords
    if (detectEmergency(userMessage)) {
      Alert.alert(
        '⚠️ জরুরি',
        'আপনার শিশুকে এখনই ডাক্তার দেখান বা জরুরি সেবা নিন।\n\nজরুরি লক্ষণ গুরুত্বপূর্ণ।',
        [
          { text: 'ঠিক আছে', style: 'cancel' },
          { 
            text: '📞 জরুরি সেবা', 
            onPress: () => {
              Alert.alert('জরুরি সেবা', '৯৯৯ এ কল করুন');
            }
          }
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
    
    // Scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
    
    try {
      // Build system prompt with current context
      const systemPrompt = buildHafsaPrompt(babyContext);
      
      // Format conversation for Claude
      const conversationHistory = messages
        .filter(m => !m.isWelcome) // Exclude welcome message from history
        .concat([newUserMsg])
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));
      
      // Send to Claude
      const result = await sendMessageToClaude(conversationHistory, systemPrompt);
      
      if (result.success) {
        // CRITICAL FIX: Process auto-logging from USER'S message, not Hafsa's response!
        const autoLogResult = await processAutoLog(userMessage, baby.id);
        
        // Create Hafsa's message
        const hafsaMsg = {
          id: Date.now() + 1,
          role: 'assistant',
          content: result.message,
          timestamp: new Date(),
          autoLogged: autoLogResult.logged,
          autoLogMessage: autoLogResult.logged ? 
            formatAutoLogConfirmation(autoLogResult.activities) : null
        };
        
        setMessages(prev => [...prev, hafsaMsg]);
        
        // Refresh context after auto-logging
        if (autoLogResult.logged) {
          const updatedContext = await buildBabyContext(baby);
          setBabyContext(updatedContext);
        }
        
        // Scroll to bottom
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
        
      } else {
        Alert.alert('ত্রুটি', result.message);
      }
      
    } catch (error) {
      Alert.alert('ত্রুটি', 'কিছু সমস্যা হয়েছে। আবার চেষ্টা করুন।');
      console.error('Chat error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9F9F9' }}>
      
      {/* HEADER */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#E8F5E9',
        borderBottomWidth: 1,
        borderBottomColor: '#C8E6C9'
      }}>
        <TouchableOpacity 
          onPress={onBack} 
          style={{ marginRight: 12, padding: 4 }}
        >
          <Text style={{ fontSize: 24 }}>←</Text>
        </TouchableOpacity>
        
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 24, marginRight: 8 }}>💚</Text>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#2E7D32' }}>
              হাফসা আপা
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: '#4CAF50', marginTop: 2 }}>
            {baby.name} এর AI সহায়ক
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
          contentContainerStyle={{ padding: 16 }}
          onContentSizeChange={() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }}
        >
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isUser={msg.role === 'user'}
            />
          ))}
          
          {loading && (
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
              <ActivityIndicator color="#4CAF50" size="small" />
              <Text style={{ marginLeft: 12, color: '#666', fontSize: 14 }}>
                হাফসা আপা টাইপ করছে...
              </Text>
            </View>
          )}
        </ScrollView>

        {/* INPUT */}
        <View style={{
          flexDirection: 'row',
          padding: 16,
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
            onSubmitEditing={handleSend}
          />
          
          <TouchableOpacity
            onPress={handleSend}
            disabled={loading || !inputText.trim()}
            style={{
              backgroundColor: loading || !inputText.trim() ? '#BDBDBD' : '#4CAF50',
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
