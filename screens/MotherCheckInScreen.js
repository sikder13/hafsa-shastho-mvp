/**
 * Hafsa Sastho (হাফসা স্বাস্থ্য)
 * Bangladesh's First AI Companion for Postpartum and Early Childhood Care
 * Copyright © 2026 Nahl Technologies Inc. All rights reserved.
 *
 * @author Udaay Sikder — Co-Founder & Dev
 */
// screens/MotherCheckInScreen.js
// Daily postpartum check-in — feels like a caring conversation, not a medical form
// Step-by-step: Mood → Physical → Self-Care → Hafsa's Response

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../context/AppContext';
import { toBengaliNumber, calculateAge, getRecoveryStage } from '../utils/helpers';
import { COLORS, STORAGE_KEYS, TEXT } from '../utils/constants';
import { isEPDSDue } from './EdinburghScaleScreen';
import { getCheckInAssessment } from '../services/intelligenceService';

const TOTAL_STEPS = 4; // Mood, Physical, Self-Care, Hafsa Response

export default function MotherCheckInScreen({ onBack, onNavigateEPDS }) {
  const { baby, motherProfile, saveMotherLog, todayMotherLog, motherLogHistory } = useApp();

  // EPDS state
  const [epdsIsDue, setEpdsIsDue] = useState(false);

  // Check-in data
  const [mood, setMood] = useState(null);
  const [bleeding, setBleeding] = useState(null);
  const [pain, setPain] = useState(null);
  const [breastPain, setBreastPain] = useState(null);
  const [csectionHealing, setCsectionHealing] = useState(null);
  const [waterIntake, setWaterIntake] = useState(0);
  const [mealsEaten, setMealsEaten] = useState(0);
  const [sleepHours, setSleepHours] = useState(null);
  const [hadHelp, setHadHelp] = useState(null);
  const [breastfeedingSessions, setBreastfeedingSessions] = useState(0);

  // UI state
  const [currentStep, setCurrentStep] = useState(0);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef(null);

  // Check if already checked in today
  useEffect(() => {
    if (todayMotherLog) {
      setAlreadyCheckedIn(true);
      // Pre-fill with today's data so she can update
      if (todayMotherLog.mood) setMood(todayMotherLog.mood);
      if (todayMotherLog.bleeding) setBleeding(todayMotherLog.bleeding);
      if (todayMotherLog.pain) setPain(todayMotherLog.pain);
      if (todayMotherLog.breastPain !== undefined) setBreastPain(todayMotherLog.breastPain);
      if (todayMotherLog.csectionHealing) setCsectionHealing(todayMotherLog.csectionHealing);
      if (todayMotherLog.waterIntake) setWaterIntake(todayMotherLog.waterIntake);
      if (todayMotherLog.mealsEaten) setMealsEaten(todayMotherLog.mealsEaten);
      if (todayMotherLog.sleepHours) setSleepHours(todayMotherLog.sleepHours);
      if (todayMotherLog.hadHelp !== undefined) setHadHelp(todayMotherLog.hadHelp);
      if (todayMotherLog.breastfeedingSessions) setBreastfeedingSessions(todayMotherLog.breastfeedingSessions);
    }
  }, [todayMotherLog]);

  // Check if EPDS assessment is due
  useEffect(() => {
    const checkEPDS = async () => {
      const due = await isEPDSDue();
      setEpdsIsDue(due);
    };
    checkEPDS();
  }, []);

  // ============================================================
  // NAVIGATION
  // ============================================================

  const animateTransition = (nextStep) => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      setCurrentStep(nextStep);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, 120);
  };

  const goNext = () => {
    if (currentStep < TOTAL_STEPS - 1) {
      animateTransition(currentStep + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 0) {
      animateTransition(currentStep - 1);
    }
  };

  // ============================================================
  // SAVE
  // ============================================================

  const handleSave = async () => {
    const logData = {
      mood,
      bleeding,
      pain,
      breastPain,
      csectionHealing: motherProfile?.delivery_type === 'csection' ? csectionHealing : null,
      waterIntake,
      mealsEaten,
      sleepHours,
      hadHelp,
      breastfeedingSessions,
      completedAt: new Date().toISOString()
    };

    await saveMotherLog(logData);
    // Navigate to Hafsa's response (last step)
    animateTransition(TOTAL_STEPS - 1);
  };

  // ============================================================
  // DERIVED DATA
  // ============================================================

  const motherName = motherProfile?.name || 'মা';
  const deliveryType = motherProfile?.delivery_type || 'normal';
  const isCsection = deliveryType === 'csection';

  const ageInfo = baby ? calculateAge(baby.birth_date) : null;
  const postpartumDays = ageInfo ? ageInfo.ageDays : 0;
  const recovery = getRecoveryStage(postpartumDays, isCsection ? 'csection' : 'normal');

  // Count recent mood patterns
  const getRecentMoodPattern = () => {
    if (!motherLogHistory || motherLogHistory.length === 0) return null;
    const last5 = motherLogHistory.slice(0, 5);
    const sadCount = last5.filter(l => l.mood === 'sad' || l.mood === 'bad').length;
    const noHelpCount = last5.filter(l => l.hadHelp === false).length;
    const lowSleepCount = last5.filter(l => l.sleepHours === '1-2' || l.sleepHours === '3-4').length;
    return { sadCount, noHelpCount, lowSleepCount, totalDays: last5.length };
  };

  // ============================================================
  // HAFSA'S PERSONALIZED RESPONSE
  // ============================================================

  const getHafsaResponse = () => {
    // Get pre-computed assessment from Intelligence Service
    const assessment = getCheckInAssessment(
      { mood, bleeding, pain, breastPain, csectionHealing, waterIntake, mealsEaten, sleepHours, hadHelp, breastfeedingSessions },
      motherLogHistory,
      motherProfile,
      postpartumDays,
      null // EPDS data — will connect when stored separately
    );

    const sections = [];

    // ============================================================
    // OPENING — warm, personal, mood-aware
    // ============================================================
    if (mood === 'happy') {
      sections.push(`${motherName}, আলহামদুলিল্লাহ! আজ আপনি ভালো আছেন, এটা শুনে খুশি হলাম। 😊`);
    } else if (mood === 'okay') {
      sections.push(`${motherName}, ঠিক আছে মানে ঠিক আছে — প্রতিদিন দারুণ থাকতে হবে এমন নয়।`);
    } else if (mood === 'sad') {
      sections.push(`${motherName}, আজ মন ভালো নেই — এটা বলার জন্য ধন্যবাদ। আপনি সাহসী। 💚`);
    } else if (mood === 'bad') {
      sections.push(`${motherName}, আজ অনেক কঠিন দিন। আপনি একা না, আমি আপনার পাশে আছি। 💚`);
    }

    // ============================================================
    // EMOTIONAL CONTRADICTION DETECTION (Intelligence Service)
    // ============================================================
    if (
      (mood === 'okay' || mood === 'happy') &&
      assessment.overallSeverity === 'high' || assessment.overallSeverity === 'critical'
    ) {
      const contradictions = [];
      if (assessment.sleep.pattern.consecutiveLowDays >= 2) contradictions.push('ঘুম কম হচ্ছে');
      if (assessment.support.consecutiveNoHelpDays >= 3) contradictions.push('কয়েকদিন ধরে একা সামলাচ্ছেন');
      if (assessment.epds.score >= 10) contradictions.push('গত মূল্যায়নে স্কোর উদ্বেগজনক ছিল');
      if (assessment.mood.pattern.consecutiveSadDays >= 2) contradictions.push('আগের কয়েকদিন মন ভালো ছিল না');

      if (contradictions.length >= 2) {
        sections.push('');
        sections.push(`💚 আপনি বলছেন ঠিক আছেন, কিন্তু আমি দেখছি ${contradictions.join(', ')}। সত্যি করে বলুন — কেমন আছেন? সাহায্য চাওয়া দুর্বলতা নয়।`);
      }
    }

    // ============================================================
    // MOOD PATTERN ALERT (from Intelligence Service)
    // ============================================================
    if (assessment.mood.pattern.consecutiveSadDays >= 5) {
      sections.push('');
      sections.push(`⚠️ গত ${toBengaliNumber(assessment.mood.pattern.consecutiveSadDays)} দিন ধরে মন ভালো নেই। এটা প্রসব-পরবর্তী বিষণ্নতার লক্ষণ হতে পারে — এটা অনেক মায়ের হয় এবং চিকিৎসায় ভালো হয়। অনুগ্রহ করে ডাক্তারের সাথে কথা বলুন।`);
    } else if (assessment.mood.pattern.consecutiveSadDays >= 3) {
      sections.push('');
      sections.push(`⚠️ গত ${toBengaliNumber(assessment.mood.pattern.consecutiveSadDays)} দিন ধরে মন ভালো না। কারো সাথে কথা বলুন — স্বামী, মা, বা বিশ্বস্ত কেউ। আপনি দুর্বল নন।`);
    }

    // ============================================================
    // POSTPARTUM TIMELINE-AWARE PHYSICAL ASSESSMENT
    // ============================================================

    // --- Bleeding (from assessment) ---
    if (assessment.bleeding.alerts.includes('heavy_bleeding_late')) {
      sections.push('');
      sections.push(`🔴 ${toBengaliNumber(postpartumDays)} দিন পরেও বেশি রক্তপাত — এটা স্বাভাবিক নয়। ১ ঘন্টায় প্যাড পুরো ভিজলে বা বড় দলা বের হলে এখনই ডাক্তার দেখান।`);
    } else if (assessment.bleeding.alerts.includes('bleeding_after_6weeks')) {
      sections.push('');
      sections.push(`🟡 ৬ সপ্তাহ পরেও রক্তপাত আছে। পরবর্তী ডাক্তার ভিজিটে জানান।`);
    } else if (assessment.bleeding.alerts.includes('bleeding_increasing')) {
      sections.push('');
      sections.push(`⚠️ রক্তপাত বাড়ছে — কয়েকদিন ধরে বাড়ার ধারা দেখা যাচ্ছে। ডাক্তারকে জানান।`);
    } else if (bleeding === 'none' || bleeding === 'light') {
      if (postpartumDays > 7) {
        sections.push('');
        sections.push('✅ রক্তপাত স্বাভাবিক পর্যায়ে আছে।');
      }
    }

    // --- Pain ---
    if (pain === 'high') {
      sections.push('');
      if (isCsection) {
        sections.push(`🩹 তীব্র ব্যথা। সিজারের পর ${toBengaliNumber(postpartumDays)} দিনে তীব্র ব্যথা থাকলে ডাক্তারকে জানান। ব্যথার ওষুধ নিয়মিত খান।`);
      } else {
        sections.push('🩹 তীব্র ব্যথা হচ্ছে। বিশ্রাম নিন। ব্যথা বাড়লে বা জ্বর থাকলে ডাক্তার দেখান।');
      }
    } else if (pain === 'medium') {
      sections.push('');
      if (postpartumDays <= 14) {
        sections.push('🩹 মাঝারি ব্যথা — এই সময়ে স্বাভাবিক। আস্তে আস্তে কমবে।');
      } else {
        sections.push(`🩹 ${toBengaliNumber(postpartumDays)} দিন পরেও মাঝারি ব্যথা। পরবর্তী চেকআপে ডাক্তারকে জানান।`);
      }
    }

    // --- C-section healing (from assessment) ---
    if (isCsection && csectionHealing) {
      sections.push('');
      if (assessment.alerts.includes('csection_worsening')) {
        sections.push('⚠️ সেলাই খারাপ হচ্ছে। লাল, ফোলা, পুঁজ, বা জ্বর থাকলে — আজই ডাক্তার দেখান। দেরি করবেন না।');
      } else if (csectionHealing === 'same' && postpartumDays > 14) {
        sections.push('🟡 ২ সপ্তাহ পরেও সেলাই একই আছে। পরবর্তী চেকআপে ডাক্তারকে জানান।');
      } else if (csectionHealing === 'improving') {
        sections.push(`✅ সেলাই ভালো হচ্ছে। ${recovery.description}। আপনি ${toBengaliNumber(recovery.percentComplete)}% সেরে উঠেছেন! 💪`);
      }
    }

    // --- Breast pain ---
    if (breastPain === true) {
      sections.push('');
      sections.push('🤱 স্তনে ব্যথা? গরম সেঁক দিন দুধ খাওয়ানোর আগে, ঠাণ্ডা সেঁক পরে। শিশুকে ঠিকমতো লাগানো (latching) নিশ্চিত করুন। ব্যথা বাড়লে বা জ্বর আসলে ডাক্তার দেখান।');
    }

    // ============================================================
    // SELF-CARE ASSESSMENT (from Intelligence Service)
    // ============================================================

    // --- Sleep (timeline-aware) ---
    if (assessment.sleep.pattern.trend === 'critical') {
      sections.push('');
      sections.push(`😴 ঘুম বিপজ্জনকভাবে কম! গড়ে ${toBengaliNumber(assessment.sleep.pattern.avgHours || 0)} ঘন্টা। আজই কাউকে বলুন রাতে দায়িত্ব নিতে। আপনার শরীর ও মনের জন্য ঘুম অত্যন্ত দরকার।`);
    } else if (sleepHours === '1-2') {
      sections.push('');
      sections.push(`😴 মাত্র ১-২ ঘন্টা ঘুম! ${baby?.name || 'শিশু'} ঘুমালে আপনিও ঘুমান — কাজ রেখে দিন।`);
    } else if (sleepHours === '3-4') {
      sections.push('');
      if (postpartumDays <= 30) {
        sections.push('😴 ৩-৪ ঘন্টা — নবজাতকের সাথে এটা সাধারণ। দুপুরে ২০-৩০ মিনিট ঘুমানোর চেষ্টা করুন।');
      } else {
        sections.push('😴 ৩-৪ ঘন্টা ঘুম এখনো কম। এই বয়সে শিশু একটু বেশি ঘুমানো উচিত — রাতের ভাগ কাউকে দিন।');
      }
    } else if (sleepHours === '5-6' || sleepHours === '7+') {
      sections.push('');
      sections.push('😴 ভালো ঘুম হচ্ছে! এটা আপনার সুস্থতার জন্য খুব গুরুত্বপূর্ণ। ✅');
    }

    // --- Water (connected to breastfeeding) ---
    if (assessment.alerts.includes('low_water_intake') && breastfeedingSessions > 0) {
      sections.push('');
      sections.push(`💧 আজ মাত্র ${toBengaliNumber(waterIntake)} গ্লাস পানি — আপনি দুধ খাওয়াচ্ছেন, তাই অন্তত ৮ গ্লাস দরকার। পানি কম হলে দুধের পরিমাণ কমতে পারে। পাশে বোতল রাখুন।`);
    } else if (waterIntake < 4) {
      sections.push('');
      sections.push(`💧 পানি ${toBengaliNumber(waterIntake)}/৮ গ্লাস — আরো বাড়ান।`);
    } else if (waterIntake >= 8) {
      sections.push('');
      sections.push(`💧 ${toBengaliNumber(waterIntake)} গ্লাস পানি — দারুণ! ✅`);
    }

    // --- Meals ---
    if (mealsEaten < 2) {
      sections.push('');
      sections.push('🍽️ ঠিকমতো খাওয়া হয়নি। আপনি সুস্থ না থাকলে শিশুর যত্ন নেওয়া কঠিন। অন্তত ৩ বেলা খান।');
    }

    // --- Help + isolation risk (from Intelligence Service cross-check) ---
    if (hadHelp === false && assessment.support.consecutiveNoHelpDays >= 5) {
      sections.push('');
      sections.push(`🤝 গত ${toBengaliNumber(assessment.support.consecutiveNoHelpDays)} দিন ধরে একা সামলাচ্ছেন। এটা অনেক কঠিন। আজই কারো সাথে খোলামেলা কথা বলুন — নির্দিষ্ট কাজ ভাগ করে দিতে বলুন।`);
    } else if (hadHelp === false && assessment.support.consecutiveNoHelpDays >= 3) {
      sections.push('');
      sections.push('🤝 কয়েকদিন ধরে একা সামলাচ্ছেন। সাহায্য চাওয়া দুর্বলতা নয়, বুদ্ধিমানের কাজ।');
    } else if (hadHelp === false) {
      sections.push('');
      sections.push('🤝 আজ একা সামলেছেন। কাউকে বলুন — "বাচ্চাকে ৩০ মিনিট ধরো, আমি ঘুমাই"।');
    } else if (hadHelp === true) {
      sections.push('');
      sections.push('🤝 আজ সাহায্য পেয়েছেন — আলহামদুলিল্লাহ! ✅');
    }

    // --- Breastfeeding (timeline-aware) ---
    if (breastfeedingSessions > 0) {
      sections.push('');
      if (postpartumDays <= 30) {
        if (breastfeedingSessions >= 8) {
          sections.push(`🤱 আজ ${toBengaliNumber(breastfeedingSessions)} বার দুধ খাওয়ানো — নবজাতকের জন্য দারুণ! ✅`);
        } else if (breastfeedingSessions < 6) {
          sections.push(`🤱 আজ ${toBengaliNumber(breastfeedingSessions)} বার — নবজাতকের জন্য ৮-১২ বার দরকার। বেশি খাওয়ালে দুধ বেশি তৈরি হয়।`);
        }
      } else if (postpartumDays <= 180) {
        if (breastfeedingSessions >= 6) {
          sections.push(`🤱 ${toBengaliNumber(breastfeedingSessions)} বার দুধ খাওয়ানো — এই বয়সে ভালো! ✅`);
        }
      }
    }

    // ============================================================
    // WEEK-OVER-WEEK COMPARISON (from history)
    // ============================================================
    if (motherLogHistory && motherLogHistory.length >= 7) {
      const thisWeek = motherLogHistory.slice(0, 7);
      const lastWeek = motherLogHistory.slice(7, 14);

      if (lastWeek.length >= 5) {
        const thisWeekHappy = thisWeek.filter(l => l.mood === 'happy').length;
        const lastWeekHappy = lastWeek.filter(l => l.mood === 'happy').length;

        if (thisWeekHappy > lastWeekHappy + 1) {
          sections.push('');
          sections.push(`📈 গত সপ্তাহের চেয়ে এই সপ্তাহে মন বেশি ভালো আছে! চালিয়ে যান! 🌟`);
        } else if (thisWeekHappy < lastWeekHappy - 1) {
          sections.push('');
          sections.push(`📉 গত সপ্তাহের চেয়ে এই সপ্তাহে একটু কম ভালো লাগছে। এটা স্বাভাবিক — কিন্তু খেয়াল রাখুন।`);
        }
      }
    }

    // ============================================================
    // RECOVERY PROGRESS (always show)
    // ============================================================
    sections.push('');
    if (isCsection) {
      sections.push(`📊 সিজারের পর ${toBengaliNumber(postpartumDays)} দিন। ${recovery.description}। সুস্থতা ${toBengaliNumber(recovery.percentComplete)}%।`);
    } else {
      sections.push(`📊 ডেলিভারির পর ${toBengaliNumber(postpartumDays)} দিন। ${recovery.description}। সুস্থতা ${toBengaliNumber(recovery.percentComplete)}%।`);
    }

    // ============================================================
    // CLOSING — always encouraging
    // ============================================================
    sections.push('');
    sections.push(`${motherName}, আপনি দারুণ মা। নিজের যত্ন নিন। 💚`);

    return sections.join('\n');
  };


  // ============================================================
  // REUSABLE OPTION BUTTON
  // ============================================================

  const OptionButton = ({ label, emoji, isSelected, onPress, selectedColor, selectedBg }) => (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flex: 1,
        padding: 14,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: isSelected ? (selectedColor || COLORS.mother) : '#E0E0E0',
        backgroundColor: isSelected ? (selectedBg || '#FCE4EC') : '#FAFAFA',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 60
      }}
    >
      {emoji && <Text style={{ fontSize: 24, marginBottom: 4 }}>{emoji}</Text>}
      <Text style={{
        fontSize: 14,
        color: isSelected ? (selectedColor || COLORS.mother) : COLORS.gray,
        fontWeight: isSelected ? 'bold' : 'normal',
        textAlign: 'center'
      }}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  // ============================================================
  // COUNTER COMPONENT
  // ============================================================

  const Counter = ({ value, onIncrement, onDecrement, label, target, emoji, color }) => (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FAFAFA',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1.5,
      borderColor: value >= target ? (color || COLORS.mother) : '#E0E0E0'
    }}>
      <Text style={{ fontSize: 28, marginRight: 12 }}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.dark }}>{label}</Text>
        {target && (
          <Text style={{ fontSize: 12, color: COLORS.lightGray, marginTop: 2 }}>
            লক্ষ্য: {toBengaliNumber(target)}
          </Text>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TouchableOpacity
          onPress={onDecrement}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: value > 0 ? '#FFEBEE' : '#F5F5F5',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <Text style={{ fontSize: 20, color: value > 0 ? COLORS.danger : '#BDBDBD' }}>−</Text>
        </TouchableOpacity>

        <Text style={{
          fontSize: 24,
          fontWeight: 'bold',
          color: value >= (target || 999) ? (color || COLORS.mother) : COLORS.dark,
          minWidth: 30,
          textAlign: 'center'
        }}>
          {toBengaliNumber(value)}
        </Text>

        <TouchableOpacity
          onPress={onIncrement}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: '#E8F5E9',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <Text style={{ fontSize: 20, color: COLORS.primary }}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>

      {/* HEADER */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0'
      }}>
        <TouchableOpacity
          onPress={onBack}
          style={{ flexDirection: 'row', alignItems: 'center', padding: 4 }}
        >
          <Text style={{ fontSize: 24, marginRight: 8 }}>←</Text>
          <Text style={{ fontSize: 16, color: COLORS.mother, fontWeight: 'bold' }}>
            {TEXT.messages.goBack}
          </Text>
        </TouchableOpacity>

        {/* Progress indicator for steps 0-2 */}
        {currentStep < TOTAL_STEPS - 1 && (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[0, 1, 2].map(step => (
              <View
                key={step}
                style={{
                  width: currentStep === step ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: currentStep >= step ? COLORS.mother : '#E0E0E0',
                }}
              />
            ))}
          </View>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* ============ STEP 0: MOOD ============ */}
          {currentStep === 0 && (
            <View>
              <Text style={{ fontSize: 28, marginBottom: 8 }}>💚</Text>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: COLORS.dark, marginBottom: 8 }}>
                {motherName}, আজ কেমন আছেন?
              </Text>
              <Text style={{ fontSize: 15, color: COLORS.gray, marginBottom: 32, lineHeight: 22 }}>
                {alreadyCheckedIn ? 'আজকের চেক-ইন আপডেট করুন' : 'আজকের মনের অবস্থা বলুন'}
              </Text>

              <View style={{ gap: 12 }}>
                {[
                  { id: 'happy', emoji: '😊', label: 'খুশি', sublabel: 'ভালো লাগছে', color: '#4CAF50', bg: '#E8F5E9' },
                  { id: 'okay', emoji: '😐', label: 'ঠিক আছে', sublabel: 'মোটামুটি', color: '#FF9800', bg: '#FFF3E0' },
                  { id: 'sad', emoji: '😢', label: 'বিষন্ন', sublabel: 'মন ভালো না', color: '#2196F3', bg: '#E3F2FD' },
                  { id: 'bad', emoji: '😞', label: 'খারাপ', sublabel: 'অনেক কষ্ট হচ্ছে', color: '#9C27B0', bg: '#F3E5F5' }
                ].map(item => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => setMood(item.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 18,
                      borderRadius: 14,
                      borderWidth: 2.5,
                      borderColor: mood === item.id ? item.color : '#E8E8E8',
                      backgroundColor: mood === item.id ? item.bg : '#FAFAFA',
                    }}
                  >
                    <Text style={{ fontSize: 36, marginRight: 16 }}>{item.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        fontSize: 18,
                        fontWeight: mood === item.id ? 'bold' : '600',
                        color: mood === item.id ? item.color : COLORS.dark,
                      }}>
                        {item.label}
                      </Text>
                      <Text style={{
                        fontSize: 14,
                        color: mood === item.id ? item.color : COLORS.lightGray,
                        marginTop: 2
                      }}>
                        {item.sublabel}
                      </Text>
                    </View>
                    {mood === item.id && (
                      <Text style={{ fontSize: 20, color: item.color }}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Next */}
              <TouchableOpacity
                onPress={() => {
                  if (!mood) {
                    Alert.alert('', 'আজকের মনের অবস্থা বলুন');
                    return;
                  }
                  goNext();
                }}
                style={{
                  backgroundColor: mood ? COLORS.mother : '#E0E0E0',
                  padding: 16,
                  borderRadius: 12,
                  alignItems: 'center',
                  marginTop: 24
                }}
                disabled={!mood}
              >
                <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
                  পরবর্তী →
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ============ STEP 1: PHYSICAL ============ */}
          {currentStep === 1 && (
            <View>
              <Text style={{ fontSize: 28, marginBottom: 8 }}>🩺</Text>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: COLORS.dark, marginBottom: 8 }}>
                শরীর কেমন আছে?
              </Text>
              <Text style={{ fontSize: 15, color: COLORS.gray, marginBottom: 28, lineHeight: 22 }}>
                শুধু যেটা প্রযোজ্য সেটা বলুন
              </Text>

              {/* Bleeding */}
              <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.dark, marginBottom: 10 }}>
                রক্তপাত
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
                {[
                  { id: 'none', label: 'নেই', emoji: '✅' },
                  { id: 'light', label: 'হালকা', emoji: '🔸' },
                  { id: 'moderate', label: 'মাঝারি', emoji: '🔶' },
                  { id: 'heavy', label: 'বেশি', emoji: '🔴' }
                ].map(item => (
                  <OptionButton
                    key={item.id}
                    label={item.label}
                    emoji={item.emoji}
                    isSelected={bleeding === item.id}
                    onPress={() => setBleeding(item.id)}
                  />
                ))}
              </View>

              {/* Pain */}
              <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.dark, marginBottom: 10 }}>
                ব্যথা
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
                {[
                  { id: 'none', label: 'নেই' },
                  { id: 'low', label: 'হালকা' },
                  { id: 'medium', label: 'মাঝারি' },
                  { id: 'high', label: 'তীব্র' }
                ].map(item => (
                  <OptionButton
                    key={item.id}
                    label={item.label}
                    isSelected={pain === item.id}
                    onPress={() => setPain(item.id)}
                  />
                ))}
              </View>

              {/* C-section healing (only if csection) */}
              {isCsection && (
                <>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.dark, marginBottom: 10 }}>
                    সেলাই কেমন?
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
                    {[
                      { id: 'improving', label: 'ভালো হচ্ছে', emoji: '✅' },
                      { id: 'same', label: 'একই আছে', emoji: '➡️' },
                      { id: 'worsening', label: 'খারাপ হচ্ছে', emoji: '⚠️' }
                    ].map(item => (
                      <OptionButton
                        key={item.id}
                        label={item.label}
                        emoji={item.emoji}
                        isSelected={csectionHealing === item.id}
                        onPress={() => setCsectionHealing(item.id)}
                      />
                    ))}
                  </View>
                </>
              )}

              {/* Breast pain */}
              <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.dark, marginBottom: 10 }}>
                স্তনে ব্যথা বা ফোলা?
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
                <OptionButton
                  label="না"
                  emoji="✅"
                  isSelected={breastPain === false}
                  onPress={() => setBreastPain(false)}
                  selectedColor={COLORS.primary}
                  selectedBg="#E8F5E9"
                />
                <OptionButton
                  label="হ্যাঁ"
                  emoji="😣"
                  isSelected={breastPain === true}
                  onPress={() => setBreastPain(true)}
                />
              </View>

              {/* Buttons */}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                <TouchableOpacity
                  onPress={goBack}
                  style={{
                    flex: 1,
                    padding: 16,
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: '#E0E0E0',
                    alignItems: 'center'
                  }}
                >
                  <Text style={{ color: COLORS.gray, fontSize: 16, fontWeight: '600' }}>← আগে</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={goNext}
                  style={{
                    flex: 2,
                    backgroundColor: COLORS.mother,
                    padding: 16,
                    borderRadius: 12,
                    alignItems: 'center'
                  }}
                >
                  <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>পরবর্তী →</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ============ STEP 2: SELF-CARE ============ */}
          {currentStep === 2 && (
            <View>
              <Text style={{ fontSize: 28, marginBottom: 8 }}>🌸</Text>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: COLORS.dark, marginBottom: 8 }}>
                নিজের যত্ন
              </Text>
              <Text style={{ fontSize: 15, color: COLORS.gray, marginBottom: 28, lineHeight: 22 }}>
                আপনি সুস্থ থাকলে শিশুও ভালো থাকবে
              </Text>

              {/* Water */}
              <Counter
                value={waterIntake}
                onIncrement={() => setWaterIntake(Math.min(waterIntake + 1, 15))}
                onDecrement={() => setWaterIntake(Math.max(waterIntake - 1, 0))}
                label="পানি (গ্লাস)"
                target={8}
                emoji="💧"
                color="#2196F3"
              />

              {/* Meals */}
              <Counter
                value={mealsEaten}
                onIncrement={() => setMealsEaten(Math.min(mealsEaten + 1, 5))}
                onDecrement={() => setMealsEaten(Math.max(mealsEaten - 1, 0))}
                label="খাবার (বেলা)"
                target={3}
                emoji="🍽️"
                color="#FF9800"
              />

              {/* Breastfeeding */}
              <Counter
                value={breastfeedingSessions}
                onIncrement={() => setBreastfeedingSessions(Math.min(breastfeedingSessions + 1, 20))}
                onDecrement={() => setBreastfeedingSessions(Math.max(breastfeedingSessions - 1, 0))}
                label="দুধ খাওয়ানো (বার)"
                target={8}
                emoji="🤱"
                color={COLORS.mother}
              />

              {/* Sleep */}
              <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.dark, marginBottom: 10 }}>
                গতরাতে কত ঘন্টা ঘুম হয়েছে?
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
                {[
                  { id: '1-2', label: '১-২', emoji: '😫' },
                  { id: '3-4', label: '৩-৪', emoji: '😣' },
                  { id: '5-6', label: '৫-৬', emoji: '😌' },
                  { id: '7+', label: '৭+', emoji: '😴' }
                ].map(item => (
                  <OptionButton
                    key={item.id}
                    label={item.label}
                    emoji={item.emoji}
                    isSelected={sleepHours === item.id}
                    onPress={() => setSleepHours(item.id)}
                    selectedColor="#5C6BC0"
                    selectedBg="#E8EAF6"
                  />
                ))}
              </View>

              {/* Help */}
              <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.dark, marginBottom: 10 }}>
                আজ কেউ সাহায্য করেছে?
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 32 }}>
                <OptionButton
                  label="হ্যাঁ"
                  emoji="🤝"
                  isSelected={hadHelp === true}
                  onPress={() => setHadHelp(true)}
                  selectedColor={COLORS.primary}
                  selectedBg="#E8F5E9"
                />
                <OptionButton
                  label="না, একাই"
                  emoji="😔"
                  isSelected={hadHelp === false}
                  onPress={() => setHadHelp(false)}
                />
              </View>

              {/* Buttons */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  onPress={goBack}
                  style={{
                    flex: 1,
                    padding: 16,
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: '#E0E0E0',
                    alignItems: 'center'
                  }}
                >
                  <Text style={{ color: COLORS.gray, fontSize: 16, fontWeight: '600' }}>← আগে</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  style={{
                    flex: 2,
                    backgroundColor: COLORS.mother,
                    padding: 16,
                    borderRadius: 12,
                    alignItems: 'center'
                  }}
                >
                  <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
                    সংরক্ষণ ও দেখুন 💚
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ============ STEP 3: HAFSA'S RESPONSE ============ */}
          {currentStep === 3 && (
            <View>
              {/* Recovery Progress Bar */}
              <View style={{
                backgroundColor: '#FFF0F3',
                borderRadius: 16,
                padding: 20,
                marginBottom: 20
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: COLORS.mother }}>
                    সুস্থতার অগ্রগতি
                  </Text>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: COLORS.mother }}>
                    {toBengaliNumber(recovery.percentComplete)}%
                  </Text>
                </View>
                <View style={{
                  height: 10,
                  backgroundColor: '#F8BBD0',
                  borderRadius: 5,
                  overflow: 'hidden'
                }}>
                  <View style={{
                    height: '100%',
                    width: `${recovery.percentComplete}%`,
                    backgroundColor: COLORS.mother,
                    borderRadius: 5
                  }} />
                </View>
                <Text style={{ fontSize: 13, color: COLORS.mother, marginTop: 8 }}>
                  {recovery.description} • {isCsection ? 'সিজার' : 'নরমাল'} • দিন {toBengaliNumber(postpartumDays)}
                </Text>
              </View>

              {/* Hafsa's Message */}
              <View style={{
                backgroundColor: COLORS.primaryLight,
                borderRadius: 16,
                padding: 20,
                borderLeftWidth: 5,
                borderLeftColor: COLORS.primary
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                  <Text style={{ fontSize: 28, marginRight: 10 }}>💚</Text>
                  <View>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.primaryDark }}>
                      হাফসা আপা বলছে
                    </Text>
                    <Text style={{ fontSize: 12, color: COLORS.primary }}>
                      আপনার আজকের চেক-ইনের উপর ভিত্তি করে
                    </Text>
                  </View>
                </View>

                <Text style={{
                  fontSize: 15,
                  color: COLORS.primaryDarker,
                  lineHeight: 25
                }}>
                  {getHafsaResponse()}
                </Text>
              </View>

              {/* EPDS Assessment Prompt — shows when due */}
              {epdsIsDue && onNavigateEPDS && (
                <TouchableOpacity
                  onPress={onNavigateEPDS}
                  style={{
                    backgroundColor: '#F3E5F5',
                    borderRadius: 16,
                    padding: 20,
                    marginTop: 20,
                    borderLeftWidth: 5,
                    borderLeftColor: '#9C27B0',
                    flexDirection: 'row',
                    alignItems: 'center'
                  }}
                >
                  <Text style={{ fontSize: 32, marginRight: 14 }}>💜</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#7B1FA2', marginBottom: 4 }}>
                      মানসিক স্বাস্থ্য মূল্যায়ন
                    </Text>
                    <Text style={{ fontSize: 13, color: '#9C27B0', lineHeight: 18 }}>
                      ২ সপ্তাহ হয়ে গেছে। ৩ মিনিটের একটি মূল্যায়ন করুন — এটা আপনার জন্য গুরুত্বপূর্ণ।
                    </Text>
                  </View>
                  <Text style={{ fontSize: 20, color: '#9C27B0' }}>→</Text>
                </TouchableOpacity>
              )}

              {/* Action buttons */}
              <View style={{ gap: 12, marginTop: 24 }}>
                <TouchableOpacity
                  onPress={onBack}
                  style={{
                    backgroundColor: COLORS.mother,
                    padding: 16,
                    borderRadius: 12,
                    alignItems: 'center'
                  }}
                >
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
                    ধন্যবাদ, হোমে যাই
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => animateTransition(0)}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    alignItems: 'center',
                    borderWidth: 1.5,
                    borderColor: '#E0E0E0'
                  }}
                >
                  <Text style={{ color: COLORS.gray, fontSize: 14 }}>
                    আবার চেক-ইন আপডেট করি
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Medical Disclaimer */}
              <View style={{
                backgroundColor: '#FFF8E1',
                padding: 12,
                borderRadius: 8,
                marginTop: 20,
                borderLeftWidth: 3,
                borderLeftColor: '#FFC107'
              }}>
                <Text style={{ fontSize: 12, color: '#F57F17', lineHeight: 18 }}>
                  ⚠️ এটি চিকিৎসা পরামর্শ নয়। তীব্র ব্যথা, অতিরিক্ত রক্তপাত, জ্বর, বা মানসিক সংকটে অবশ্যই ডাক্তার দেখান।
                </Text>
              </View>
            </View>
          )}

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}