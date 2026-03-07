// screens/HomeScreen.js
// Home tab dashboard — combined mother + baby overview
// Navigation is now handled by bottom tabs, not cards

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../context/AppContext';
import { useNavigation } from '@react-navigation/native';
import { toBengaliNumber, calculateAge, getGreeting, countToday, getRecoveryStage } from '../utils/helpers';
import { COLORS, TEXT } from '../utils/constants';

export default function HomeScreen() {
  const {
    baby,
    motherProfile,
    logs,
    todayMotherLog,
    resetAllData
  } = useApp();

  const navigation = useNavigation();

  const ageInfo = calculateAge(baby.birth_date);

  const todayFeed = countToday(logs.feed);
  const todaySleep = countToday(logs.sleep);
  const todayDiaper = countToday(logs.diaper);

  const handleResetApp = () => {
    Alert.alert(
      '⚠️ রিসেট করুন',
      'সব ডেটা মুছে যাবে। শুধু টেস্টিং এর জন্য।',
      [
        { text: 'না', style: 'cancel' },
        {
          text: 'হ্যাঁ, রিসেট',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetAllData();
            } catch (error) {
              console.error('Reset error:', error);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 20, paddingBottom: 40 }}>


        {/* GREETING */}
        <View style={{
          backgroundColor: COLORS.primaryLight,
          padding: 24,
          borderRadius: 16,
          marginBottom: 20,
          borderLeftWidth: 6,
          borderLeftColor: COLORS.primary
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 36, marginRight: 12 }}>💚</Text>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: COLORS.primaryDark }}>
                হাফসা আপা বলছে
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('Settings')}
              style={{ padding: 8 }}
            >
              <Text style={{ fontSize: 24 }}>⚙️</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 18, color: COLORS.primaryDarker, marginBottom: 12, lineHeight: 26 }}>
          {getGreeting()}{motherProfile?.name ? ` ${motherProfile.name}` : ''}!
          </Text>

          <Text style={{ fontSize: 17, color: COLORS.primaryDark, marginBottom: 12, lineHeight: 24 }}>
            আজ {baby.name} এর {ageInfo.bengaliAge} হলো! 🎉
          </Text>

          <TouchableOpacity
            onPress={() => navigation.navigate('HafsaTab')}
            style={{
              backgroundColor: COLORS.primary,
              padding: 14,
              borderRadius: 10,
              alignItems: 'center',
              marginTop: 4
            }}
          >
            <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
              💬 আপার সাথে কথা বলুন
            </Text>
          </TouchableOpacity>
        </View>

        {/* MOTHER STATUS CARD */}
        <TouchableOpacity
          onPress={() => navigation.navigate('MotherTab')}
          activeOpacity={0.8}
          style={{
            backgroundColor: '#FFF0F3',
            borderRadius: 16,
            padding: 20,
            marginBottom: 20,
            borderLeftWidth: 6,
            borderLeftColor: COLORS.mother,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 4,
            elevation: 3
          }}
        >
          {todayMotherLog ? (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, marginRight: 10 }}>🤱</Text>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.mother }}>
                    মায়ের চেক-ইন ✅
                  </Text>
                </View>
                <Text style={{ fontSize: 13, color: '#AD1457' }}>আপডেট →</Text>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {todayMotherLog.mood && (
                  <View style={{ backgroundColor: 'white', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, marginRight: 6 }}>{TEXT.moodEmojis[todayMotherLog.mood] || '😐'}</Text>
                    <Text style={{ fontSize: 13, color: COLORS.dark, fontWeight: '600' }}>{TEXT.moods[todayMotherLog.mood]}</Text>
                  </View>
                )}
                {todayMotherLog.sleepHours && (
                  <View style={{ backgroundColor: 'white', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, marginRight: 6 }}>😴</Text>
                    <Text style={{ fontSize: 13, color: COLORS.dark, fontWeight: '600' }}>
                      {todayMotherLog.sleepHours === '1-2' ? '১-২ ঘন্টা' : todayMotherLog.sleepHours === '3-4' ? '৩-৪ ঘন্টা' : todayMotherLog.sleepHours === '5-6' ? '৫-৬ ঘন্টা' : '৭+ ঘন্টা'}
                    </Text>
                  </View>
                )}
                {todayMotherLog.waterIntake > 0 && (
                  <View style={{ backgroundColor: 'white', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, marginRight: 6 }}>💧</Text>
                    <Text style={{ fontSize: 13, color: COLORS.dark, fontWeight: '600' }}>{toBengaliNumber(todayMotherLog.waterIntake)}/৮</Text>
                  </View>
                )}
              </View>

              {motherProfile && (
                <View style={{ marginTop: 12 }}>
                  {(() => {
                    const recovery = getRecoveryStage(
                      ageInfo.ageDays,
                      motherProfile.delivery_type === 'csection' ? 'csection' : 'normal'
                    );
                    return (
                      <View>
                        <View style={{ height: 6, backgroundColor: '#F8BBD0', borderRadius: 3, overflow: 'hidden' }}>
                          <View style={{ height: '100%', width: `${recovery.percentComplete}%`, backgroundColor: COLORS.mother, borderRadius: 3 }} />
                        </View>
                        <Text style={{ fontSize: 12, color: '#AD1457', marginTop: 4 }}>
                          সুস্থতা {toBengaliNumber(recovery.percentComplete)}% • {recovery.description}
                        </Text>
                      </View>
                    );
                  })()}
                </View>
              )}
            </View>
          ) : (
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
          )}
        </TouchableOpacity>

        {/* BABY QUICK SUMMARY */}
        <TouchableOpacity
          onPress={() => navigation.navigate('BabyTab')}
          activeOpacity={0.8}
          style={{
            backgroundColor: COLORS.primaryLight,
            borderRadius: 16,
            padding: 20,
            marginBottom: 20,
            borderLeftWidth: 6,
            borderLeftColor: COLORS.primary,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 4,
            elevation: 3
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 24, marginRight: 10 }}>👶</Text>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.primaryDark }}>
                {baby.name} এর আজকের দিন
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: COLORS.primary }}>বিস্তারিত →</Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 24 }}>🍼</Text>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: COLORS.feed, marginTop: 4 }}>
                {toBengaliNumber(todayFeed)}
              </Text>
              <Text style={{ fontSize: 11, color: COLORS.gray }}>দুধ</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 24 }}>😴</Text>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: COLORS.sleep, marginTop: 4 }}>
                {toBengaliNumber(todaySleep)}
              </Text>
              <Text style={{ fontSize: 11, color: COLORS.gray }}>ঘুম</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 24 }}>💩</Text>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: COLORS.diaper, marginTop: 4 }}>
                {toBengaliNumber(todayDiaper)}
              </Text>
              <Text style={{ fontSize: 11, color: COLORS.gray }}>ডায়াপার</Text>
            </View>
          </View>
        </TouchableOpacity>
        {/* QUICK ACTIONS */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: COLORS.dark, marginBottom: 12 }}>
            দ্রুত কাজ
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={() => navigation.navigate('BabyTab')}
              style={{
                flex: 1, backgroundColor: COLORS.feed, borderRadius: 12,
                padding: 16, alignItems: 'center'
              }}
            >
              <Text style={{ fontSize: 24 }}>🍼</Text>
              <Text style={{ color: 'white', fontSize: 13, fontWeight: 'bold', marginTop: 6 }}>দুধ লগ</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('MotherTab')}
              style={{
                flex: 1, backgroundColor: COLORS.mother, borderRadius: 12,
                padding: 16, alignItems: 'center'
              }}
            >
              <Text style={{ fontSize: 24 }}>🤱</Text>
              <Text style={{ color: 'white', fontSize: 13, fontWeight: 'bold', marginTop: 6 }}>চেক-ইন</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('HafsaTab')}
              style={{
                flex: 1, backgroundColor: COLORS.primary, borderRadius: 12,
                padding: 16, alignItems: 'center'
              }}
            >
              <Text style={{ fontSize: 24 }}>💚</Text>
              <Text style={{ color: 'white', fontSize: 13, fontWeight: 'bold', marginTop: 6 }}>হাফসা</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* DAILY TIP */}
        <View style={{
          backgroundColor: '#FFF8E1',
          borderRadius: 12,
          padding: 16,
          borderLeftWidth: 4,
          borderLeftColor: '#FFA000',
          marginBottom: 20
        }}>
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#E65100', marginBottom: 6 }}>
            💡 আজকের টিপস
          </Text>
          <Text style={{ fontSize: 14, color: '#5D4037', lineHeight: 22 }}>
            {ageInfo.ageMonths < 3
              ? 'নবজাতকের জন্য প্রতি ২-৩ ঘন্টায় দুধ খাওয়ান। রাতেও খাওয়াতে ভুলবেন না।'
              : ageInfo.ageMonths < 6
              ? 'এই বয়সে শিশু হাত দিয়ে জিনিস ধরতে শিখছে। রঙিন খেলনা কাছে রাখুন।'
              : ageInfo.ageMonths < 12
              ? 'শক্ত খাবার শুরু করুন — ভাত, ডাল, ডিম, কলা। একটু একটু করে।'
              : 'শিশু হাঁটতে ও কথা বলতে শিখছে। উৎসাহ দিন এবং নিরাপদ পরিবেশ তৈরি করুন।'}
          </Text>
        </View>
          {/* DEV RESET — hidden at bottom, for testing only */}
        <TouchableOpacity
          onPress={handleResetApp}
          style={{
            alignSelf: 'center',
            marginTop: 40,
            paddingVertical: 10,
            paddingHorizontal: 20,
            borderRadius: 8,
            backgroundColor: '#F5F5F5'
          }}
        >
          <Text style={{ fontSize: 12, color: '#BDBDBD' }}>
            রিসেট (ডেভ)
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
