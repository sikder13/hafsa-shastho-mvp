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

export default function HomeScreen({ baby, onNavigateVaccine, onNavigateGrowth, onNavigateDailyLog, onReset, onNavigateChatTest }) {
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
      const savedLogs = await AsyncStorage.getItem(`daily_logs_${baby.id}`);
      if (savedLogs) {
        setLogs(JSON.parse(savedLogs));
      }
    } catch (error) {
      console.error('Error loading logs:', error);
    }
  };

  const getTodayCount = (type) => {
    const today = new Date().toDateString();
    return logs[type].filter(log => {
      return new Date(log.timestamp).toDateString() === today;
    }).length;
  };

  const toBengaliNumber = (num) => {
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(num).split('').map(d => bengaliDigits[parseInt(d)] || d).join('');
  };

  const calculateAgeBengali = (birthDate) => {
    const birth = new Date(birthDate);
    const today = new Date();
    const diffTime = Math.abs(today - birth);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    const months = Math.floor(diffDays / 30);
    const days = diffDays % 30;
    
    if (months === 0) {
      return `${toBengaliNumber(diffDays)} দিন`;
    } else if (months < 12) {
      return `${toBengaliNumber(months)} মাস ${toBengaliNumber(days)} দিন`;
    } else {
      const years = Math.floor(months / 12);
      const remainingMonths = months % 12;
      return `${toBengaliNumber(years)} বছর ${toBengaliNumber(remainingMonths)} মাস`;
    }
  };

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
              await AsyncStorage.clear();
              
              Alert.alert(
                '✅ সম্পন্ন',
                'সব ডেটা মুছে ফেলা হয়েছে। অ্যাপ রিস্টার্ট করুন।',
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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'সুপ্রভাত';
    if (hour < 17) return 'শুভ অপরাহ্ন';
    if (hour < 21) return 'শুভ সন্ধ্যা';
    return 'শুভ রাত্রি';
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9F9F9' }}>
      
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
            backgroundColor: '#F44336',
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
          backgroundColor: '#E8F5E9',
          padding: 24,
          borderRadius: 16,
          marginBottom: 32,
          borderLeftWidth: 6,
          borderLeftColor: '#4CAF50'
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 36, marginRight: 12 }}>💚</Text>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#2E7D32' }}>
              হাফসা আপা বলছে
            </Text>
          </View>
          
          <Text style={{ fontSize: 18, color: '#1B5E20', marginBottom: 12, lineHeight: 26 }}>
            {getGreeting()}! আসসালামু আলাইকুম!
          </Text>
          
          <Text style={{ fontSize: 17, color: '#2E7D32', marginBottom: 16, lineHeight: 24 }}>
            আজ {baby.name} এর {calculateAgeBengali(baby.birth_date)} হলো! 🎉
          </Text>
          
          <Text style={{ fontSize: 15, color: '#388E3C', lineHeight: 22 }}>
            এই বয়সে শিশুরা হাসতে শুরু করে। {baby.name} এর সাথে বেশি কথা বলুন এবং চোখে চোখ রেখে কথা বলুন! 💬
          </Text>
          
          <TouchableOpacity
            onPress={() => {
              if (onNavigateChatTest) {
                onNavigateChatTest();
              }
            }}
            style={{
              marginTop: 16,
              backgroundColor: '#4CAF50',
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

        {/* FEATURES SECTION HEADER */}
        <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 20, color: '#212121' }}>
          📋 সব ফিচার
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
                backgroundColor: 'white',
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
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#212121', marginBottom: 8 }}>
                দৈনিক লগ
              </Text>
              <Text style={{ fontSize: 14, color: '#666', marginBottom: 12 }}>
                আজ:
              </Text>
              <Text style={{ fontSize: 13, color: '#4CAF50' }}>
                🍼 {toBengaliNumber(getTodayCount('feed'))} বার
              </Text>
              <Text style={{ fontSize: 13, color: '#2196F3' }}>
                😴 {toBengaliNumber(getTodayCount('sleep'))} বার
              </Text>
            </TouchableOpacity>

            {/* VACCINE CARD */}
            <TouchableOpacity
              onPress={onNavigateVaccine}
              style={{
                flex: 1,
                backgroundColor: 'white',
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
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#212121', marginBottom: 8 }}>
                টিকা ট্র্যাকার
              </Text>
              <Text style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
                EPI সূচি
              </Text>
              <Text style={{ fontSize: 13, color: '#FF9800', fontWeight: 'bold' }}>
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
                backgroundColor: 'white',
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
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#212121', marginBottom: 8 }}>
                বৃদ্ধি চার্ট
              </Text>
              <Text style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
                ওজন ও উচ্চতা
              </Text>
              <Text style={{ fontSize: 13, color: '#2196F3', fontWeight: 'bold' }}>
                দেখুন →
              </Text>
            </TouchableOpacity>

            {/* AI HELP CARD (Coming Soon) */}
            <TouchableOpacity
              onPress={() => Alert.alert('শীঘ্রই আসছে', 'AI সাহায্য ফিচার শীঘ্রই যোগ করা হবে! 🤖')}
              style={{
                flex: 1,
                backgroundColor: 'white',
                borderRadius: 16,
                padding: 20,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
                opacity: 0.7
              }}
            >
              <Text style={{ fontSize: 40, marginBottom: 8 }}>🤖</Text>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#212121', marginBottom: 8 }}>
                AI সাহায্য
              </Text>
              <Text style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
                শীঘ্রই আসছে
              </Text>
              <Text style={{ fontSize: 13, color: '#9E9E9E' }}>
                লক্ষণ পরীক্ষক
              </Text>
            </TouchableOpacity>

          </View>

        </View>

      </ScrollView>
    </SafeAreaView>
  );
}