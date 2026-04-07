/**
 * Hafsa Sastho (হাফসা স্বাস্থ্য)
 * Bangladesh's First AI Companion for Postpartum and Early Childhood Care
 * Copyright © 2026 Nahl Technologies Inc. All rights reserved.
 *
 * @author Udaay Sikder — Co-Founder & Dev
 */
// App.js
// Root component — Consent → Auth check → Onboarding → Main App
// Flow: Consent (one-time) → Auth → Onboarding (baby + mother) → TabNavigator

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Linking,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { AppProvider, useApp } from './context/AppContext';
import { COLORS } from './utils/constants';
import { StatusBar } from 'expo-status-bar';
import AuthScreen from './screens/AuthScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import TabNavigator from './navigation/TabNavigator';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingScreen from './components/LoadingScreen';
import {
  useFonts,
  HindSiliguri_400Regular,
  HindSiliguri_600SemiBold,
  HindSiliguri_700Bold,
} from '@expo-google-fonts/hind-siliguri';
import { supabase } from './supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
  processSyncQueue,
  createTrialSubscription,
  recordConsent,
  trackAppOpen,
} from './services/supabaseService';
import {
  setupNotificationCategories,
  requestPermissions,
  handleNotificationResponse,
} from './services/notificationService';

function AppContent() {
  const {
    baby, saveBabyProfile, saveMotherProfile, loading,
    setIsAuthenticated, hydrateFromSupabase
  } = useApp();

  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState(null);

  // Check auth state on mount + listen for changes
  useEffect(() => {
    // Check existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setIsAuthenticated(!!existingSession?.user);
      setAuthLoading(false);

      // If already logged in, process sync queue + track app open
      if (existingSession?.user) {
        processSyncQueue().catch(e => console.log('Queue on start:', e.message));
        trackAppOpen(existingSession.user.id).catch(() => {});
      }
    });

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setIsAuthenticated(!!newSession?.user);

        if (event === 'SIGNED_IN' && newSession?.user) {
          console.log('✅ User signed in:', newSession.user.id);

          // Try to hydrate existing data from cloud (returning user on new device)
          hydrateFromSupabase().catch(e => console.log('Hydration on signin:', e.message));

          // Process any queued syncs
          processSyncQueue().catch(e => console.log('Queue on signin:', e.message));
        }

        if (event === 'SIGNED_OUT') {
          console.log('👋 User signed out');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Set up notifications on mount
  useEffect(() => {
    try {
      setupNotificationCategories();
      requestPermissions();
    } catch (e) {
      console.log('Notification setup error:', e.message);
    }

    const responseListener = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

    return () => responseListener.remove();
  }, []);

  // Show loading while checking auth
  if (authLoading || loading) {
    return <LoadingScreen />;
  }

  // Step 1: Not authenticated → show login
  if (!session?.user) {
    return (
      <>
        <AuthScreen />
        <StatusBar style="auto" />
      </>
    );
  }

  // Step 2: Authenticated but no baby profile → show onboarding
  if (!baby) {
    return (
      <>
        <OnboardingScreen
          onComplete={async (babyData, motherData) => {
            // Save locally (AppContext handles Supabase sync automatically)
            await saveBabyProfile(babyData);
            await saveMotherProfile(motherData);

            // Create trial subscription
            createTrialSubscription().catch(e => console.log('Sub create:', e.message));

            // Record consent (terms + privacy + data collection)
            recordConsent('terms', '1.0', true).catch(e => console.log('Consent:', e.message));
            recordConsent('privacy', '1.0', true).catch(e => console.log('Consent:', e.message));
            recordConsent('data_collection', '1.0', true).catch(e => console.log('Consent:', e.message));
          }}
        />
        <StatusBar style="auto" />
      </>
    );
  }

  // Step 3: Authenticated + has profile → main app
  return (
    <NavigationContainer>
      <TabNavigator />
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    HindSiliguri_400Regular,
    HindSiliguri_600SemiBold,
    HindSiliguri_700Bold,
  });

  const [consentAccepted, setConsentAccepted] = useState(null); // null = loading, true/false
  const [consentChecked, setConsentChecked] = useState(false);

  // Check consent on mount — runs before anything else
  useEffect(() => {
    AsyncStorage.getItem('consent_accepted').then(val => {
      setConsentAccepted(val === 'true');
    });
  }, []);

  const handleAcceptConsent = async () => {
    await AsyncStorage.setItem('consent_accepted', 'true');
    setConsentAccepted(true);

    // Record consents to Supabase (fire-and-forget, will work once user logs in)
    recordConsent('privacy_policy', '1.0', true).catch(e => console.log('Consent:', e.message));
    recordConsent('medical_disclaimer', '1.0', true).catch(e => console.log('Consent:', e.message));
    recordConsent('terms_of_service', '1.0', true).catch(e => console.log('Consent:', e.message));
    recordConsent('anonymized_research', '1.0', true).catch(e => console.log('Consent:', e.message));
  };

  if (!fontsLoaded || consentAccepted === null) {
    return <LoadingScreen />;
  }

  // Consent not accepted → show consent modal (blocks everything)
  if (consentAccepted === false) {
    return (
      <>
        <Modal visible={true} animationType="slide">
          <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
            <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: COLORS.primary, textAlign: 'center', marginTop: 20, marginBottom: 8 }}>
                হাফসা স্বাস্থ্য
              </Text>
              <Text style={{ fontSize: 14, color: COLORS.gray, textAlign: 'center', marginBottom: 28 }}>
                ব্যবহার শুরু করার আগে নিচের তথ্যগুলো পড়ুন
              </Text>

              {/* Medical Disclaimer */}
              <View style={{ backgroundColor: '#FFF3E0', borderRadius: 12, padding: 16, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#FF9800' }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#E65100', marginBottom: 8 }}>
                  ⚕️ চিকিৎসা সংক্রান্ত দাবিত্যাগ
                </Text>
                <Text style={{ fontSize: 14, color: '#4E342E', lineHeight: 22 }}>
                  হাফসা একটি AI সহায়ক — ডাক্তার নয়। এই অ্যাপের তথ্য শুধুমাত্র সাধারণ স্বাস্থ্য সচেতনতার জন্য। কোনো জরুরি অবস্থায় বা চিকিৎসা সিদ্ধান্তে সবসময় ডাক্তারের পরামর্শ নিন।
                </Text>
              </View>

              {/* Data Collection */}
              <View style={{ backgroundColor: '#E3F2FD', borderRadius: 12, padding: 16, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#1976D2' }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1565C0', marginBottom: 8 }}>
                  🔒 ডেটা সংগ্রহ
                </Text>
                <Text style={{ fontSize: 14, color: '#1A237E', lineHeight: 22 }}>
                  আপনার তথ্য প্রথমে আপনার ফোনে সংরক্ষিত হয় এবং নিরাপদে ক্লাউডে ব্যাকআপ হয়। আমরা আপনার ব্যক্তিগত তথ্য তৃতীয় পক্ষের কাছে বিক্রি করি না।
                </Text>
              </View>

              {/* Anonymized Research */}
              <View style={{ backgroundColor: '#F3E5F5', borderRadius: 12, padding: 16, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#7B1FA2' }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#6A1B9A', marginBottom: 8 }}>
                  📊 গবেষণায় ব্যবহার
                </Text>
                <Text style={{ fontSize: 14, color: '#4A148C', lineHeight: 22 }}>
                  আপনার তথ্য বেনামে (anonymized) মা ও শিশু স্বাস্থ্য গবেষণায় ব্যবহার হতে পারে। কোনো ব্যক্তিগত পরিচয় প্রকাশ করা হবে না।
                </Text>
              </View>

              {/* User Rights */}
              <View style={{ backgroundColor: '#E8F5E9', borderRadius: 12, padding: 16, marginBottom: 24, borderLeftWidth: 4, borderLeftColor: '#388E3C' }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#2E7D32', marginBottom: 8 }}>
                  ✅ আপনার অধিকার
                </Text>
                <Text style={{ fontSize: 14, color: '#1B5E20', lineHeight: 22 }}>
                  আপনি যেকোনো সময় আপনার সব তথ্য ডাউনলোড বা মুছে ফেলতে পারবেন। সেটিংস থেকে অ্যাকাউন্ট মুছে দিলে সব ডেটা চিরতরে মুছে যাবে।
                </Text>
              </View>

              {/* Links */}
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 24 }}>
                <TouchableOpacity onPress={() => Linking.openURL('https://nahltech.com/privacy')}>
                  <Text style={{ fontSize: 14, color: COLORS.primary, textDecorationLine: 'underline' }}>
                    গোপনীয়তা নীতি
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => Linking.openURL('https://nahltech.com/terms')}>
                  <Text style={{ fontSize: 14, color: COLORS.primary, textDecorationLine: 'underline' }}>
                    শর্তাবলী
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Checkbox */}
              <TouchableOpacity
                onPress={() => setConsentChecked(!consentChecked)}
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingHorizontal: 4 }}
              >
                <View style={{
                  width: 24, height: 24, borderRadius: 6, borderWidth: 2,
                  borderColor: consentChecked ? COLORS.primary : '#BDBDBD',
                  backgroundColor: consentChecked ? COLORS.primary : '#FFFFFF',
                  alignItems: 'center', justifyContent: 'center', marginRight: 12,
                }}>
                  {consentChecked && <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' }}>✓</Text>}
                </View>
                <Text style={{ fontSize: 14, color: COLORS.dark, flex: 1, lineHeight: 20 }}>
                  আমি উপরের তথ্যগুলো পড়েছি এবং সম্মত আছি
                </Text>
              </TouchableOpacity>

              {/* Accept Button */}
              <TouchableOpacity
                onPress={handleAcceptConsent}
                disabled={!consentChecked}
                style={{
                  backgroundColor: consentChecked ? COLORS.primary : '#E0E0E0',
                  padding: 16, borderRadius: 12, alignItems: 'center',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' }}>
                  সম্মত হয়ে শুরু করুন
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>
        <StatusBar style="auto" />
      </>
    );
  }

  // Consent accepted → show the app
  return (
    <AppProvider>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </AppProvider>
  );
}
