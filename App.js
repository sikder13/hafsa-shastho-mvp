// App.js
// Root component — AppProvider + NavigationContainer
// All navigation is handled by React Navigation now

import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { AppProvider, useApp } from './context/AppContext';
import { COLORS } from './utils/constants';
import { StatusBar } from 'expo-status-bar';

import OnboardingScreen from './screens/OnboardingScreen';
import TabNavigator from './navigation/TabNavigator';

function AppContent() {
  const { baby, saveBabyProfile, saveMotherProfile, loading } = useApp();

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