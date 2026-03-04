import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { AppProvider, useApp } from './context/AppContext';
import { COLORS } from './utils/constants';

// Import screens
import OnboardingScreen from './screens/OnboardingScreen';
import HomeScreen from './screens/HomeScreen';
import VaccineScreen from './screens/VaccineScreen';
import GrowthScreen from './screens/GrowthScreen';
import DailyLogScreen from './screens/DailyLogScreen';
import ChatScreen from './screens/ChatScreen';

// Inner app that has access to context
function AppContent() {
  const { baby, saveBabyProfile, saveMotherProfile, resetAllData, loading } = useApp();
  const [currentScreen, setCurrentScreen] = useState('home');

  // Show loading spinner while data loads from AsyncStorage
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // No baby profile yet — show onboarding
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

  // Screen routing (will be replaced by React Navigation in Phase 4)
  if (currentScreen === 'vaccine') {
    return (
      <>
        <VaccineScreen baby={baby} onBack={() => setCurrentScreen('home')} />
        <StatusBar style="auto" />
      </>
    );
  }

  if (currentScreen === 'growth') {
    return (
      <>
        <GrowthScreen baby={baby} onBack={() => setCurrentScreen('home')} />
        <StatusBar style="auto" />
      </>
    );
  }

  if (currentScreen === 'dailylog') {
    return (
      <>
        <DailyLogScreen baby={baby} onBack={() => setCurrentScreen('home')} />
        <StatusBar style="auto" />
      </>
    );
  }

  if (currentScreen === 'chat') {
    return (
      <>
        <ChatScreen baby={baby} onBack={() => setCurrentScreen('home')} />
        <StatusBar style="auto" />
      </>
    );
  }

  // Default: Home screen
  return (
    <>
      <HomeScreen
        baby={baby}
        onNavigateVaccine={() => setCurrentScreen('vaccine')}
        onNavigateGrowth={() => setCurrentScreen('growth')}
        onNavigateDailyLog={() => setCurrentScreen('dailylog')}
        onNavigateChat={() => setCurrentScreen('chat')}
        onReset={async () => {
          await resetAllData();
          setCurrentScreen('home');
        }}
      />
      <StatusBar style="auto" />
    </>
  );
}

// Main app wrapped in AppProvider
export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}