// screens/HomeScreen.js
// Home tab dashboard — Intelligence-driven
// This screen contains ZERO health logic. It calls intelligenceService and renders what it returns.

import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { useNavigation } from '@react-navigation/native';
import { getHomeInsights } from '../services/intelligenceService';
import { toBengaliNumber, getGreeting } from '../utils/helpers';
import { COLORS, TEXT } from '../utils/constants';
import { BD_EPI_SCHEDULE } from '../data/bdEPISchedule';

// ============================================================
// BENGALI TEXT FORMATTERS — translate structured data to display text
// These are NOT health logic — just text mapping
// ============================================================

const ALERT_DISPLAY = {
  // Feed alerts
  feed_critically_low: { icon: '🚨', color: '#F44336' },
  feed_low: { icon: '⚠️', color: '#FF9800' },
  feed_gap_long: { icon: '⏰', color: '#FF9800' },
  feed_trend_decreasing: { icon: '📉', color: '#FF9800' },
  feed_drop_from_yesterday: { icon: '📉', color: '#FF9800' },
  dehydration_risk: { icon: '💧', color: '#F44336' },
  feed_on_target: { icon: '✅', color: '#4CAF50' },
  // Mother alerts
  prolonged_sadness: { icon: '💔', color: '#F44336' },
  mood_concerning: { icon: '😟', color: '#FF9800' },
  sleep_critical: { icon: '😴', color: '#F44336' },
  sleep_consistently_low: { icon: '😴', color: '#FF9800' },
  no_support_extended: { icon: '🤝', color: '#F44336' },
  self_harm_concern: { icon: '🆘', color: '#F44336' },
  high_epds_score: { icon: '⚠️', color: '#F44336' },
  heavy_bleeding_late: { icon: '🩸', color: '#F44336' },
  csection_worsening: { icon: '🏥', color: '#F44336' },
  low_water_intake: { icon: '💧', color: '#FF9800' },
  // Vaccine alerts
  vaccine_overdue: { icon: '💉', color: '#F44336' },
  vaccine_due_today: { icon: '💉', color: '#FF9800' },
  vaccine_due_soon: { icon: '💉', color: '#2196F3' },
  // Growth alerts
  weight_below_p3: { icon: '📊', color: '#F44336' },
  slow_growth_velocity: { icon: '📊', color: '#FF9800' },
  // Cross alerts
  isolation_depression_risk: { icon: '💔', color: '#F44336' },
  growth_feed_concern: { icon: '📉', color: '#F44336' },
  depression_sleep_crisis: { icon: '🆘', color: '#F44336' },
};

function getAlertBengali(alertKey, insights) {
  const feed = insights.feedStatus;
  const mother = insights.motherStatus;
  const vaccine = insights.vaccineStatus;
  const babyName = insights.baby?.name || 'শিশু';

  const map = {
    feed_critically_low: `${babyName} আজ মাত্র ${toBengaliNumber(feed?.todayCount || 0)} বার খেয়েছে — এই বয়সে ${toBengaliNumber(feed?.expectedMin || 8)}-${toBengaliNumber(feed?.expectedMax || 12)} বার দরকার`,
    feed_low: `${babyName} আজ ${toBengaliNumber(feed?.todayCount || 0)} বার খেয়েছে, আরো ${toBengaliNumber(feed?.expectedMin - (feed?.todayCount || 0))} বার দরকার`,
    feed_gap_long: `শেষ দুধ ${toBengaliNumber(Math.round((feed?.lastFeedMinutesAgo || 0) / 60))} ঘন্টা আগে`,
    feed_trend_decreasing: `গত কয়েকদিনে খাওয়া কমে যাচ্ছে`,
    dehydration_risk: `ভেজা ডায়াপার কম — পানিশূন্যতার লক্ষণ হতে পারে`,
    feed_on_target: `${babyName} আজ ${toBengaliNumber(feed?.todayCount || 0)} বার খেয়েছে ✅`,
    prolonged_sadness: `${toBengaliNumber(mother?.mood?.pattern?.consecutiveSadDays || 0)} দিন ধরে মন ভালো নেই — কারো সাথে কথা বলুন`,
    mood_concerning: `কয়েকদিন ধরে মন ভালো নেই`,
    sleep_critical: `ঘুম বিপজ্জনকভাবে কম — সাহায্য নিন`,
    sleep_consistently_low: `কয়েকদিন ধরে ঘুম কম হচ্ছে`,
    no_support_extended: `অনেকদিন ধরে একা সামলাচ্ছেন — সাহায্য চান`,
    self_harm_concern: `আপনি একা নন — সাহায্য পাওয়া যায়`,
    high_epds_score: `মানসিক স্বাস্থ্য চেক-আপ দরকার — ডাক্তার দেখান`,
    heavy_bleeding_late: `এই সময়ে বেশি রক্তপাত স্বাভাবিক নয় — ডাক্তার দেখান`,
    csection_worsening: `সিজারের ক্ষত খারাপ হচ্ছে — আজই ডাক্তার দেখান`,
    low_water_intake: `পানি কম খাচ্ছেন — দুধের পরিমাণে প্রভাব পড়তে পারে`,
    vaccine_overdue: `${vaccine?.overdue?.[0]?.name || 'টিকা'} মিস হয়ে গেছে — দ্রুত দিন`,
    vaccine_due_today: `আজ ${vaccine?.upcoming?.[0]?.name || 'টিকা'} দেওয়ার দিন!`,
    vaccine_due_soon: `${vaccine?.upcoming?.[0]?.name || 'টিকা'} ${toBengaliNumber(vaccine?.upcoming?.[0]?.daysUntil || 0)} দিনে`,
    weight_below_p3: `ওজন স্বাভাবিকের নিচে — ডাক্তারকে জানান`,
    slow_growth_velocity: `ওজন বৃদ্ধি ধীর হচ্ছে`,
    isolation_depression_risk: `একা সামলাচ্ছেন + মন ভালো নেই — সাহায্য জরুরি`,
    growth_feed_concern: `ওজন কম + খাওয়া কম — মনোযোগ দিন`,
    depression_sleep_crisis: `মানসিক চাপ + ঘুম কম — পেশাদার সাহায্য নিন`,
  };

  return map[alertKey] || alertKey;
}

// Daily tips by age — static content, not health logic
const DAILY_TIPS = {
  0: 'নবজাতকের জন্য প্রতি ২-৩ ঘন্টায় দুধ খাওয়ান। রাতেও খাওয়াতে ভুলবেন না।',
  1: 'শিশুকে পেটের উপর (tummy time) রাখুন — ঘাড়ের পেশী শক্ত হবে।',
  2: 'শিশু এখন হাসতে শুরু করবে! চোখে চোখ রেখে কথা বলুন।',
  3: 'এই বয়সে শিশু হাত দিয়ে জিনিস ধরতে শিখছে। রঙিন খেলনা কাছে রাখুন।',
  4: 'শিশু গড়াগড়ি দিতে শুরু করতে পারে। বিছানায় একা রাখবেন না।',
  5: 'শিশু মুখে সব কিছু দেয় — ছোট জিনিস নাগালের বাইরে রাখুন।',
  6: 'শক্ত খাবার শুরু করুন — ভাত, ডাল, ডিম, কলা। একটু একটু করে।',
  7: 'শিশু বসতে শিখছে। পিঠে সাপোর্ট দিন।',
  8: 'শিশু হামাগুড়ি দিতে পারে — ঘর নিরাপদ করুন।',
  9: 'শিশু "মা" "বাবা" বলতে শুরু করতে পারে। বেশি বেশি কথা বলুন।',
  10: 'শিশু দাঁড়াতে চেষ্টা করছে। আসবাবপত্র শক্ত কিনা দেখুন।',
  11: 'শিশু একা দাঁড়াতে পারে। প্রথম পদক্ষেপের জন্য প্রস্তুত হন!',
  12: 'শিশু হাঁটতে ও কথা বলতে শিখছে। উৎসাহ দিন এবং নিরাপদ পরিবেশ তৈরি করুন।',
  18: 'শিশু ছোট বাক্য বলতে শুরু করবে। গল্পের বই পড়ে শোনান।',
  24: 'শিশু দৌড়াতে, লাফাতে পারে। বাইরে খেলার সুযোগ দিন।',
};

function getDailyTip(ageMonths) {
  const keys = Object.keys(DAILY_TIPS).map(Number).sort((a, b) => a - b);
  let matched = keys[0];
  for (const key of keys) { if (ageMonths >= key) matched = key; }
  return DAILY_TIPS[matched];
}

// ============================================================
// COMPONENT
// ============================================================

export default function HomeScreen() {
  const {
    baby, motherProfile, logs, todayMotherLog,
    motherLogHistory, vaccineStatus, growthMeasurements, resetAllData
  } = useApp();

  const navigation = useNavigation();

  // Call the brain ONCE — get all insights
  const insights = useMemo(() => {
    return getHomeInsights({
      baby, motherProfile, logs, todayMotherLog,
      motherLogHistory, vaccineStatus, growthMeasurements,
      epdsData: null, // Will be connected when EPDS is stored separately
      epiSchedule: BD_EPI_SCHEDULE,
    });
  }, [baby, motherProfile, logs, todayMotherLog, motherLogHistory, vaccineStatus, growthMeasurements]);

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
            try { await resetAllData(); }
            catch (error) { console.error('Reset error:', error); }
          }
        }
      ]
    );
  };

  // Extract what we need from insights
  const { feedStatus, motherStatus, vaccineStatus: vaccineInfo, baby: babyInfo, alerts, milestones } = insights;

  // Filter to show only important alerts (medium+ severity)
  const visibleAlerts = alerts.filter(a =>
    a.severity === 'critical' || a.severity === 'high' || a.severity === 'medium'
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 20, paddingBottom: 40 }}>

        {/* GREETING */}
        <View style={{
          backgroundColor: COLORS.primaryLight,
          padding: 24, borderRadius: 16, marginBottom: 20,
          borderLeftWidth: 6, borderLeftColor: COLORS.primary
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 36, marginRight: 12 }}>💚</Text>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: COLORS.primaryDark }}>
                হাফসা আপা বলছে
              </Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={{ padding: 8 }}>
              <Text style={{ fontSize: 24 }}>⚙️</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 18, color: COLORS.primaryDarker, marginBottom: 12, lineHeight: 26 }}>
            {getGreeting()}{motherProfile?.name ? ` ${motherProfile.name}` : ''}!
          </Text>

          <Text style={{ fontSize: 17, color: COLORS.primaryDark, marginBottom: 12, lineHeight: 24 }}>
            আজ {baby.name} এর {babyInfo?.ageInfo?.bengaliAge || ''} হলো! 🎉
          </Text>

          <TouchableOpacity
            onPress={() => navigation.navigate('HafsaTab')}
            style={{ backgroundColor: COLORS.primary, padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 4 }}
          >
            <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
              💬 আপার সাথে কথা বলুন
            </Text>
          </TouchableOpacity>
        </View>

        {/* INTELLIGENT ALERTS — from rules engine */}
        {visibleAlerts.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            {visibleAlerts.slice(0, 3).map((alert, index) => {
              const display = ALERT_DISPLAY[alert.key] || { icon: '📌', color: '#FF9800' };
              const isCritical = alert.severity === 'critical';
              return (
                <View key={`${alert.key}-${index}`} style={{
                  backgroundColor: isCritical ? '#FFEBEE' : '#FFF3E0',
                  borderRadius: 12, padding: 14, marginBottom: 8,
                  borderLeftWidth: 4, borderLeftColor: display.color,
                  flexDirection: 'row', alignItems: 'center',
                }}>
                  <Text style={{ fontSize: 20, marginRight: 12 }}>{display.icon}</Text>
                  <Text style={{ flex: 1, fontSize: 14, color: COLORS.dark, lineHeight: 20 }}>
                    {getAlertBengali(alert.key, insights)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* MILESTONE CELEBRATION — only for age, weight, first_food milestones */}
        {milestones.length > 0 && ['age', 'weight', 'first_food'].includes(milestones[0].type) && (
          <View style={{
            backgroundColor: COLORS.primaryLight, borderRadius: 12, padding: 14, marginBottom: 12,
            borderLeftWidth: 4, borderLeftColor: COLORS.primary,
            flexDirection: 'row', alignItems: 'center'
          }}>
            <Text style={{ fontSize: 28, marginRight: 12 }}>🎉</Text>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: 'bold', color: COLORS.primaryDark }}>
              {milestones[0].type === 'age'
                ? `${baby.name} আজ ${babyInfo?.ageInfo?.bengaliAge}!`
                : milestones[0].type === 'weight'
                ? `${baby.name} ${toBengaliNumber(milestones[0].value)} কেজি হয়েছে!`
                : `${baby.name} প্রথম শক্ত খাবার খেয়েছে!`}
            </Text>
          </View>
        )}

        {/* MOTHER STATUS CARD — data from intelligence service */}
        <TouchableOpacity
          onPress={() => navigation.navigate('MotherTab')}
          activeOpacity={0.8}
          style={{
            backgroundColor: '#FFF0F3', borderRadius: 16, padding: 20, marginBottom: 20,
            borderLeftWidth: 6, borderLeftColor: COLORS.mother,
            shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08, shadowRadius: 4, elevation: 3
          }}
        >
          {motherStatus?.checkedInToday ? (
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
                {motherStatus.mood.today && (
                  <View style={{ backgroundColor: 'white', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, marginRight: 6 }}>{TEXT.moodEmojis[motherStatus.mood.today] || '😐'}</Text>
                    <Text style={{ fontSize: 13, color: COLORS.dark, fontWeight: '600' }}>{TEXT.moods[motherStatus.mood.today]}</Text>
                  </View>
                )}
                {motherStatus.sleep.today && (
                  <View style={{ backgroundColor: 'white', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, marginRight: 6 }}>😴</Text>
                    <Text style={{ fontSize: 13, color: COLORS.dark, fontWeight: '600' }}>
                      {motherStatus.sleep.today === '1-2' ? '১-২ ঘন্টা' : motherStatus.sleep.today === '3-4' ? '৩-৪ ঘন্টা' : motherStatus.sleep.today === '5-6' ? '৫-৬ ঘন্টা' : '৭+ ঘন্টা'}
                    </Text>
                  </View>
                )}
                {motherStatus.water.today > 0 && (
                  <View style={{ backgroundColor: 'white', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, marginRight: 6 }}>💧</Text>
                    <Text style={{ fontSize: 13, color: COLORS.dark, fontWeight: '600' }}>
                      {toBengaliNumber(motherStatus.water.today)}/৮
                    </Text>
                  </View>
                )}
              </View>

              {/* Recovery bar — data from intelligence service */}
              <View style={{ marginTop: 12 }}>
                <View style={{ height: 6, backgroundColor: '#F8BBD0', borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{ height: '100%', width: `${motherStatus.recovery.percentComplete}%`, backgroundColor: COLORS.mother, borderRadius: 3 }} />
                </View>
                <Text style={{ fontSize: 12, color: '#AD1457', marginTop: 4 }}>
                  সুস্থতা {toBengaliNumber(motherStatus.recovery.percentComplete)}% • {motherStatus.recovery.description}
                </Text>
              </View>
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

        {/* BABY SUMMARY — counts from intelligence service */}
        <TouchableOpacity
          onPress={() => navigation.navigate('BabyTab')}
          activeOpacity={0.8}
          style={{
            backgroundColor: COLORS.primaryLight, borderRadius: 16, padding: 20, marginBottom: 20,
            borderLeftWidth: 6, borderLeftColor: COLORS.primary,
            shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08, shadowRadius: 4, elevation: 3
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
              <Text style={{
                fontSize: 20, fontWeight: 'bold', marginTop: 4,
                color: feedStatus?.status === 'low' || feedStatus?.status === 'critical' ? COLORS.danger : COLORS.feed
              }}>
                {toBengaliNumber(feedStatus?.todayCount || 0)}
              </Text>
              <Text style={{ fontSize: 11, color: COLORS.gray }}>দুধ</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 24 }}>😴</Text>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: COLORS.sleep, marginTop: 4 }}>
                {toBengaliNumber(feedStatus?.todayCount !== undefined ? (logs.sleep ? logs.sleep.filter(l => { try { return new Date(l.timestamp).toDateString() === new Date().toDateString(); } catch { return false; } }).length : 0) : 0)}
              </Text>
              <Text style={{ fontSize: 11, color: COLORS.gray }}>ঘুম</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 24 }}>💩</Text>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: COLORS.diaper, marginTop: 4 }}>
                {toBengaliNumber(feedStatus?.todayCount !== undefined ? (logs.diaper ? logs.diaper.filter(l => { try { return new Date(l.timestamp).toDateString() === new Date().toDateString(); } catch { return false; } }).length : 0) : 0)}
              </Text>
              <Text style={{ fontSize: 11, color: COLORS.gray }}>ডায়াপার</Text>
            </View>
          </View>

          {/* Feed status indicator from intelligence */}
          {feedStatus && feedStatus.status !== 'good' && feedStatus.todayCount > 0 && (
            <View style={{
              marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#C8E6C9',
            }}>
              <Text style={{ fontSize: 13, color: feedStatus.status === 'critical' ? COLORS.danger : COLORS.gray }}>
                {feedStatus.status === 'low' || feedStatus.status === 'critical'
                  ? `আরো ${toBengaliNumber(Math.max(0, feedStatus.expectedMin - feedStatus.todayCount))} বার দুধ দরকার`
                  : feedStatus.yesterdayCount > 0
                  ? `গতকাল ${toBengaliNumber(feedStatus.yesterdayCount)} বার খেয়েছিল`
                  : ''}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* QUICK ACTIONS */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: COLORS.dark, marginBottom: 12 }}>
            দ্রুত কাজ
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={() => navigation.navigate('BabyTab')}
              style={{ flex: 1, backgroundColor: COLORS.feed, borderRadius: 12, padding: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 24 }}>🍼</Text>
              <Text style={{ color: 'white', fontSize: 13, fontWeight: 'bold', marginTop: 6 }}>দুধ লগ</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('MotherTab')}
              style={{ flex: 1, backgroundColor: COLORS.mother, borderRadius: 12, padding: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 24 }}>🤱</Text>
              <Text style={{ color: 'white', fontSize: 13, fontWeight: 'bold', marginTop: 6 }}>চেক-ইন</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('HafsaTab')}
              style={{ flex: 1, backgroundColor: COLORS.primary, borderRadius: 12, padding: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 24 }}>💚</Text>
              <Text style={{ color: 'white', fontSize: 13, fontWeight: 'bold', marginTop: 6 }}>হাফসা</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* DAILY TIP — age-appropriate content (not health logic) */}
        <View style={{
          backgroundColor: '#FFF8E1', borderRadius: 12, padding: 16,
          borderLeftWidth: 4, borderLeftColor: '#FFA000', marginBottom: 20
        }}>
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#E65100', marginBottom: 6 }}>
            💡 আজকের টিপস
          </Text>
          <Text style={{ fontSize: 14, color: '#5D4037', lineHeight: 22 }}>
            {getDailyTip(babyInfo?.ageMonths || 0)}
          </Text>
        </View>

        {/* VACCINE QUICK STATUS — from intelligence */}
        {vaccineInfo && (vaccineInfo.status === 'behind' || vaccineInfo.upcoming.length > 0) && (
          <TouchableOpacity
            onPress={() => navigation.navigate('BabyTab')}
            style={{
              backgroundColor: vaccineInfo.status === 'behind' ? '#FFEBEE' : '#E3F2FD',
              borderRadius: 12, padding: 16, marginBottom: 20,
              borderLeftWidth: 4,
              borderLeftColor: vaccineInfo.status === 'behind' ? COLORS.danger : COLORS.info,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: vaccineInfo.status === 'behind' ? COLORS.danger : COLORS.info, marginBottom: 4 }}>
              💉 টিকা: {toBengaliNumber(vaccineInfo.completed)}/{toBengaliNumber(vaccineInfo.total)} সম্পন্ন
            </Text>
            <Text style={{ fontSize: 13, color: COLORS.dark }}>
              {vaccineInfo.overdue.length > 0
                ? `${vaccineInfo.overdue[0].name} মিস হয়ে গেছে`
                : vaccineInfo.upcoming[0]
                ? `পরবর্তী: ${vaccineInfo.upcoming[0].name} (${toBengaliNumber(vaccineInfo.upcoming[0].daysUntil)} দিনে)`
                : ''}
            </Text>
          </TouchableOpacity>
        )}

        {/* DEV RESET */}
        <TouchableOpacity onPress={handleResetApp}
          style={{ alignSelf: 'center', marginTop: 40, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#F5F5F5' }}>
          <Text style={{ fontSize: 12, color: '#BDBDBD' }}>রিসেট (ডেভ)</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}