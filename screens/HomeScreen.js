import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { toBengaliNumber, calculateAge, getGreeting, countToday } from '../utils/helpers';
import { COLORS, STORAGE_KEYS } from '../utils/constants';

export default function HomeScreen({ baby, onNavigateVaccine, onNavigateGrowth, onNavigateDailyLog, onReset, onNavigateChat, onNavigateMotherCheckin }) {
  const [logs, setLogs] = useState({
    feed: [],
    sleep: [],
    diaper: [],
    food: []
  });

  useEffect(() => {
    loadLogs();
  }, [baby.id]);

  const loadLogs = async () => {
    try {
      const savedLogs = await AsyncStorage.getItem(STORAGE_KEYS.dailyLogs(baby.id));
      if (savedLogs) {
        setLogs(JSON.parse(savedLogs));
      }
    } catch (error) {
      console.error('Error loading logs:', error);
    }
  };

  const getTodayCount = (type) => {
    return countToday(logs[type]);
  };

  const ageInfo = calculateAge(baby.birth_date);

  const handleResetApp = () => {
    Alert.alert(
      '⚠️ রিসেট করুন',
      'সব ডেটা মুছে ফেলা হবে এবং অ্যাপ নতুন করে শুরু হবে।\n\nএটি শুধুমাত্র টেস্টিং এর জন্য।\n\nনিশ্চিত?',
      [
        { 
          text: 'না', 
          style: 'cancel' 
        },
        {
          text: 'হ্যাঁ, রিসেট করুন',
          style: 'destructive',
          onPress: async () => {
            try {
              const allKeys = await AsyncStorage.getAllKeys();
              if (allKeys.length > 0) {
                await AsyncStorage.multiRemove(allKeys);
              }
              
              Alert.alert(
                '✅ সম্পন্ন',
                'সব ডেটা মুছে ফেলা হয়েছে।',
                [
                  {
                    text: 'ঠিক আছে',
                    onPress: () => {
                      if (onReset) {
                        onReset();
                      }
                    }
                  }
                ]
              );
            } catch (error) {
              Alert.alert('ত্রুটি', 'ডেটা মুছতে সমস্যা হয়েছে');
              console.error('Reset error:', error);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      
      {/* DEVELOPMENT RESET BUTTON */}
      <View style={{
        position: 'absolute',
        top: 50,
        right: 20,
        zIndex: 999
      }}>
        <TouchableOpacity
          onPress={handleResetApp}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: COLORS.danger,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 5
          }}
        >
          <Text style={{ fontSize: 20 }}>🔄</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
        
        {/* HAFSA AAPA GREETING CARD */}
        <View style={{
          backgroundColor: COLORS.primaryLight,
          padding: 24,
          borderRadius: 16,
          marginBottom: 24,
          borderLeftWidth: 6,
          borderLeftColor: COLORS.primary
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 36, marginRight: 12 }}>💚</Text>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: COLORS.primaryDark }}>
              হাফসা আপা বলছে
            </Text>
          </View>
          
          <Text style={{ fontSize: 18, color: COLORS.primaryDarker, marginBottom: 12, lineHeight: 26 }}>
            {getGreeting()}! আসসালামু আলাইকুম!
          </Text>
          
          <Text style={{ fontSize: 17, color: COLORS.primaryDark, marginBottom: 16, lineHeight: 24 }}>
            আজ {baby.name} এর {ageInfo.bengaliAge} হলো! 🎉
          </Text>
          
          <Text style={{ fontSize: 15, color: '#388E3C', lineHeight: 22 }}>
            এই বয়সে শিশুরা হাসতে শুরু করে। {baby.name} এর সাথে বেশি কথা বলুন এবং চোখে চোখ রেখে কথা বলুন! 💬
          </Text>
          
          <TouchableOpacity
            onPress={() => {
              if (onNavigateChat) {
                onNavigateChat();
              }
            }}
            style={{
              marginTop: 16,
              backgroundColor: COLORS.primary,
              padding: 14,
              borderRadius: 10,
              alignItems: 'center'
            }}
          >
            <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
              💬 আপার সাথে কথা বলুন
            </Text>
          </TouchableOpacity>
        </View>

        {/* MOTHER CHECK-IN CARD — Prominent placement */}
        <TouchableOpacity
          onPress={onNavigateMotherCheckin}
          style={{
            backgroundColor: '#FFF0F3',
            borderRadius: 16,
            padding: 20,
            marginBottom: 24,
            borderLeftWidth: 6,
            borderLeftColor: COLORS.mother,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 4,
            elevation: 3
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 36, marginRight: 14 }}>🤱</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.mother, marginBottom: 4 }}>
                মায়ের দৈনিক চেক-ইন
              </Text>
              <Text style={{ fontSize: 14, color: '#AD1457', lineHeight: 20 }}>
                আজ আপনি কেমন আছেন? ট্যাপ করুন →
              </Text>
            </View>
            <Text style={{ fontSize: 24, color: COLORS.mother }}>→</Text>
          </View>
        </TouchableOpacity>

        {/* FEATURES SECTION HEADER */}
        <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 20, color: COLORS.dark }}>
          📋 শিশুর ফিচার
        </Text>

        {/* FEATURE GRID */}
        <View style={{ gap: 16 }}>
          
          {/* ROW 1: Daily Log + Vaccine */}
          <View style={{ flexDirection: 'row', gap: 16 }}>
            
            {/* DAILY LOG CARD */}
            <TouchableOpacity
              onPress={onNavigateDailyLog}
              style={{
                flex: 1,
                backgroundColor: COLORS.cardBg,
                borderRadius: 16,
                padding: 20,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3
              }}
            >
              <Text style={{ fontSize: 40, marginBottom: 8 }}>📊</Text>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.dark, marginBottom: 8 }}>
                দৈনিক লগ
              </Text>
              <Text style={{ fontSize: 14, color: COLORS.gray, marginBottom: 12 }}>
                আজ:
              </Text>
              <Text style={{ fontSize: 13, color: COLORS.feed }}>
                🍼 {toBengaliNumber(getTodayCount('feed'))} বার
              </Text>
              <Text style={{ fontSize: 13, color: COLORS.sleep }}>
                😴 {toBengaliNumber(getTodayCount('sleep'))} বার
              </Text>
            </TouchableOpacity>

            {/* VACCINE CARD */}
            <TouchableOpacity
              onPress={onNavigateVaccine}
              style={{
                flex: 1,
                backgroundColor: COLORS.cardBg,
                borderRadius: 16,
                padding: 20,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3
              }}
            >
              <Text style={{ fontSize: 40, marginBottom: 8 }}>💉</Text>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.dark, marginBottom: 8 }}>
                টিকা ট্র্যাকার
              </Text>
              <Text style={{ fontSize: 14, color: COLORS.gray, marginBottom: 8 }}>
                EPI সূচি
              </Text>
              <Text style={{ fontSize: 13, color: COLORS.vaccine, fontWeight: 'bold' }}>
                দেখুন →
              </Text>
            </TouchableOpacity>

          </View>

          {/* ROW 2: Growth + AI Help */}
          <View style={{ flexDirection: 'row', gap: 16 }}>
            
            {/* GROWTH CARD */}
            <TouchableOpacity
              onPress={onNavigateGrowth}
              style={{
                flex: 1,
                backgroundColor: COLORS.cardBg,
                borderRadius: 16,
                padding: 20,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3
              }}
            >
              <Text style={{ fontSize: 40, marginBottom: 8 }}>📈</Text>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.dark, marginBottom: 8 }}>
                বৃদ্ধি চার্ট
              </Text>
              <Text style={{ fontSize: 14, color: COLORS.gray, marginBottom: 8 }}>
                ওজন ও উচ্চতা
              </Text>
              <Text style={{ fontSize: 13, color: COLORS.growth, fontWeight: 'bold' }}>
                দেখুন →
              </Text>
            </TouchableOpacity>

            {/* AI HELP CARD */}
            <TouchableOpacity
              onPress={() => {
                if (onNavigateChat) {
                  onNavigateChat();
                }
              }}
              style={{
                flex: 1,
                backgroundColor: COLORS.cardBg,
                borderRadius: 16,
                padding: 20,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3
              }}
            >
              <Text style={{ fontSize: 40, marginBottom: 8 }}>💚</Text>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.dark, marginBottom: 8 }}>
                হাফসা আপা
              </Text>
              <Text style={{ fontSize: 14, color: COLORS.gray, marginBottom: 8 }}>
                AI সহায়ক
              </Text>
              <Text style={{ fontSize: 13, color: COLORS.primary, fontWeight: 'bold' }}>
                কথা বলুন →
              </Text>
            </TouchableOpacity>

          </View>

        </View>

      </ScrollView>
    </SafeAreaView>
  );
}