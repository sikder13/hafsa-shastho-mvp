// App.js
// Root component — Auth check → Onboarding → Main App
// Flow: Auth (phone OTP) → Onboarding (baby + mother) → TabNavigator

import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { AppProvider, useApp } from './context/AppContext';
import { COLORS } from './utils/constants';
import { StatusBar } from 'expo-status-bar';
import AuthScreen from './screens/AuthScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import TabNavigator from './navigation/TabNavigator';
import { supabase } from './supabaseClient';
import {
  processSyncQueue,
  syncProfile,
  syncBaby,
  createTrialSubscription,
  recordConsent,
  hydrateFromCloud
} from './services/supabaseService';

function AppContent() {
  const {
    baby, saveBabyProfile, saveMotherProfile, loading,
    isAuthenticated, setIsAuthenticated, reloadAllData
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

      // If already logged in, process sync queue
      if (existingSession?.user) {
        processSyncQueue().catch(e => console.log('Queue on start:', e.message));
      }
    });

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setIsAuthenticated(!!newSession?.user);

        if (event === 'SIGNED_IN' && newSession?.user) {
          console.log('✅ User signed in:', newSession.user.id);

          // Try to hydrate existing data from cloud
          const hydration = await hydrateFromCloud();
          if (hydration.success && hydration.data?.profile) {
            // Returning user — reload local data
            await reloadAllData();
          }

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

  // Show loading while checking auth
  if (authLoading || loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
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
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}