/**
 * Hafsa Sastho (হাফসা স্বাস্থ্য)
 * Bangladesh's First AI Companion for Postpartum and Early Childhood Care
 * Copyright © 2026 Nahl Technologies Inc. All rights reserved.
 *
 * @author Udaay Sikder — Co-Founder & Dev
 */
// screens/AuthScreen.js
// Authentication — Email/Password for MVP testing
// Production: Will add phone OTP when Twilio Message Service is configured
//
// Flow: Sign Up or Sign In → Supabase Auth → App.js detects session → Onboarding or Main App

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabaseClient';
import { COLORS } from '../utils/constants';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(true); // Default to sign up for new users
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('', 'ইমেইল এবং পাসওয়ার্ড দিন');
      return;
    }

    if (password.length < 6) {
      Alert.alert('', 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        // Sign up
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password: password.trim(),
        });

        if (error) {
          if (error.message.includes('already registered')) {
            Alert.alert('', 'এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট আছে। লগইন করুন।');
            setIsSignUp(false);
          } else {
            Alert.alert('ত্রুটি', error.message);
          }
        }
        // Success: App.js onAuthStateChange will handle navigation
      } else {
        // Sign in
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password: password.trim(),
        });

        if (error) {
          if (error.message.includes('Invalid login')) {
            Alert.alert('', 'ইমেইল বা পাসওয়ার্ড ভুল। আবার চেষ্টা করুন।');
          } else {
            Alert.alert('ত্রুটি', error.message);
          }
        }
        // Success: App.js onAuthStateChange will handle navigation
      }
    } catch (error) {
      Alert.alert('ত্রুটি', 'কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন।');
      console.error('Auth error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo / Branding */}
          <View style={{ alignItems: 'center', marginBottom: 40 }}>
            <Image source={require('../assets/hafsa-logo.png')} style={{ width: 80, height: 92, alignSelf: 'center', marginBottom: 12 }} resizeMode="contain" />
            <Text style={{
              fontSize: 32,
              fontWeight: 'bold',
              color: COLORS.primary,
              marginBottom: 8,
            }}>
              হাফসা স্বাস্থ্য
            </Text>
            <Text style={{
              fontSize: 16,
              color: COLORS.gray,
              textAlign: 'center',
              lineHeight: 24,
            }}>
              মা ও শিশুর যত্নে আপনার AI সহায়ক
            </Text>
          </View>

          {/* Auth Form */}
          <View style={{
            backgroundColor: '#F9F9F9',
            borderRadius: 16,
            padding: 24,
            borderWidth: 1,
            borderColor: '#E8E8E8',
          }}>
            <Text style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: COLORS.dark,
              marginBottom: 24,
              textAlign: 'center',
            }}>
              {isSignUp ? 'অ্যাকাউন্ট তৈরি করুন' : 'লগইন করুন'}
            </Text>

            {/* Email */}
            <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.dark, marginBottom: 8 }}>
              ইমেইল
            </Text>
            <TextInput
              style={{
                borderWidth: 1.5,
                borderColor: email ? COLORS.primary : '#E0E0E0',
                borderRadius: 12,
                padding: 14,
                fontSize: 16,
                backgroundColor: '#FFFFFF',
                marginBottom: 20,
              }}
              placeholder="your@email.com"
              placeholderTextColor="#BDBDBD"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Password */}
            <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.dark, marginBottom: 8 }}>
              পাসওয়ার্ড
            </Text>
            <TextInput
              style={{
                borderWidth: 1.5,
                borderColor: password ? COLORS.primary : '#E0E0E0',
                borderRadius: 12,
                padding: 14,
                fontSize: 16,
                backgroundColor: '#FFFFFF',
                marginBottom: 28,
              }}
              placeholder="কমপক্ষে ৬ অক্ষর"
              placeholderTextColor="#BDBDBD"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            {/* Auth Button */}
            <TouchableOpacity
              onPress={handleAuth}
              disabled={loading}
              style={{
                backgroundColor: COLORS.primary,
                padding: 16,
                borderRadius: 12,
                alignItems: 'center',
                shadowColor: COLORS.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 5,
              }}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' }}>
                  {isSignUp ? 'অ্যাকাউন্ট তৈরি করুন' : 'লগইন করুন'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Toggle Sign Up / Sign In */}
          <TouchableOpacity
            onPress={() => setIsSignUp(!isSignUp)}
            style={{ marginTop: 20, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 15, color: COLORS.primary }}>
              {isSignUp
                ? 'আগেই অ্যাকাউন্ট আছে? লগইন করুন'
                : 'নতুন? অ্যাকাউন্ট তৈরি করুন'}
            </Text>
          </TouchableOpacity>

          {/* Footer */}
          <Text style={{
            fontSize: 12,
            color: COLORS.lightGray,
            textAlign: 'center',
            marginTop: 32,
            lineHeight: 18,
          }}>
            অ্যাকাউন্ট তৈরি করে আপনি আমাদের{'\n'}ব্যবহারের শর্তাবলী ও গোপনীয়তা নীতিতে সম্মত হচ্ছেন।
          </Text>

          <Text style={{ fontSize: 11, color: '#BDBDBD', textAlign: 'center', marginTop: 24 }}>
            Nahl Technologies Inc.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}