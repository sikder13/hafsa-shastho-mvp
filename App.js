// App.js
// Root component — AppProvider + NavigationContainer
// All navigation is handled by React Navigation now

import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { AppProvider, useApp } from './context/AppContext';
import { COLORS } from './utils/constants';
import { StatusBar } from 'expo-status-bar';
import OnboardingScreen from './screens/OnboardingScreen';
import TabNavigator from './navigation/TabNavigator';
import { processSyncQueue, onAuthStateChange } from './services/supabaseService';

function AppContent() {
  const { baby, saveBabyProfile, saveMotherProfile, loading, setIsAuthenticated } = useApp();

  // Listen for auth state changes & process sync queue
  useEffect(() => {
    const unsubscribe = onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session?.user);
      if (event === 'SIGNED_IN' && session?.user) {
        // User just signed in — process any queued syncs
        processSyncQueue().catch(e => console.log('Queue on signin:', e.message));
      }
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // No baby profile — show onboarding (outside navigation)
  if (!baby) {
    return (
      <>
        <OnboardingScreen
          onComplete={async (babyData, motherData) => {
            await saveBabyProfile(babyData);
            await saveMotherProfile(motherData);
          }}
        />
        <StatusBar style="auto" />
      </>
    );
  }

  // Main app with tab navigation
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