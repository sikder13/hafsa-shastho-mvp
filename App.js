import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Import screens
import BabyProfileScreen from './screens/BabyProfileScreen';
import HomeScreen from './screens/HomeScreen';
import VaccineScreen from './screens/VaccineScreen';
import GrowthScreen from './screens/GrowthScreen';
import DailyLogScreen from './screens/DailyLogScreen';
import ChatTestScreen from './screens/ChatTestScreen';

// Supabase client (not actively used but kept for future)
const supabase = createClient(
  'https://placeholder.supabase.co',
  'placeholder-key'
);

const mockUserId = 'mock-user-123';

export default function App() {
  const [user, setUser] = useState(null);
  const [babyProfile, setBabyProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState('home');

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    const mockUser = { id: mockUserId };
    setUser(mockUser);
    await checkBabyProfile(mockUserId);
  };

  const checkBabyProfile = async (userId) => {
    try {
      const saved = await AsyncStorage.getItem('baby_profile');
      
      if (saved) {
        const profile = JSON.parse(saved);
        setBabyProfile(profile);
      }
    } catch (error) {
      console.error('Error loading baby profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileCreated = async (newProfile) => {
    try {
      setBabyProfile(newProfile);
      await AsyncStorage.setItem('baby_profile', JSON.stringify(newProfile));
    } catch (error) {
      console.error('Error saving baby profile:', error);
    }
  };

  const handleReset = () => {
    setUser(null);
    setBabyProfile(null);
    setCurrentScreen('home');
    
    const mockUser = { id: mockUserId };
    setUser(mockUser);
    checkBabyProfile(mockUserId);
  };

  if (loading) {
    return null;
  }

  if (!babyProfile) {
    return (
      <>
        <BabyProfileScreen onProfileCreated={handleProfileCreated} />
        <StatusBar style="auto" />
      </>
    );
  }

  if (currentScreen === 'vaccine') {
    return (
      <>
        <VaccineScreen baby={babyProfile} onBack={() => setCurrentScreen('home')} />
        <StatusBar style="auto" />
      </>
    );
  }

  if (currentScreen === 'growth') {
    return (
      <>
        <GrowthScreen baby={babyProfile} onBack={() => setCurrentScreen('home')} />
        <StatusBar style="auto" />
      </>
    );
  }

  if (currentScreen === 'dailylog') {
    return (
      <>
        <DailyLogScreen 
          baby={babyProfile} 
          onBack={() => setCurrentScreen('home')} 
        />
        <StatusBar style="auto" />
      </>
    );
  }

  if (currentScreen === 'chattest') {
    return (
      <>
        <ChatTestScreen 
          onBack={() => setCurrentScreen('home')} 
        />
        <StatusBar style="auto" />
      </>
    );
  }

  return (
    <>
      <HomeScreen 
        baby={babyProfile} 
        onNavigateVaccine={() => setCurrentScreen('vaccine')}
        onNavigateGrowth={() => setCurrentScreen('growth')}
        onNavigateDailyLog={() => setCurrentScreen('dailylog')}
        onNavigateChatTest={() => setCurrentScreen('chattest')}
        onReset={handleReset}
      />
      <StatusBar style="auto" />
    </>
  );
}