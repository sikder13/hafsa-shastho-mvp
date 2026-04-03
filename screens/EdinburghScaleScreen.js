// screens/EdinburghScaleScreen.js
// Culturally adapted Edinburgh Postnatal Depression Scale (EPDS) for Bengali mothers
// Based on validated Bangla EPDS (Gausia et al., 2007; Maity et al., 2015)
// 10 questions, scored 0-3 each. Total 0-30.
// Cutoff: 10+ possible depression, 13+ likely depression
// Triggered every 2 weeks from MotherCheckInScreen
//
// IMPORTANT: This is a screening tool, NOT a diagnosis.
// Cox, J.L., Holden, J.M., & Sagovsky, R. (1987).
// Detection of postnatal depression: Development of the 10-item
// Edinburgh Postnatal Depression Scale. British Journal of Psychiatry, 150, 782-786.

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../context/AppContext';
import { syncEPDS } from '../services/supabaseService';
import { scheduleEPDSReminder } from '../services/notificationService';
import { toBengaliNumber } from '../utils/helpers';
import { COLORS, STORAGE_KEYS } from '../utils/constants';
//import { syncEPDS } from '../services/supabaseService';

// ============================================================
// EPDS QUESTIONS — Bengali adaptation
// Each question has 4 options scored 0-3
// Questions 1, 2, 4 are scored normally (first option = 0)
// Questions 3, 5, 6, 7, 8, 9, 10 are reverse scored (first option = 3)
// ============================================================

const EPDS_QUESTIONS = [
  {
    id: 1,
    question: 'গত ৭ দিনে আমি হাসতে পেরেছি এবং জিনিসের মজার দিক দেখতে পেরেছি',
    options: [
      { label: 'আগের মতোই পেরেছি', score: 0 },
      { label: 'আগের চেয়ে কিছুটা কম', score: 1 },
      { label: 'আগের চেয়ে অনেক কম', score: 2 },
      { label: 'একদমই পারিনি', score: 3 }
    ],
    reverse: false
  },
  {
    id: 2,
    question: 'গত ৭ দিনে আমি আনন্দের সাথে কিছু করার জন্য অপেক্ষা করেছি',
    options: [
      { label: 'আগের মতোই করেছি', score: 0 },
      { label: 'আগের চেয়ে কিছুটা কম', score: 1 },
      { label: 'আগের চেয়ে অনেক কম', score: 2 },
      { label: 'একদমই না', score: 3 }
    ],
    reverse: false
  },
  {
    id: 3,
    question: 'গত ৭ দিনে কিছু ভুল হলে আমি অযথা নিজেকে দোষ দিয়েছি',
    options: [
      { label: 'হ্যাঁ, বেশিরভাগ সময়', score: 3 },
      { label: 'হ্যাঁ, মাঝে মাঝে', score: 2 },
      { label: 'খুব কম', score: 1 },
      { label: 'না, একদমই না', score: 0 }
    ],
    reverse: true
  },
  {
    id: 4,
    question: 'গত ৭ দিনে আমি বিনা কারণে চিন্তিত বা উদ্বিগ্ন হয়েছি',
    options: [
      { label: 'না, একদমই না', score: 0 },
      { label: 'খুব কম', score: 1 },
      { label: 'হ্যাঁ, মাঝে মাঝে', score: 2 },
      { label: 'হ্যাঁ, প্রায় সব সময়', score: 3 }
    ],
    reverse: false
  },
  {
    id: 5,
    question: 'গত ৭ দিনে আমি বিনা কারণে ভয় পেয়েছি বা আতঙ্কিত হয়েছি',
    options: [
      { label: 'হ্যাঁ, অনেক বেশি', score: 3 },
      { label: 'হ্যাঁ, মাঝে মাঝে', score: 2 },
      { label: 'খুব কম', score: 1 },
      { label: 'না, একদমই না', score: 0 }
    ],
    reverse: true
  },
  {
    id: 6,
    question: 'গত ৭ দিনে সব কিছু আমার মাথার উপর দিয়ে যাচ্ছে মনে হয়েছে',
    subtitle: '(সামলাতে পারছি না মনে হয়েছে)',
    options: [
      { label: 'হ্যাঁ, বেশিরভাগ সময় সামলাতে পারিনি', score: 3 },
      { label: 'হ্যাঁ, মাঝে মাঝে আগের মতো সামলাতে পারিনি', score: 2 },
      { label: 'না, বেশিরভাগ সময় ভালোই সামলেছি', score: 1 },
      { label: 'না, আগের মতোই সামলেছি', score: 0 }
    ],
    reverse: true
  },
  {
    id: 7,
    question: 'গত ৭ দিনে আমি এত অসুখী ছিলাম যে ঘুমাতে পারিনি',
    subtitle: '(শিশুর কারণে জেগে থাকা নয়, মনের কষ্টে ঘুম আসেনি)',
    options: [
      { label: 'হ্যাঁ, বেশিরভাগ সময়', score: 3 },
      { label: 'হ্যাঁ, মাঝে মাঝে', score: 2 },
      { label: 'খুব কম', score: 1 },
      { label: 'না, একদমই না', score: 0 }
    ],
    reverse: true
  },
  {
    id: 8,
    question: 'গত ৭ দিনে আমি দুঃখী বা মন খারাপ অনুভব করেছি',
    options: [
      { label: 'হ্যাঁ, বেশিরভাগ সময়', score: 3 },
      { label: 'হ্যাঁ, বেশ কয়েকবার', score: 2 },
      { label: 'খুব কম', score: 1 },
      { label: 'না, একদমই না', score: 0 }
    ],
    reverse: true
  },
  {
    id: 9,
    question: 'গত ৭ দিনে আমি এত অসুখী ছিলাম যে কাঁদছিলাম',
    options: [
      { label: 'হ্যাঁ, বেশিরভাগ সময়', score: 3 },
      { label: 'হ্যাঁ, বেশ কয়েকবার', score: 2 },
      { label: 'মাঝে মাঝে', score: 1 },
      { label: 'না, একবারও না', score: 0 }
    ],
    reverse: true
  },
  {
    id: 10,
    question: 'গত ৭ দিনে নিজেকে কষ্ট দেওয়ার চিন্তা আমার মাথায় এসেছে',
    options: [
      { label: 'হ্যাঁ, বেশ কয়েকবার', score: 3 },
      { label: 'মাঝে মাঝে', score: 2 },
      { label: 'খুব কম', score: 1 },
      { label: 'একবারও না', score: 0 }
    ],
    reverse: true,
    isCritical: true // Question 10 needs immediate attention if scored > 0
  }
];

export default function EdinburghScaleScreen({ onComplete, onBack }) {
    const { motherProfile, baby } = useApp();
  const motherName = motherProfile?.name || 'মা';

  const [currentQuestion, setCurrentQuestion] = useState(-1); // -1 = intro
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef(null);

  // ============================================================
  // NAVIGATION
  // ============================================================

  const animateTransition = (callback) => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      callback();
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, 100);
  };

  const handleAnswer = (questionId, optionIndex, score) => {
    const newAnswers = { ...answers, [questionId]: { optionIndex, score } };
    setAnswers(newAnswers);

    // Auto-advance after short delay
    setTimeout(() => {
      if (currentQuestion < EPDS_QUESTIONS.length - 1) {
        animateTransition(() => setCurrentQuestion(currentQuestion + 1));
      } else {
        // All questions answered — show results
        animateTransition(() => setShowResults(true));
        saveResults(newAnswers);
      }
    }, 300);
  };

  // ============================================================
  // SCORING
  // ============================================================

  const calculateScore = (answersObj) => {
    let total = 0;
    for (const qId in answersObj) {
      total += answersObj[qId].score;
    }
    return total;
  };

  const getScoreInterpretation = (score) => {
    if (score <= 8) {
      return {
        level: 'low',
        title: 'স্বাভাবিক',
        color: '#4CAF50',
        bg: '#E8F5E9',
        emoji: '💚'
      };
    } else if (score <= 12) {
      return {
        level: 'moderate',
        title: 'কিছুটা উদ্বেগজনক',
        color: '#FF9800',
        bg: '#FFF3E0',
        emoji: '💛'
      };
    } else {
      return {
        level: 'high',
        title: 'গুরুত্বপূর্ণ — সাহায্য নিন',
        color: '#F44336',
        bg: '#FFEBEE',
        emoji: '❤️'
      };
    }
  };

  const hasQ10Concern = () => {
    return answers[10] && answers[10].score > 0;
  };

  // ============================================================
  // SAVE
  // ============================================================

  const saveResults = async (answersObj) => {
    try {
      const score = calculateScore(answersObj);
      const result = {
        date: new Date().toISOString(),
        score: score,
        answers: answersObj,
        q10Concern: answersObj[10] ? answersObj[10].score > 0 : false
      };

      // Load history
      const historyKey = 'epds_history';
      const saved = await AsyncStorage.getItem(historyKey);
      const history = saved ? JSON.parse(saved) : [];
      history.unshift(result);

      // Keep last 12 assessments (6 months if every 2 weeks)
      if (history.length > 12) history.pop();

      await AsyncStorage.setItem(historyKey, JSON.stringify(history));

      // Save last assessment date
      await AsyncStorage.setItem('epds_last_date', new Date().toISOString());

      console.log('EPDS saved. Score:', score);
      // Sync to Supabase
      const postpartumDay = baby?.birth_date
        ? Math.floor((new Date() - new Date(baby.birth_date)) / (1000 * 60 * 60 * 24))
        : 0;
      syncEPDS({
        totalScore: score,
        answers: answersObj,
        riskLevel: score < 10 ? 'normal' : score < 13 ? 'moderate' : score < 20 ? 'high' : 'critical',
        selfHarmFlag: answersObj[10] ? answersObj[10].score > 0 : false,
      }, postpartumDay).catch(e => console.log('EPDS sync:', e.message));

      // Reschedule EPDS reminder for 2 weeks from now
      scheduleEPDSReminder(new Date().toISOString()).catch(e => console.log('EPDS reminder:', e.message));
    } catch (error) {
      console.error('Error saving EPDS:', error);
    }
  };

  // ============================================================
  // HAFSA'S RESPONSE
  // ============================================================

  const getHafsaResponse = () => {
    const score = calculateScore(answers);
    const interpretation = getScoreInterpretation(score);
    const sections = [];

    // Opening
    sections.push(`${motherName}, আপনার উত্তর দেওয়ার জন্য ধন্যবাদ। এটা সাহসের কাজ। 💚`);
    sections.push('');

    if (interpretation.level === 'low') {
      sections.push('আপনার মানসিক স্বাস্থ্য এই মুহূর্তে ভালো আছে বলে মনে হচ্ছে। এটা দারুণ খবর!');
      sections.push('');
      sections.push('তবে মনে রাখবেন — যেকোনো সময় মন খারাপ হলে বা কষ্ট পেলে আমাকে বলতে পারেন। নতুন মা হওয়া সহজ নয়, এবং সাহায্য চাওয়া দুর্বলতা নয়।');
    } else if (interpretation.level === 'moderate') {
      sections.push('আপনার উত্তর থেকে মনে হচ্ছে আপনি কিছুটা কঠিন সময়ের মধ্যে আছেন। এটা অনেক মায়ের হয় — আপনি একা নন।');
      sections.push('');
      sections.push('কিছু পরামর্শ:');
      sections.push('• বিশ্বস্ত কাউকে (স্বামী, মা, বোন, বান্ধবী) আপনার অনুভূতি জানান');
      sections.push('• প্রতিদিন অল্প সময় হলেও নিজের জন্য রাখুন');
      sections.push('• পর্যাপ্ত ঘুম ও খাওয়ার চেষ্টা করুন');
      sections.push('• ২ সপ্তাহ পর আবার এই মূল্যায়ন করব');
      sections.push('');
      sections.push('যদি অবস্থা আরও খারাপ হয়, দয়া করে ডাক্তারের সাথে কথা বলুন।');
    } else {
      sections.push('আপনার উত্তর থেকে মনে হচ্ছে আপনি এখন অনেক কষ্টের মধ্যে আছেন। এটা শুনে আমি চিন্তিত।');
      sections.push('');
      sections.push('গুরুত্বপূর্ণ কথা: এটা আপনার দোষ নয়। প্রসব-পরবর্তী বিষণ্নতা একটি চিকিৎসাযোগ্য রোগ। অনেক মায়ের হয় এবং চিকিৎসায় ভালো হয়।');
      sections.push('');
      sections.push('এখনই করুন:');
      sections.push('• আজই আপনার স্বামী বা পরিবারের কাউকে বলুন আপনি কেমন অনুভব করছেন');
      sections.push('• যত তাড়াতাড়ি সম্ভব ডাক্তারের সাথে কথা বলুন');
      sections.push('• আপনি একা নন — সাহায্য আছে');
    }

    // Question 10 concern
    if (hasQ10Concern()) {
      sections.push('');
      sections.push('⚠️ আপনি জানিয়েছেন যে নিজেকে কষ্ট দেওয়ার চিন্তা আপনার মাথায় এসেছে।');
      sections.push('');
      sections.push('এটা অনেক গুরুত্বপূর্ণ। দয়া করে:');
      sections.push('• এখনই কাউকে (স্বামী, মা, বোন) এই কথা বলুন');
      sections.push('• জাতীয় মানসিক স্বাস্থ্য হেল্পলাইন: ০১৭৭৯-৫৫৪৫৫ (কান পেতে রই)');
      sections.push('• আপনার নিকটতম হাসপাতালের জরুরি বিভাগে যান');
      sections.push('');
      sections.push('আপনি গুরুত্বপূর্ণ। আপনার শিশুর আপনাকে দরকার। সাহায্য নিন। 💚');
    }

    return sections.join('\n');
  };

  // ============================================================
  // RENDER
  // ============================================================

  const totalQuestions = EPDS_QUESTIONS.length;
  const answeredCount = Object.keys(answers).length;

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
          onPress={() => {
            if (showResults) {
              if (onComplete) onComplete();
            } else {
              onBack();
            }
          }}
          style={{ flexDirection: 'row', alignItems: 'center', padding: 4 }}
        >
          <Text style={{ fontSize: 24, marginRight: 8 }}>←</Text>
          <Text style={{ fontSize: 16, color: COLORS.mother, fontWeight: 'bold' }}>
            {showResults ? 'সম্পন্ন' : 'ফিরে যান'}
          </Text>
        </TouchableOpacity>

        {/* Progress */}
        {currentQuestion >= 0 && !showResults && (
          <Text style={{ fontSize: 14, color: COLORS.gray }}>
            {toBengaliNumber(currentQuestion + 1)}/{toBengaliNumber(totalQuestions)}
          </Text>
        )}
      </View>

      {/* PROGRESS BAR */}
      {currentQuestion >= 0 && !showResults && (
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <View style={{
            height: 4,
            backgroundColor: '#F0F0F0',
            borderRadius: 2,
            overflow: 'hidden'
          }}>
            <View style={{
              height: '100%',
              width: `${((currentQuestion + 1) / totalQuestions) * 100}%`,
              backgroundColor: COLORS.mother,
              borderRadius: 2
            }} />
          </View>
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ flexGrow: 1, padding: 24, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* ============ INTRO ============ */}
          {currentQuestion === -1 && !showResults && (
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Text style={{ fontSize: 50, textAlign: 'center', marginBottom: 24 }}>💚</Text>

              <Text style={{
                fontSize: 24,
                fontWeight: 'bold',
                color: COLORS.dark,
                textAlign: 'center',
                marginBottom: 16
              }}>
                মানসিক স্বাস্থ্য মূল্যায়ন
              </Text>

              <Text style={{
                fontSize: 16,
                color: COLORS.gray,
                textAlign: 'center',
                lineHeight: 26,
                marginBottom: 24,
                paddingHorizontal: 10
              }}>
                {motherName}, এখন কিছু প্রশ্ন জিজ্ঞেস করব। গত ৭ দিনে আপনি কেমন অনুভব করেছেন সেই অনুযায়ী উত্তর দিন।
              </Text>

              <View style={{
                backgroundColor: '#F3E5F5',
                padding: 16,
                borderRadius: 12,
                marginBottom: 24
              }}>
                <Text style={{ fontSize: 14, color: '#7B1FA2', lineHeight: 22, textAlign: 'center' }}>
                  এখানে কোনো সঠিক বা ভুল উত্তর নেই। সৎভাবে উত্তর দিন — এটা শুধু আপনার জন্য। আপনার উত্তর সম্পূর্ণ গোপনীয়।
                </Text>
              </View>

              <Text style={{
                fontSize: 13,
                color: COLORS.lightGray,
                textAlign: 'center',
                marginBottom: 32,
                lineHeight: 20
              }}>
                ১০টি প্রশ্ন • প্রায় ৩-৫ মিনিট সময় লাগবে
              </Text>

              <TouchableOpacity
                onPress={() => animateTransition(() => setCurrentQuestion(0))}
                style={{
                  backgroundColor: COLORS.mother,
                  padding: 16,
                  borderRadius: 12,
                  alignItems: 'center'
                }}
              >
                <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
                  শুরু করি →
                </Text>
              </TouchableOpacity>

              <Text style={{
                fontSize: 12,
                color: COLORS.lightGray,
                textAlign: 'center',
                marginTop: 20,
                lineHeight: 18
              }}>
                এডিনবার্গ পোস্টনেটাল ডিপ্রেশন স্কেল (EPDS){'\n'}
                Cox, Holden & Sagovsky, 1987{'\n'}
                বাংলা সংস্করণ: Gausia et al., 2007
              </Text>
            </View>
          )}

          {/* ============ QUESTIONS ============ */}
          {currentQuestion >= 0 && currentQuestion < totalQuestions && !showResults && (
            <View>
              {/* Question number and text */}
              <View style={{
                backgroundColor: '#FFF0F3',
                padding: 20,
                borderRadius: 16,
                marginBottom: 24
              }}>
                <Text style={{ fontSize: 14, color: COLORS.mother, fontWeight: 'bold', marginBottom: 8 }}>
                  প্রশ্ন {toBengaliNumber(currentQuestion + 1)}
                </Text>
                <Text style={{
                  fontSize: 18,
                  fontWeight: '600',
                  color: COLORS.dark,
                  lineHeight: 28
                }}>
                  {EPDS_QUESTIONS[currentQuestion].question}
                </Text>
                {EPDS_QUESTIONS[currentQuestion].subtitle && (
                  <Text style={{ fontSize: 14, color: COLORS.gray, marginTop: 6, lineHeight: 20 }}>
                    {EPDS_QUESTIONS[currentQuestion].subtitle}
                  </Text>
                )}
              </View>

              {/* Options */}
              <View style={{ gap: 12 }}>
                {EPDS_QUESTIONS[currentQuestion].options.map((option, index) => {
                  const isSelected = answers[EPDS_QUESTIONS[currentQuestion].id]?.optionIndex === index;
                  return (
                    <TouchableOpacity
                      key={index}
                      onPress={() => handleAnswer(
                        EPDS_QUESTIONS[currentQuestion].id,
                        index,
                        option.score
                      )}
                      style={{
                        padding: 18,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: isSelected ? COLORS.mother : '#E8E8E8',
                        backgroundColor: isSelected ? '#FCE4EC' : '#FAFAFA',
                        flexDirection: 'row',
                        alignItems: 'center'
                      }}
                    >
                      {/* Radio circle */}
                      <View style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: isSelected ? COLORS.mother : '#BDBDBD',
                        marginRight: 14,
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}>
                        {isSelected && (
                          <View style={{
                            width: 12,
                            height: 12,
                            borderRadius: 6,
                            backgroundColor: COLORS.mother
                          }} />
                        )}
                      </View>

                      <Text style={{
                        fontSize: 16,
                        color: isSelected ? COLORS.mother : COLORS.dark,
                        fontWeight: isSelected ? '600' : 'normal',
                        flex: 1,
                        lineHeight: 22
                      }}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Back button (for going to previous question) */}
              {currentQuestion > 0 && (
                <TouchableOpacity
                  onPress={() => animateTransition(() => setCurrentQuestion(currentQuestion - 1))}
                  style={{ marginTop: 20, alignItems: 'center', padding: 12 }}
                >
                  <Text style={{ color: COLORS.gray, fontSize: 14 }}>← আগের প্রশ্ন</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ============ RESULTS ============ */}
          {showResults && (
            <View>
              {(() => {
                const score = calculateScore(answers);
                const interpretation = getScoreInterpretation(score);

                return (
                  <>
                    {/* Score Card */}
                    <View style={{
                      backgroundColor: interpretation.bg,
                      borderRadius: 20,
                      padding: 24,
                      alignItems: 'center',
                      marginBottom: 20
                    }}>
                      <Text style={{ fontSize: 50, marginBottom: 12 }}>{interpretation.emoji}</Text>

                      <Text style={{
                        fontSize: 40,
                        fontWeight: 'bold',
                        color: interpretation.color,
                        marginBottom: 8
                      }}>
                        {toBengaliNumber(score)}/৩০
                      </Text>

                      <Text style={{
                        fontSize: 20,
                        fontWeight: 'bold',
                        color: interpretation.color,
                        marginBottom: 8
                      }}>
                        {interpretation.title}
                      </Text>

                      {/* Score bar */}
                      <View style={{
                        width: '100%',
                        height: 8,
                        backgroundColor: 'rgba(0,0,0,0.1)',
                        borderRadius: 4,
                        marginTop: 8,
                        overflow: 'hidden'
                      }}>
                        <View style={{
                          height: '100%',
                          width: `${(score / 30) * 100}%`,
                          backgroundColor: interpretation.color,
                          borderRadius: 4
                        }} />
                      </View>

                      <View style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        width: '100%',
                        marginTop: 6
                      }}>
                        <Text style={{ fontSize: 11, color: '#999' }}>স্বাভাবিক (০-৮)</Text>
                        <Text style={{ fontSize: 11, color: '#999' }}>উদ্বেগজনক (৯-১২)</Text>
                        <Text style={{ fontSize: 11, color: '#999' }}>গুরুতর (১৩+)</Text>
                      </View>
                    </View>

                    {/* Hafsa's Response */}
                    <View style={{
                      backgroundColor: COLORS.primaryLight,
                      borderRadius: 16,
                      padding: 20,
                      borderLeftWidth: 5,
                      borderLeftColor: COLORS.primary,
                      marginBottom: 20
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                        <Text style={{ fontSize: 28, marginRight: 10 }}>💚</Text>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.primaryDark }}>
                          হাফসা আপা বলছে
                        </Text>
                      </View>

                      <Text style={{
                        fontSize: 15,
                        color: COLORS.primaryDarker,
                        lineHeight: 25
                      }}>
                        {getHafsaResponse()}
                      </Text>
                    </View>

                    {/* Q10 Emergency Card */}
                    {hasQ10Concern() && (
                      <View style={{
                        backgroundColor: '#FFEBEE',
                        borderRadius: 12,
                        padding: 20,
                        marginBottom: 20,
                        borderLeftWidth: 5,
                        borderLeftColor: '#F44336'
                      }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#C62828', marginBottom: 8 }}>
                          🆘 জরুরি সাহায্য
                        </Text>
                        <Text style={{ fontSize: 15, color: '#B71C1C', lineHeight: 24 }}>
                          কান পেতে রই হেল্পলাইন:{'\n'}
                          📞 ০১৭৭৯-৫৫৪৫৫{'\n\n'}
                          জাতীয় জরুরি সেবা:{'\n'}
                          📞 ৯৯৯
                        </Text>
                      </View>
                    )}

                    {/* Next Assessment Info */}
                    <View style={{
                      backgroundColor: '#F5F5F5',
                      padding: 16,
                      borderRadius: 12,
                      marginBottom: 20
                    }}>
                      <Text style={{ fontSize: 14, color: COLORS.gray, textAlign: 'center', lineHeight: 20 }}>
                        পরবর্তী মূল্যায়ন: ২ সপ্তাহ পর{'\n'}
                        নিয়মিত মূল্যায়ন আপনার অগ্রগতি দেখতে সাহায্য করে
                      </Text>
                    </View>

                    {/* Medical Disclaimer */}
                    <View style={{
                      backgroundColor: '#FFF8E1',
                      padding: 14,
                      borderRadius: 10,
                      marginBottom: 20,
                      borderLeftWidth: 4,
                      borderLeftColor: '#FFC107'
                    }}>
                      <Text style={{ fontSize: 12, color: '#F57F17', lineHeight: 18 }}>
                        ⚠️ এটি একটি স্ক্রিনিং টুল, রোগ নির্ণয় নয়। ফলাফল উদ্বেগজনক হলে অবশ্যই চিকিৎসকের পরামর্শ নিন। EPDS © Cox, Holden & Sagovsky, 1987.
                      </Text>
                    </View>

                    {/* Done Button */}
                    <TouchableOpacity
                      onPress={() => {
                        if (onComplete) onComplete();
                      }}
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
                  </>
                );
              })()}
            </View>
          )}

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================
// HELPER: Check if EPDS is due (every 2 weeks)
// ============================================================

export async function isEPDSDue() {
  try {
    const lastDate = await AsyncStorage.getItem('epds_last_date');
    if (!lastDate) return true; // Never done before

    const daysSince = Math.floor(
      (Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSince >= 14;
  } catch {
    return false;
  }
}

// ============================================================
// HELPER: Get last EPDS score
// ============================================================

export async function getLastEPDSScore() {
  try {
    const saved = await AsyncStorage.getItem('epds_history');
    if (!saved) return null;
    const history = JSON.parse(saved);
    if (history.length === 0) return null;
    return history[0]; // Most recent
  } catch {
    return null;
  }
}