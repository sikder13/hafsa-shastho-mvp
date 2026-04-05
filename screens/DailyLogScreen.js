/**
 * Hafsa Sastho (হাফসা স্বাস্থ্য)
 * Bangladesh's First AI Companion for Postpartum and Early Childhood Care
 * Copyright © 2026 Nahl Technologies Inc. All rights reserved.
 *
 * @author Udaay Sikder — Co-Founder & Dev
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { toBengaliNumber, calculateAgeInMonths, countToday, formatTimeBengali } from '../utils/helpers';
import { COLORS, STORAGE_KEYS, TEXT } from '../utils/constants';
import { useApp } from '../context/AppContext';
import { getLogFeedback } from '../services/intelligenceService';
import { syncDailyLog } from '../services/supabaseService';

export default function DailyLogScreen({ baby, onBack }) {
  const [logs, setLogs] = useState({
    feed: [],
    sleep: [],
    diaper: [],
    food: []
  });

  // Detail panel state
  // Intelligence feedback state
  const [feedbackCard, setFeedbackCard] = useState(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [pendingLogType, setPendingLogType] = useState(null);
  const [pendingLogId, setPendingLogId] = useState(null);
  const detailTimerRef = useRef(null);

  // Toast state
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  // Detail modal state
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailType, setDetailType] = useState(null);

  useEffect(() => {
    loadLogs();
  }, [baby.id]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (detailTimerRef.current) {
        clearTimeout(detailTimerRef.current);
      }
    };
  }, []);

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

  const { setLogs: setGlobalLogs, baby: globalBaby } = useApp();

  const saveLogs = async (newLogs) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.dailyLogs(baby.id), JSON.stringify(newLogs));
      setGlobalLogs(newLogs); // Sync to AppContext so HomeScreen and Hafsa see it
    } catch (error) {
      console.error('Error saving logs:', error);
    }
  };

  // ============================================================
  // ONE-TAP LOG — The primary action
  // ============================================================

  const handleQuickLog = async (type) => {
    const newLog = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      type: type,
      source: 'manual',      // 'manual' | 'auto_chat' | 'auto_voice'
      autoLogged: false,
      details: null           // Will be filled if user adds details
    };

    const updatedLogs = {
      ...logs,
      [type]: [newLog, ...(logs[type] || [])]
    };

    setLogs(updatedLogs);
    await saveLogs(updatedLogs);

    // Background sync to Supabase
    syncDailyLog(newLog, globalBaby?.id, globalBaby?.birth_date).catch(e => console.log('Log sync:', e.message));

    // Show toast
    const typeName = TEXT.logTypes[type] || type;
    showToastMessage(`✓ ${typeName} লগ হয়েছে`);

    // Get intelligent feedback from rules engine
    const feedback = getLogFeedback(type, updatedLogs, babyAgeMonths);
    setFeedbackCard(feedback);
    // Auto-dismiss feedback after 6 seconds
    setTimeout(() => setFeedbackCard(null), 6000);

    // Show detail prompt (auto-dismisses in 4 seconds)
    setPendingLogType(type);
    setPendingLogId(newLog.id);
    setShowDetailPanel(true);

    // Auto-dismiss detail panel after 4 seconds
    if (detailTimerRef.current) {
      clearTimeout(detailTimerRef.current);
    }
    detailTimerRef.current = setTimeout(() => {
      setShowDetailPanel(false);
      setPendingLogType(null);
      setPendingLogId(null);
    }, 4000);
  };

  // ============================================================
  // TOAST MESSAGE
  // ============================================================

  const showToastMessage = (message) => {
    setToastMessage(message);
    setShowToast(true);
    toastOpacity.setValue(0);

    Animated.sequence([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(1500),
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowToast(false);
    });
  };

  // ============================================================
  // DETAIL PANEL — User taps to add optional details
  // ============================================================

  const handleOpenDetails = () => {
    // Stop auto-dismiss timer
    if (detailTimerRef.current) {
      clearTimeout(detailTimerRef.current);
    }
    setShowDetailPanel(false);
    setDetailType(pendingLogType);
    setShowDetailModal(true);
  };

  const handleSaveDetails = async (details) => {
    if (!pendingLogId) return;

    // Find and update the log with details
    const type = detailType || pendingLogType;
    const updatedTypeArray = (logs[type] || []).map(log => {
      if (log.id === pendingLogId) {
        return { ...log, details: details };
      }
      return log;
    });

    const updatedLogs = {
      ...logs,
      [type]: updatedTypeArray
    };

    setLogs(updatedLogs);
    await saveLogs(updatedLogs);

    setShowDetailModal(false);
    setDetailType(null);
    setPendingLogId(null);
    setPendingLogType(null);

    showToastMessage('✓ বিস্তারিত সংরক্ষিত');
  };

  // ============================================================
  // SMART FEEDBACK — Pattern detection (kept from original)
  // ============================================================

  const getAverageLast7Days = (type) => {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const last7DaysLogs = (logs[type] || []).filter(log => {
      return new Date(log.timestamp).getTime() > sevenDaysAgo;
    });
    if (last7DaysLogs.length < 14) return null;
    return last7DaysLogs.length / 7;
  };

  // ============================================================
  // TODAY'S TIMELINE
  // ============================================================

  const getTodayTimeline = () => {
    const today = new Date().toDateString();
    const allLogs = [];

    ['feed', 'sleep', 'diaper', 'food'].forEach(type => {
      (logs[type] || []).forEach(log => {
        if (new Date(log.timestamp).toDateString() === today) {
          allLogs.push({ ...log, type });
        }
      });
    });

    // Sort by timestamp, newest first
    return allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  };

  const getLogIcon = (type) => {
    const icons = { feed: '🍼', sleep: '😴', diaper: '💩', food: '🍚' };
    return icons[type] || '📝';
  };

  const getLogColor = (type) => {
    return COLORS[type] || COLORS.primary;
  };

  const getDetailSummary = (log) => {
    if (!log.details) return null;

    const parts = [];
    if (log.details.side) {
      parts.push(log.details.side === 'left' ? 'বাম' : log.details.side === 'right' ? 'ডান' : 'দুইদিক');
    }
    if (log.details.feedType) {
      const feedTypes = { breast: 'বুকের দুধ', bottle: 'বোতল', formula: 'ফর্মুলা' };
      parts.push(feedTypes[log.details.feedType] || log.details.feedType);
    }
    if (log.details.duration) {
      parts.push(`${toBengaliNumber(log.details.duration)} মিনিট`);
    }
    if (log.details.diaperType) {
      const diaperTypes = { wet: 'ভেজা', dirty: 'নোংরা', both: 'দুটোই' };
      parts.push(diaperTypes[log.details.diaperType] || log.details.diaperType);
    }
    if (log.details.foodName) {
      parts.push(log.details.foodName);
    }
    if (log.autoLogged) {
      parts.push('চ্যাট থেকে');
    }

    return parts.length > 0 ? parts.join(' • ') : null;
  };

  const babyAgeMonths = calculateAgeInMonths(baby.birth_date);
  const showFoodButton = babyAgeMonths >= 6;
  const timeline = getTodayTimeline();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>

      {/* HEADER */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: COLORS.background,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border
      }}>
        <TouchableOpacity
          onPress={onBack}
          style={{ flexDirection: 'row', alignItems: 'center', padding: 8 }}
        >
          <Text style={{ fontSize: 28, marginRight: 8 }}>←</Text>
          <Text style={{ fontSize: 18, color: COLORS.primary, fontWeight: 'bold' }}>
            {TEXT.messages.goBack}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>

        {/* HEADER */}
        <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 8 }}>
          📊 দৈনিক লগ
        </Text>
        <Text style={{ fontSize: 16, color: COLORS.gray, marginBottom: 24 }}>
          {baby.name} এর আজকের কার্যকলাপ
        </Text>

        {/* TODAY'S SUMMARY BAR */}
        <View style={{
          flexDirection: 'row',
          backgroundColor: COLORS.primaryLight,
          padding: 16,
          borderRadius: 12,
          marginBottom: 24,
          justifyContent: 'space-around'
        }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 24 }}>🍼</Text>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: COLORS.feed, marginTop: 4 }}>
              {toBengaliNumber(countToday(logs.feed))}
            </Text>
            <Text style={{ fontSize: 11, color: COLORS.gray }}>দুধ</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 24 }}>😴</Text>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: COLORS.sleep, marginTop: 4 }}>
              {toBengaliNumber(countToday(logs.sleep))}
            </Text>
            <Text style={{ fontSize: 11, color: COLORS.gray }}>ঘুম</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 24 }}>💩</Text>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: COLORS.diaper, marginTop: 4 }}>
              {toBengaliNumber(countToday(logs.diaper))}
            </Text>
            <Text style={{ fontSize: 11, color: COLORS.gray }}>ডায়াপার</Text>
          </View>
          {showFoodButton && (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 24 }}>🍚</Text>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: COLORS.food, marginTop: 4 }}>
                {toBengaliNumber(countToday(logs.food))}
              </Text>
              <Text style={{ fontSize: 11, color: COLORS.gray }}>খাবার</Text>
            </View>
          )}
        </View>
{/* INTELLIGENT FEEDBACK — from rules engine */}
{feedbackCard && feedbackCard.type === 'feed' && (
          <View style={{
            backgroundColor: feedbackCard.feedbackType === 'on_target' ? '#E8F5E9'
              : feedbackCard.feedbackType === 'keep_going' ? '#FFF3E0' : '#F1F8E9',
            borderRadius: 12, padding: 14, marginBottom: 16,
            borderLeftWidth: 4,
            borderLeftColor: feedbackCard.feedbackType === 'on_target' ? COLORS.success
              : feedbackCard.feedbackType === 'keep_going' ? COLORS.warning : COLORS.primary,
            flexDirection: 'row', alignItems: 'center',
          }}>
            <Text style={{ fontSize: 24, marginRight: 12 }}>
              {feedbackCard.feedbackType === 'on_target' ? '✅' : feedbackCard.feedbackType === 'above_target' ? '👏' : '💪'}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, color: COLORS.dark, fontWeight: '600' }}>
                {feedbackCard.feedbackType === 'on_target'
                  ? `আজকের টার্গেটে পৌঁছেছে! (${toBengaliNumber(feedbackCard.todayCount)}/${toBengaliNumber(feedbackCard.expectedMin)}-${toBengaliNumber(feedbackCard.expectedMax)})`
                  : feedbackCard.feedbackType === 'above_target'
                  ? `দারুণ! আজ ${toBengaliNumber(feedbackCard.todayCount)} বার খাইয়েছেন`
                  : feedbackCard.feedbackType === 'almost_there'
                  ? `প্রায় হয়ে গেছে! আরো ${toBengaliNumber(feedbackCard.remaining)} বার দরকার`
                  : `আজ ${toBengaliNumber(feedbackCard.todayCount)} বার — আরো ${toBengaliNumber(feedbackCard.remaining)} বার দরকার`}
              </Text>
              {feedbackCard.yesterdayCount > 0 && (
                <Text style={{ fontSize: 12, color: COLORS.gray, marginTop: 2 }}>
                  গতকাল {toBengaliNumber(feedbackCard.yesterdayCount)} বার খেয়েছিল
                </Text>
              )}
            </View>
          </View>
        )}

        {feedbackCard && feedbackCard.type !== 'feed' && (
          <View style={{
            backgroundColor: '#F1F8E9', borderRadius: 12, padding: 14, marginBottom: 16,
            borderLeftWidth: 4, borderLeftColor: COLORS.primary,
            flexDirection: 'row', alignItems: 'center',
          }}>
            <Text style={{ fontSize: 24, marginRight: 12 }}>✅</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, color: COLORS.dark, fontWeight: '600' }}>
                আজ {toBengaliNumber(feedbackCard.todayCount)} বার
              </Text>
              {feedbackCard.yesterdayCount > 0 && (
                <Text style={{ fontSize: 12, color: COLORS.gray, marginTop: 2 }}>
                  গতকাল {toBengaliNumber(feedbackCard.yesterdayCount)} বার ছিল
                </Text>
              )}
            </View>
          </View>
        )}

        {/* QUICK LOG BUTTONS */}
        <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 16 }}>
          ⚡ এক ট্যাপে লগ করুন
        </Text>

        {/* FEED */}
        <TouchableOpacity
          onPress={() => handleQuickLog('feed')}
          activeOpacity={0.7}
          style={{
            backgroundColor: COLORS.feed,
            height: 72,
            borderRadius: 12,
            marginBottom: 12,
            justifyContent: 'center',
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20
          }}
        >
          <Text style={{ fontSize: 36, marginRight: 12 }}>🍼</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>
              দুধ খাওয়ালাম
            </Text>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
            আজ {toBengaliNumber(countToday(logs.feed))}
          </Text>
        </TouchableOpacity>

        {/* FOOD (6+ months) */}
        {showFoodButton && (
          <TouchableOpacity
            onPress={() => handleQuickLog('food')}
            activeOpacity={0.7}
            style={{
              backgroundColor: COLORS.food,
              height: 72,
              borderRadius: 12,
              marginBottom: 12,
              justifyContent: 'center',
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 20
            }}
          >
            <Text style={{ fontSize: 36, marginRight: 12 }}>🍚</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>
                খাবার খাওয়ালাম
              </Text>
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
              আজ {toBengaliNumber(countToday(logs.food))}
            </Text>
          </TouchableOpacity>
        )}

        {/* SLEEP */}
        <TouchableOpacity
          onPress={() => handleQuickLog('sleep')}
          activeOpacity={0.7}
          style={{
            backgroundColor: COLORS.sleep,
            height: 72,
            borderRadius: 12,
            marginBottom: 12,
            justifyContent: 'center',
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20
          }}
        >
          <Text style={{ fontSize: 36, marginRight: 12 }}>😴</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>
              ঘুমাচ্ছে
            </Text>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
            আজ {toBengaliNumber(countToday(logs.sleep))}
          </Text>
        </TouchableOpacity>

        {/* DIAPER */}
        <TouchableOpacity
          onPress={() => handleQuickLog('diaper')}
          activeOpacity={0.7}
          style={{
            backgroundColor: COLORS.diaper,
            height: 72,
            borderRadius: 12,
            marginBottom: 12,
            justifyContent: 'center',
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20
          }}
        >
          <Text style={{ fontSize: 36, marginRight: 12 }}>💩</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>
              ডায়াপার বদলালাম
            </Text>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
            আজ {toBengaliNumber(countToday(logs.diaper))}
          </Text>
        </TouchableOpacity>

        {/* TODAY'S TIMELINE */}
        {timeline.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 16 }}>
              📋 আজকের টাইমলাইন
            </Text>

            {timeline.map((log, index) => (
              <View
                key={log.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  marginBottom: 2,
                }}
              >
                {/* TIME COLUMN */}
                <View style={{ width: 55, alignItems: 'flex-end', marginRight: 12, paddingTop: 12 }}>
                  <Text style={{ fontSize: 13, color: COLORS.gray, fontWeight: '600' }}>
                    {formatTimeBengali(log.timestamp)}
                  </Text>
                </View>

                {/* DOT AND LINE */}
                <View style={{ alignItems: 'center', width: 20 }}>
                  <View style={{
                    width: index === 0 ? 14 : 10,
                    height: index === 0 ? 14 : 10,
                    borderRadius: 7,
                    backgroundColor: getLogColor(log.type),
                    marginTop: 14
                  }} />
                  {index < timeline.length - 1 && (
                    <View style={{
                      width: 2,
                      flex: 1,
                      backgroundColor: COLORS.border,
                      minHeight: 30
                    }} />
                  )}
                </View>

                {/* CONTENT */}
                <View style={{
                  flex: 1,
                  backgroundColor: COLORS.cardBg,
                  borderRadius: 10,
                  padding: 12,
                  marginLeft: 8,
                  marginBottom: 8,
                  borderLeftWidth: 3,
                  borderLeftColor: getLogColor(log.type),
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 18, marginRight: 8 }}>{getLogIcon(log.type)}</Text>
                    <Text style={{ fontSize: 15, fontWeight: 'bold', color: COLORS.dark }}>
                      {TEXT.logTypes[log.type] || log.type}
                    </Text>
                    {log.autoLogged && (
                      <Text style={{ fontSize: 11, color: COLORS.primary, marginLeft: 8 }}>
                        (চ্যাট)
                      </Text>
                    )}
                  </View>

                  {getDetailSummary(log) && (
                    <Text style={{ fontSize: 13, color: COLORS.gray, marginTop: 4 }}>
                      {getDetailSummary(log)}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* EMPTY STATE */}
        {timeline.length === 0 && (
          <View style={{
            marginTop: 24,
            backgroundColor: COLORS.cardBg,
            padding: 24,
            borderRadius: 12,
            alignItems: 'center'
          }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>📝</Text>
            <Text style={{ fontSize: 16, color: COLORS.gray, textAlign: 'center' }}>
              আজ এখনো কিছু লগ করা হয়নি।
            </Text>
            <Text style={{ fontSize: 14, color: COLORS.lightGray, marginTop: 8, textAlign: 'center' }}>
              উপরের বাটনে ট্যাপ করে শুরু করুন!
            </Text>
          </View>
        )}

        {/* WEEKLY INSIGHT (if enough data) */}
        {((logs.feed || []).length >= 21 || (logs.sleep || []).length >= 21) && (
          <View style={{
            backgroundColor: '#E3F2FD',
            padding: 20,
            borderRadius: 16,
            marginTop: 24,
            borderLeftWidth: 6,
            borderLeftColor: COLORS.sleep
          }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 16, color: '#1565C0' }}>
              📊 গত ৭ দিনের প্যাটার্ন
            </Text>

            {getAverageLast7Days('feed') !== null && (
              <Text style={{ fontSize: 16, color: '#1976D2', marginBottom: 8 }}>
                🍼 দুধ: দিনে গড়ে {toBengaliNumber(Math.round(getAverageLast7Days('feed')))} বার
              </Text>
            )}

            {getAverageLast7Days('sleep') !== null && (
              <Text style={{ fontSize: 16, color: '#1976D2', marginBottom: 8 }}>
                😴 ঘুম: দিনে গড়ে {toBengaliNumber(Math.round(getAverageLast7Days('sleep')))} বার
              </Text>
            )}

            {getAverageLast7Days('diaper') !== null && (
              <Text style={{ fontSize: 16, color: '#1976D2', marginBottom: 8 }}>
                💩 ডায়াপার: দিনে গড়ে {toBengaliNumber(Math.round(getAverageLast7Days('diaper')))} বার
              </Text>
            )}

            <View style={{
              marginTop: 12,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: '#BBDEFB'
            }}>
              <Text style={{ fontSize: 14, color: '#1976D2' }}>
                ✅ চমৎকার যত্ন নিচ্ছেন! চালিয়ে যান! 💚
              </Text>
            </View>
          </View>
        )}

      </ScrollView>

      {/* TOAST */}
      {showToast && (
        <Animated.View
          style={{
            position: 'absolute',
            top: 100,
            left: 40,
            right: 40,
            backgroundColor: COLORS.primaryDark,
            borderRadius: 25,
            paddingVertical: 12,
            paddingHorizontal: 20,
            alignItems: 'center',
            opacity: toastOpacity,
            zIndex: 1000,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 5
          }}
        >
          <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
            {toastMessage}
          </Text>
        </Animated.View>
      )}

      {/* DETAIL PROMPT PANEL — slides up, auto-dismisses */}
      {showDetailPanel && (
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: COLORS.cardBg,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 5
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, color: COLORS.dark, fontWeight: '600' }}>
              বিস্তারিত যোগ করবেন?
            </Text>
            <Text style={{ fontSize: 13, color: COLORS.lightGray, marginTop: 2 }}>
              ৪ সেকেন্ডে বন্ধ হবে
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleOpenDetails}
            style={{
              backgroundColor: COLORS.primary,
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 20
            }}
          >
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>
              হ্যাঁ →
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (detailTimerRef.current) clearTimeout(detailTimerRef.current);
              setShowDetailPanel(false);
            }}
            style={{ marginLeft: 12, padding: 8 }}
          >
            <Text style={{ fontSize: 18, color: COLORS.lightGray }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* DETAIL MODAL */}
      <Modal
        visible={showDetailModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end'
        }}>
          <View style={{
            backgroundColor: COLORS.cardBg,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 24,
            paddingBottom: 40
          }}>
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: COLORS.dark }}>
                {getLogIcon(detailType)} বিস্তারিত
              </Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <Text style={{ fontSize: 24, color: COLORS.lightGray }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* FEED DETAILS */}
            {detailType === 'feed' && (
              <FeedDetailPanel onSave={handleSaveDetails} onCancel={() => setShowDetailModal(false)} />
            )}

            {/* DIAPER DETAILS */}
            {detailType === 'diaper' && (
              <DiaperDetailPanel onSave={handleSaveDetails} onCancel={() => setShowDetailModal(false)} />
            )}

            {/* SLEEP DETAILS */}
            {detailType === 'sleep' && (
              <SleepDetailPanel onSave={handleSaveDetails} onCancel={() => setShowDetailModal(false)} />
            )}

            {/* FOOD DETAILS */}
            {detailType === 'food' && (
              <FoodDetailPanel onSave={handleSaveDetails} onCancel={() => setShowDetailModal(false)} />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ============================================================
// DETAIL PANELS — Optional detail entry for each log type
// ============================================================

function FeedDetailPanel({ onSave, onCancel }) {
  const [feedType, setFeedType] = useState(null);
  const [side, setSide] = useState(null);
  const [duration, setDuration] = useState(null);

  const durations = [5, 10, 15, 20, 30];

  return (
    <View>
      {/* Feed Type */}
      <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 10, color: COLORS.dark }}>
        ধরন
      </Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        {[
          { id: 'breast', label: 'বুকের দুধ' },
          { id: 'bottle', label: 'বোতল' },
          { id: 'formula', label: 'ফর্মুলা' }
        ].map(item => (
          <TouchableOpacity
            key={item.id}
            onPress={() => setFeedType(item.id)}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 8,
              borderWidth: 2,
              borderColor: feedType === item.id ? COLORS.feed : COLORS.border,
              backgroundColor: feedType === item.id ? '#E8F5E9' : COLORS.cardBg,
              alignItems: 'center'
            }}
          >
            <Text style={{
              fontSize: 14,
              color: feedType === item.id ? COLORS.feed : COLORS.gray,
              fontWeight: feedType === item.id ? 'bold' : 'normal'
            }}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Side (only for breast) */}
      {feedType === 'breast' && (
        <>
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 10, color: COLORS.dark }}>
            কোন দিকে
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
            {[
              { id: 'left', label: 'বাম' },
              { id: 'right', label: 'ডান' },
              { id: 'both', label: 'দুইদিক' }
            ].map(item => (
              <TouchableOpacity
                key={item.id}
                onPress={() => setSide(item.id)}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderColor: side === item.id ? COLORS.feed : COLORS.border,
                  backgroundColor: side === item.id ? '#E8F5E9' : COLORS.cardBg,
                  alignItems: 'center'
                }}
              >
                <Text style={{
                  fontSize: 14,
                  color: side === item.id ? COLORS.feed : COLORS.gray,
                  fontWeight: side === item.id ? 'bold' : 'normal'
                }}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Duration */}
      <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 10, color: COLORS.dark }}>
        কতক্ষণ (মিনিট)
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
        {durations.map(d => (
          <TouchableOpacity
            key={d}
            onPress={() => setDuration(d)}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 8,
              borderWidth: 2,
              borderColor: duration === d ? COLORS.feed : COLORS.border,
              backgroundColor: duration === d ? '#E8F5E9' : COLORS.cardBg,
              alignItems: 'center'
            }}
          >
            <Text style={{
              fontSize: 14,
              color: duration === d ? COLORS.feed : COLORS.gray,
              fontWeight: duration === d ? 'bold' : 'normal'
            }}>
              {toBengaliNumber(d)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Save */}
      <TouchableOpacity
        onPress={() => onSave({ feedType, side, duration })}
        style={{
          backgroundColor: COLORS.feed,
          padding: 16,
          borderRadius: 12,
          alignItems: 'center'
        }}
      >
        <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
          সংরক্ষণ করুন
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function DiaperDetailPanel({ onSave, onCancel }) {
  const [diaperType, setDiaperType] = useState(null);

  return (
    <View>
      <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 10, color: COLORS.dark }}>
        ধরন
      </Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
        {[
          { id: 'wet', label: 'ভেজা', emoji: '💧' },
          { id: 'dirty', label: 'নোংরা', emoji: '💩' },
          { id: 'both', label: 'দুটোই', emoji: '💧💩' }
        ].map(item => (
          <TouchableOpacity
            key={item.id}
            onPress={() => setDiaperType(item.id)}
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 8,
              borderWidth: 2,
              borderColor: diaperType === item.id ? COLORS.diaper : COLORS.border,
              backgroundColor: diaperType === item.id ? '#F3E5F5' : COLORS.cardBg,
              alignItems: 'center'
            }}
          >
            <Text style={{ fontSize: 20, marginBottom: 4 }}>{item.emoji}</Text>
            <Text style={{
              fontSize: 14,
              color: diaperType === item.id ? COLORS.diaper : COLORS.gray,
              fontWeight: diaperType === item.id ? 'bold' : 'normal'
            }}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        onPress={() => onSave({ diaperType })}
        style={{
          backgroundColor: COLORS.diaper,
          padding: 16,
          borderRadius: 12,
          alignItems: 'center'
        }}
      >
        <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
          সংরক্ষণ করুন
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function SleepDetailPanel({ onSave, onCancel }) {
  const [notes, setNotes] = useState(null);

  return (
    <View>
      <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 10, color: COLORS.dark }}>
        ঘুমের মান
      </Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
        {[
          { id: 'good', label: 'ভালো ঘুম', emoji: '😴' },
          { id: 'restless', label: 'অস্থির ঘুম', emoji: '😣' },
          { id: 'woke_up', label: 'বার বার জাগে', emoji: '😫' }
        ].map(item => (
          <TouchableOpacity
            key={item.id}
            onPress={() => setNotes(item.id)}
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 8,
              borderWidth: 2,
              borderColor: notes === item.id ? COLORS.sleep : COLORS.border,
              backgroundColor: notes === item.id ? '#E3F2FD' : COLORS.cardBg,
              alignItems: 'center'
            }}
          >
            <Text style={{ fontSize: 20, marginBottom: 4 }}>{item.emoji}</Text>
            <Text style={{
              fontSize: 13,
              color: notes === item.id ? COLORS.sleep : COLORS.gray,
              fontWeight: notes === item.id ? 'bold' : 'normal',
              textAlign: 'center'
            }}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        onPress={() => onSave({ sleepQuality: notes })}
        style={{
          backgroundColor: COLORS.sleep,
          padding: 16,
          borderRadius: 12,
          alignItems: 'center'
        }}
      >
        <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
          সংরক্ষণ করুন
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function FoodDetailPanel({ onSave, onCancel }) {
  const [foodName, setFoodName] = useState(null);

  const commonFoods = [
    'ভাত', 'দাল', 'খিচুড়ি', 'ডিম',
    'কলা', 'আপেল', 'সবজি', 'মাছ'
  ];

  return (
    <View>
      <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 10, color: COLORS.dark }}>
        কি খাওয়ালেন?
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
        {commonFoods.map(food => (
          <TouchableOpacity
            key={food}
            onPress={() => setFoodName(food)}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 20,
              borderWidth: 2,
              borderColor: foodName === food ? COLORS.food : COLORS.border,
              backgroundColor: foodName === food ? '#FFF3E0' : COLORS.cardBg,
            }}
          >
            <Text style={{
              fontSize: 14,
              color: foodName === food ? COLORS.food : COLORS.gray,
              fontWeight: foodName === food ? 'bold' : 'normal'
            }}>
              {food}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        onPress={() => onSave({ foodName })}
        style={{
          backgroundColor: COLORS.food,
          padding: 16,
          borderRadius: 12,
          alignItems: 'center'
        }}
      >
        <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
          সংরক্ষণ করুন
        </Text>
      </TouchableOpacity>
    </View>
  );
}