// screens/OnboardingScreen.js
// Multi-step onboarding: Welcome → Baby Info → Mother Info → Personalized Welcome
// First impression of the app — must feel warm, caring, and professional

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatDateInput, calculateAge, toBengaliNumber, getRecoveryStage } from '../utils/helpers';
import { COLORS } from '../utils/constants';
import { BD_DIVISIONS, BD_DISTRICTS, BD_ABROAD } from '../data/bdLocations';
import { supabase } from '../supabaseClient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOTAL_STEPS = 5; // Welcome, Baby, Mother, Location, Personalized Welcome

export default function OnboardingScreen({ onComplete }) {
  // Current step
  const [currentStep, setCurrentStep] = useState(0);

  // Baby data
  const [babyName, setBabyName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');

  // Mother data
  const [motherName, setMotherName] = useState('');
  const [deliveryType, setDeliveryType] = useState('');
  const [isFirstBaby, setIsFirstBaby] = useState(null);
  const [currentConcerns, setCurrentConcerns] = useState([]);
  // Location data
  const [division, setDivision] = useState('');
  const [district, setDistrict] = useState('');
  const [isAbroad, setIsAbroad] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef(null);

  // ============================================================
  // NAVIGATION
  // ============================================================

  const animateTransition = (nextStep) => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      setCurrentStep(nextStep);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, 150);
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
  // VALIDATION
  // ============================================================

  const validateBabyStep = () => {
    if (!babyName.trim()) {
      Alert.alert('', 'শিশুর নাম লিখুন');
      return false;
    }
    if (!birthDate || birthDate.length !== 10) {
      Alert.alert('', 'জন্ম তারিখ লিখুন (DD-MM-YYYY)');
      return false;
    }
    const dateRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
    if (!dateRegex.test(birthDate)) {
      Alert.alert('', 'তারিখের ফরম্যাট সঠিক নয়');
      return false;
    }
    if (!gender) {
      Alert.alert('', 'লিঙ্গ নির্বাচন করুন');
      return false;
    }
    return true;
  };

  const validateMotherStep = () => {
    if (!motherName.trim()) {
      Alert.alert('', 'আপনার নাম লিখুন');
      return false;
    }
    if (!deliveryType) {
      Alert.alert('', 'ডেলিভারির ধরন নির্বাচন করুন');
      return false;
    }
    if (isFirstBaby === null) {
      Alert.alert('', 'এটি কি আপনার প্রথম সন্তান?');
      return false;
    }
    return true;
  };

  // ============================================================
  // SAVE & COMPLETE
  // ============================================================

  const handleComplete = async () => {
    setLoading(true);
    try {
      const [day, month, year] = birthDate.split('-');
      const formattedDate = `${year}-${month}-${day}`;

      // Get real user ID from Supabase auth
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || 'local-' + Date.now();

      const babyData = {
        id: 'baby-' + Date.now(),
        user_id: userId,
        name: babyName.trim(),
        birth_date: formattedDate,
        gender: gender,
        created_at: new Date().toISOString()
      };

      const motherData = {
        name: motherName.trim(),
        delivery_type: deliveryType,
        delivery_date: formattedDate,
        is_first_baby: isFirstBaby,
        concerns: currentConcerns,
        division: division || null,
        district: district || null,
        created_at: new Date().toISOString()
      };

      if (onComplete) {
        onComplete(babyData, motherData);
      }

    } catch (error) {
      Alert.alert('ত্রুটি', 'কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন।');
      console.error('Onboarding error:', error);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // HELPERS
  // ============================================================

  const getAgeDisplay = () => {
    if (birthDate.length !== 10) return '';
    try {
      const [day, month, year] = birthDate.split('-');
      const formattedDate = `${year}-${month}-${day}`;
      const ageInfo = calculateAge(formattedDate);
      return ageInfo.bengaliAge;
    } catch {
      return '';
    }
  };

  const getPersonalizedWelcome = () => {
    const ageDisplay = getAgeDisplay();
    const [day, month, year] = birthDate.split('-');
    const formattedDate = `${year}-${month}-${day}`;
    const ageInfo = calculateAge(formattedDate);
    const recovery = getRecoveryStage(ageInfo.ageDays, deliveryType === 'csection' ? 'csection' : 'normal');

    const lines = [];

    // Greeting
    lines.push(`আসসালামু আলাইকুম ${motherName}!`);
    lines.push('');

    // Baby info
    lines.push(`${babyName} এর বয়স এখন ${ageDisplay}। ${gender === 'male' ? 'মাশাআল্লাহ, সুন্দর ছেলে!' : 'মাশাআল্লাহ, সুন্দর মেয়ে!'}`);
    lines.push('');

    // Recovery context
    if (deliveryType === 'csection') {
      lines.push(`আপনার সিজারের পর ${toBengaliNumber(ageInfo.ageDays)} দিন হয়েছে। ${recovery.description}। আপনি ${toBengaliNumber(recovery.percentComplete)}% সুস্থ হয়ে উঠেছেন।`);
    } else {
      lines.push(`নরমাল ডেলিভারির পর ${toBengaliNumber(ageInfo.ageDays)} দিন হয়েছে। ${recovery.description}।`);
    }
    lines.push('');

    // First baby context
    if (isFirstBaby) {
      lines.push('প্রথম সন্তান! নতুন মা হিসেবে অনেক প্রশ্ন থাকবে — এটা একদম স্বাভাবিক। আমি আপনার পাশে আছি।');
    } else {
      lines.push('অভিজ্ঞ মা হিসেবে আপনি অনেক কিছু জানেন। তবুও প্রতিটি শিশু আলাদা — যেকোনো প্রশ্নে আমি আছি।');
    }
    lines.push('');

    // Concerns response
    if (currentConcerns.length > 0) {
      lines.push('আপনার উদ্বেগের বিষয়গুলো আমি বুঝেছি:');
      if (currentConcerns.includes('sleep')) {
        lines.push('😴 ঘুমের সমস্যা — আমি প্রতিদিন আপনার ঘুমের খোঁজ নেব।');
      }
      if (currentConcerns.includes('feeding')) {
        lines.push('🍼 দুধ/খাওয়ানো — খাওয়ানোর প্যাটার্ন ট্র্যাক করব এবং পরামর্শ দেব।');
      }
      if (currentConcerns.includes('mood')) {
        lines.push('💚 মানসিক স্বাস্থ্য — আপনার মনের খবর নেব, এটা খুব গুরুত্বপূর্ণ।');
      }
      if (currentConcerns.includes('pain')) {
        lines.push('🩹 ব্যথা/সুস্থতা — শরীর সেরে ওঠার অগ্রগতি দেখাব।');
      }
      if (currentConcerns.includes('milk')) {
        lines.push('🤱 দুধের পরিমাণ — বুকের দুধের সরবরাহ ট্র্যাক করব।');
      }
      if (currentConcerns.includes('weight')) {
        lines.push('📈 শিশুর ওজন — WHO চার্ট অনুযায়ী বৃদ্ধি দেখাব।');
      }
      lines.push('');
    }

    // Closing
    lines.push('আমি হাফসা আপা — আপনার আর ' + babyName + ' এর পাশে আছি। 💚');

    return lines.join('\n');
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >

        {/* PROGRESS BAR */}
        {currentStep > 0 && currentStep < TOTAL_STEPS - 1 && (
          <View style={{ paddingHorizontal: 24, paddingTop: 16 }}>
            <View style={{
              flexDirection: 'row',
              gap: 8,
            }}>
              {[1, 2, 3].map((step) => (
                <View
                  key={step}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: currentStep >= step ? COLORS.primary : '#E0E0E0',
                  }}
                />
              ))}
            </View>
            <Text style={{ fontSize: 13, color: COLORS.gray, marginTop: 8 }}>
              ধাপ {toBengaliNumber(currentStep)}/৩
            </Text>
          </View>
        )}

        <ScrollView
        ref={scrollRef}
          contentContainerStyle={{ flexGrow: 1, padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>

            {/* ============ STEP 0: WELCOME ============ */}
            {currentStep === 0 && (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 60, marginBottom: 24 }}>💚</Text>

                <Text style={{
                  fontSize: 32,
                  fontWeight: 'bold',
                  color: COLORS.primary,
                  marginBottom: 12,
                  textAlign: 'center'
                }}>
                  হাফসা স্বাস্থ্য
                </Text>

                <Text style={{
                  fontSize: 18,
                  color: COLORS.gray,
                  textAlign: 'center',
                  marginBottom: 8,
                  lineHeight: 28
                }}>
                  মা ও শিশুর যত্নে আপনার AI সহায়ক
                </Text>

                <Text style={{
                  fontSize: 15,
                  color: COLORS.lightGray,
                  textAlign: 'center',
                  marginBottom: 48,
                  lineHeight: 24,
                  paddingHorizontal: 20
                }}>
                  বাংলাদেশের প্রথম AI-ভিত্তিক মা ও শিশু স্বাস্থ্য অ্যাপ।{'\n'}
                  আপনার এবং আপনার শিশুর যত্ন নেবে হাফসা আপা।
                </Text>

                <TouchableOpacity
                  onPress={goNext}
                  style={{
                    backgroundColor: COLORS.primary,
                    paddingHorizontal: 48,
                    paddingVertical: 16,
                    borderRadius: 30,
                    shadowColor: COLORS.primary,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 5
                  }}
                >
                  <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
                    শুরু করুন →
                  </Text>
                </TouchableOpacity>

                <Text style={{
                  fontSize: 12,
                  color: COLORS.lightGray,
                  textAlign: 'center',
                  marginTop: 24
                }}>
                  এটি চিকিৎসা পরামর্শ নয়। গুরুতর সমস্যায় ডাক্তার দেখান।
                </Text>
              </View>
            )}

            {/* ============ STEP 1: BABY INFO ============ */}
            {currentStep === 1 && (
              <View>
                <Text style={{
                  fontSize: 26,
                  fontWeight: 'bold',
                  color: COLORS.dark,
                  marginBottom: 8,
                  marginTop: 16
                }}>
                  👶 শিশুর তথ্য
                </Text>
                <Text style={{
                  fontSize: 15,
                  color: COLORS.gray,
                  marginBottom: 32,
                  lineHeight: 22
                }}>
                  আপনার শিশুর ব্যাপারে কিছু তথ্য দিন
                </Text>

                {/* Baby Name */}
                <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.dark, marginBottom: 8 }}>
                  শিশুর নাম
                </Text>
                <TextInput
                  style={{
                    borderWidth: 1.5,
                    borderColor: babyName ? COLORS.primary : '#E0E0E0',
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 16,
                    backgroundColor: '#FAFAFA',
                    marginBottom: 24
                  }}
                  placeholder="শিশুর নাম লিখুন"
                  placeholderTextColor="#BDBDBD"
                  value={babyName}
                  onChangeText={setBabyName}
                />

                {/* Birth Date */}
                <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.dark, marginBottom: 8 }}>
                  জন্ম তারিখ
                </Text>
                <TextInput
                  style={{
                    borderWidth: 1.5,
                    borderColor: birthDate.length === 10 ? COLORS.primary : '#E0E0E0',
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 16,
                    backgroundColor: '#FAFAFA',
                    marginBottom: 8
                  }}
                  placeholder="DD-MM-YYYY"
                  placeholderTextColor="#BDBDBD"
                  value={birthDate}
                  onChangeText={(text) => setBirthDate(formatDateInput(text))}
                  maxLength={10}
                  keyboardType="number-pad"
                />
                {getAgeDisplay() ? (
                  <Text style={{ fontSize: 14, color: COLORS.primary, marginBottom: 24 }}>
                    বয়স: {getAgeDisplay()}
                  </Text>
                ) : (
                  <View style={{ marginBottom: 24 }} />
                )}

                {/* Gender */}
                <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.dark, marginBottom: 12 }}>
                  লিঙ্গ
                </Text>
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 32 }}>
                  {[
                    { id: 'male', label: 'ছেলে', emoji: '👦' },
                    { id: 'female', label: 'মেয়ে', emoji: '👧' }
                  ].map(item => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => setGender(item.id)}
                      style={{
                        flex: 1,
                        padding: 16,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: gender === item.id ? COLORS.primary : '#E0E0E0',
                        backgroundColor: gender === item.id ? COLORS.primaryLight : '#FAFAFA',
                        alignItems: 'center',
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: 8
                      }}
                    >
                      <Text style={{ fontSize: 20 }}>{item.emoji}</Text>
                      <Text style={{
                        fontSize: 16,
                        color: gender === item.id ? COLORS.primary : COLORS.gray,
                        fontWeight: gender === item.id ? 'bold' : 'normal'
                      }}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Next Button */}
                <TouchableOpacity
                  onPress={() => {
                    if (validateBabyStep()) goNext();
                  }}
                  style={{
                    backgroundColor: COLORS.primary,
                    padding: 16,
                    borderRadius: 12,
                    alignItems: 'center'
                  }}
                >
                  <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
                    পরবর্তী →
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ============ STEP 2: MOTHER INFO ============ */}
            {currentStep === 2 && (
              <View>
                <Text style={{
                  fontSize: 26,
                  fontWeight: 'bold',
                  color: COLORS.dark,
                  marginBottom: 8,
                  marginTop: 16
                }}>
                  🤱 আপনার তথ্য
                </Text>
                <Text style={{
                  fontSize: 15,
                  color: COLORS.gray,
                  marginBottom: 32,
                  lineHeight: 22
                }}>
                  আপনাকে আরও ভালোভাবে সাহায্য করতে কিছু তথ্য দিন
                </Text>

                {/* Mother's Name */}
                <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.dark, marginBottom: 8 }}>
                  আপনার নাম
                </Text>
                <TextInput
                  style={{
                    borderWidth: 1.5,
                    borderColor: motherName ? COLORS.mother : '#E0E0E0',
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 16,
                    backgroundColor: '#FAFAFA',
                    marginBottom: 24
                  }}
                  placeholder="আপনার নাম লিখুন"
                  placeholderTextColor="#BDBDBD"
                  value={motherName}
                  onChangeText={setMotherName}
                />

                {/* Delivery Type */}
                <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.dark, marginBottom: 12 }}>
                  ডেলিভারির ধরন
                </Text>
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                  {[
                    { id: 'normal', label: 'নরমাল', emoji: '🌿' },
                    { id: 'csection', label: 'সিজার', emoji: '🏥' }
                  ].map(item => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => setDeliveryType(item.id)}
                      style={{
                        flex: 1,
                        padding: 16,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: deliveryType === item.id ? COLORS.mother : '#E0E0E0',
                        backgroundColor: deliveryType === item.id ? '#FCE4EC' : '#FAFAFA',
                        alignItems: 'center',
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: 8
                      }}
                    >
                      <Text style={{ fontSize: 20 }}>{item.emoji}</Text>
                      <Text style={{
                        fontSize: 16,
                        color: deliveryType === item.id ? COLORS.mother : COLORS.gray,
                        fontWeight: deliveryType === item.id ? 'bold' : 'normal'
                      }}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* First Baby */}
                <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.dark, marginBottom: 12 }}>
                  এটি কি আপনার প্রথম সন্তান?
                </Text>
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                  {[
                    { id: true, label: 'হ্যাঁ, প্রথম' },
                    { id: false, label: 'না, আগেও আছে' }
                  ].map(item => (
                    <TouchableOpacity
                      key={String(item.id)}
                      onPress={() => setIsFirstBaby(item.id)}
                      style={{
                        flex: 1,
                        padding: 14,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: isFirstBaby === item.id ? COLORS.mother : '#E0E0E0',
                        backgroundColor: isFirstBaby === item.id ? '#FCE4EC' : '#FAFAFA',
                        alignItems: 'center'
                      }}
                    >
                      <Text style={{
                        fontSize: 15,
                        color: isFirstBaby === item.id ? COLORS.mother : COLORS.gray,
                        fontWeight: isFirstBaby === item.id ? 'bold' : 'normal'
                      }}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Current Concerns (optional, multi-select) */}
                <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.dark, marginBottom: 8 }}>
                  এখন কোন বিষয়ে উদ্বিগ্ন? (ঐচ্ছিক)
                </Text>
                <Text style={{ fontSize: 13, color: COLORS.lightGray, marginBottom: 12 }}>
                  একাধিক নির্বাচন করতে পারেন
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 32 }}>
                  {[
                    { id: 'sleep', label: '😴 ঘুমের সমস্যা' },
                    { id: 'feeding', label: '🍼 খাওয়ানো' },
                    { id: 'mood', label: '💚 মানসিক স্বাস্থ্য' },
                    { id: 'pain', label: '🩹 ব্যথা/সুস্থতা' },
                    { id: 'milk', label: '🤱 দুধের পরিমাণ' },
                    { id: 'weight', label: '📈 শিশুর ওজন' }
                  ].map(item => {
                    const isSelected = currentConcerns.includes(item.id);
                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => {
                          if (isSelected) {
                            setCurrentConcerns(currentConcerns.filter(c => c !== item.id));
                          } else {
                            setCurrentConcerns([...currentConcerns, item.id]);
                          }
                        }}
                        style={{
                          paddingHorizontal: 16,
                          paddingVertical: 10,
                          borderRadius: 20,
                          borderWidth: 2,
                          borderColor: isSelected ? COLORS.mother : '#E0E0E0',
                          backgroundColor: isSelected ? '#FCE4EC' : '#FAFAFA',
                        }}
                      >
                        <Text style={{
                          fontSize: 14,
                          color: isSelected ? COLORS.mother : COLORS.gray,
                          fontWeight: isSelected ? 'bold' : 'normal'
                        }}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
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
                    <Text style={{ color: COLORS.gray, fontSize: 16, fontWeight: '600' }}>
                      ← আগে
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      if (validateMotherStep()) goNext();
                    }}
                    style={{
                      flex: 2,
                      backgroundColor: COLORS.mother,
                      padding: 16,
                      borderRadius: 12,
                      alignItems: 'center'
                    }}
                  >
                    <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
                      পরবর্তী →
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
        {/* ============ STEP 3: LOCATION ============ */}
        {currentStep === 3 && (
              <View>
                <Text style={{
                  fontSize: 26,
                  fontWeight: 'bold',
                  color: COLORS.dark,
                  marginBottom: 8,
                  marginTop: 16
                }}>
                  📍 কোথায় থাকেন?
                </Text>
                <Text style={{
                  fontSize: 15,
                  color: COLORS.gray,
                  marginBottom: 28,
                  lineHeight: 22
                }}>
                  আপনার এলাকার মায়েদের জন্য আরও ভালো সেবা দিতে এটা দরকার
                </Text>

                {/* Abroad toggle */}
                <TouchableOpacity
                  onPress={() => {
                    setIsAbroad(!isAbroad);
                    setDivision('');
                    setDistrict('');
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 14,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: isAbroad ? COLORS.primary : '#E0E0E0',
                    backgroundColor: isAbroad ? COLORS.primaryLight : '#FAFAFA',
                    marginBottom: 24,
                  }}
                >
                  <Text style={{ fontSize: 20, marginRight: 10 }}>🌍</Text>
                  <Text style={{
                    fontSize: 16,
                    color: isAbroad ? COLORS.primary : COLORS.gray,
                    fontWeight: isAbroad ? 'bold' : 'normal',
                  }}>
                    বাংলাদেশের বাইরে থাকি
                  </Text>
                </TouchableOpacity>

                {!isAbroad ? (
                  <>
                    {/* Division */}
                    <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.dark, marginBottom: 12 }}>
                      বিভাগ
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
                      {BD_DIVISIONS.map(div => (
                        <TouchableOpacity
                          key={div}
                          onPress={() => {
                            setDivision(div);
                            setDistrict(''); // Reset district when division changes
                          }}
                          style={{
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderRadius: 20,
                            borderWidth: 2,
                            borderColor: division === div ? COLORS.primary : '#E0E0E0',
                            backgroundColor: division === div ? COLORS.primaryLight : '#FAFAFA',
                          }}
                        >
                          <Text style={{
                            fontSize: 15,
                            color: division === div ? COLORS.primary : COLORS.gray,
                            fontWeight: division === div ? 'bold' : 'normal',
                          }}>
                            {div}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* District — shows after division selected */}
                    {division && BD_DISTRICTS[division] && (
                      <>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.dark, marginBottom: 12 }}>
                          জেলা
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
                          {BD_DISTRICTS[division].map(dist => (
                            <TouchableOpacity
                              key={dist}
                              onPress={() => setDistrict(dist)}
                              style={{
                                paddingHorizontal: 16,
                                paddingVertical: 10,
                                borderRadius: 20,
                                borderWidth: 2,
                                borderColor: district === dist ? COLORS.primary : '#E0E0E0',
                                backgroundColor: district === dist ? COLORS.primaryLight : '#FAFAFA',
                              }}
                            >
                              <Text style={{
                                fontSize: 14,
                                color: district === dist ? COLORS.primary : COLORS.gray,
                                fontWeight: district === dist ? 'bold' : 'normal',
                              }}>
                                {dist}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {/* Abroad country */}
                    <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.dark, marginBottom: 12 }}>
                      কোন দেশে?
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
                      {BD_ABROAD.map(country => (
                        <TouchableOpacity
                          key={country}
                          onPress={() => setDivision(country)}
                          style={{
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderRadius: 20,
                            borderWidth: 2,
                            borderColor: division === country ? COLORS.primary : '#E0E0E0',
                            backgroundColor: division === country ? COLORS.primaryLight : '#FAFAFA',
                          }}
                        >
                          <Text style={{
                            fontSize: 15,
                            color: division === country ? COLORS.primary : COLORS.gray,
                            fontWeight: division === country ? 'bold' : 'normal',
                          }}>
                            {country}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

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
                    <Text style={{ color: COLORS.gray, fontSize: 16, fontWeight: '600' }}>
                      ← আগে
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={goNext}
                    style={{
                      flex: 2,
                      backgroundColor: COLORS.primary,
                      padding: 16,
                      borderRadius: 12,
                      alignItems: 'center'
                    }}
                  >
                    <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
                      {division ? 'পরবর্তী →' : 'এড়িয়ে যান →'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

       

        {/* ============ STEP 4: PERSONALIZED WELCOME ============ */}
        {currentStep === 4 && (
              <View style={{ flex: 1 }}>
                {/* Hafsa's Welcome Card */}
                <View style={{
                  backgroundColor: COLORS.primaryLight,
                  borderRadius: 20,
                  padding: 24,
                  marginTop: 16,
                  borderLeftWidth: 6,
                  borderLeftColor: COLORS.primary
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                    <Text style={{ fontSize: 36, marginRight: 12 }}>💚</Text>
                    <View>
                      <Text style={{ fontSize: 20, fontWeight: 'bold', color: COLORS.primaryDark }}>
                        হাফসা আপা বলছে
                      </Text>
                      <Text style={{ fontSize: 13, color: COLORS.primary, marginTop: 2 }}>
                        আপনার AI সহায়ক
                      </Text>
                    </View>
                  </View>

                  <Text style={{
                    fontSize: 16,
                    color: COLORS.primaryDarker,
                    lineHeight: 26,
                  }}>
                    {getPersonalizedWelcome()}
                  </Text>
                </View>

                {/* What Hafsa Can Do */}
                <View style={{ marginTop: 24 }}>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.dark, marginBottom: 16 }}>
                    হাফসা আপা যা করবে:
                  </Text>

                  {[
                    { emoji: '👶', text: `${babyName} এর খাওয়া, ঘুম, ডায়াপার ট্র্যাক করবে` },
                    { emoji: '🤱', text: 'আপনার শারীরিক সুস্থতা দেখবে' },
                    { emoji: '💚', text: 'মনের খবর নেবে প্রতিদিন' },
                    { emoji: '💉', text: 'টিকার সময় মনে করিয়ে দেবে' },
                    { emoji: '📈', text: 'শিশুর বৃদ্ধি WHO চার্টে দেখাবে' },
                    { emoji: '🆘', text: 'জরুরি লক্ষণে সতর্ক করবে' }
                  ].map((item, index) => (
                    <View key={index} style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginBottom: 12,
                      paddingLeft: 8
                    }}>
                      <Text style={{ fontSize: 20, marginRight: 12 }}>{item.emoji}</Text>
                      <Text style={{ fontSize: 15, color: COLORS.dark, flex: 1, lineHeight: 22 }}>
                        {item.text}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Medical Disclaimer */}
                <View style={{
                  backgroundColor: '#FFF8E1',
                  padding: 14,
                  borderRadius: 10,
                  marginTop: 20,
                  borderLeftWidth: 4,
                  borderLeftColor: '#FFC107'
                }}>
                  <Text style={{ fontSize: 13, color: '#F57F17', lineHeight: 20 }}>
                    ⚠️ হাফসা আপা AI-ভিত্তিক সহায়ক। এটি চিকিৎসা পরামর্শ নয়। গুরুতর সমস্যায় অবশ্যই ডাক্তার দেখান।
                  </Text>
                </View>

                {/* Start Button */}
                <TouchableOpacity
                  onPress={handleComplete}
                  disabled={loading}
                  style={{
                    backgroundColor: COLORS.primary,
                    padding: 18,
                    borderRadius: 14,
                    alignItems: 'center',
                    marginTop: 24,
                    shadowColor: COLORS.primary,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 5
                  }}
                >
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
                      শুরু করি! 💚
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Back option */}
                <TouchableOpacity
                  onPress={goBack}
                  style={{ marginTop: 16, alignItems: 'center' }}
                >
                  <Text style={{ color: COLORS.gray, fontSize: 14 }}>
                    ← তথ্য পরিবর্তন করুন
                  </Text>
                </TouchableOpacity>
              </View>
            )}

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}