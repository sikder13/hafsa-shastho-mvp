/**
 * Hafsa Sastho (হাফসা স্বাস্থ্য)
 * Bangladesh's First AI Companion for Postpartum and Early Childhood Care
 * Copyright © 2026 Nahl Technologies Inc. All rights reserved.
 *
 * @author Udaay Sikder — Co-Founder & Dev
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BD_EPI_SCHEDULE } from '../data/bdEPISchedule';
import { toBengaliNumber, formatDateBengali } from '../utils/helpers';
import { COLORS, STORAGE_KEYS, TEXT } from '../utils/constants';
import { syncVaccineRecord, trackEvent, trackScreenView } from '../services/supabaseService';
import { supabase } from '../supabaseClient';
import { scheduleVaccineReminder } from '../services/notificationService';
import { useApp } from '../context/AppContext';

export default function VaccineScreen({ baby, onBack }) {
  const { updateVaccineStatus: updateGlobalVaccine } = useApp();
  const [vaccineStatus, setVaccineStatus] = useState({});
  const [userId, setUserId] = useState(null);
  const [showSymptoms, setShowSymptoms] = useState(false);
  const [symptomChecks, setSymptomChecks] = useState({ fever: false, rash: false, cough: false, redEyes: false });
  const [symptomResult, setSymptomResult] = useState(null);

  const openVaccineCenterSearch = () => {
    const query = encodeURIComponent('টিকা কেন্দ্র vaccine center');
    const url = Platform.select({
      ios: `maps:0,0?q=${query}`,
      android: `geo:0,0?q=${query}`,
      default: `https://www.google.com/maps/search/?api=1&query=${query}`,
    });
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
    });
  };

  useEffect(() => {
    loadVaccineStatus();

    // Load userId for event tracking
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) {
        setUserId(session.user.id);
        trackScreenView(session.user.id, 'VaccineScreen').catch(() => {});
      }
    });

    // Track measles alert view (once per day)
    const trackMeaslesView = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const key = 'measles_alert_viewed_' + today;
        const viewed = await AsyncStorage.getItem(key);
        if (!viewed) {
          await AsyncStorage.setItem(key, 'true');
          const babyAgeDays = calculateBabyAgeDays();
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user?.id) {
              trackEvent(session.user.id, 'measles_alert_viewed', { baby_age_days: babyAgeDays }).catch(() => {});
            }
          });
          // Clean up yesterday's key
          const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
          AsyncStorage.removeItem('measles_alert_viewed_' + yesterday).catch(() => {});
        }
      } catch (e) {}
    };
    trackMeaslesView();

    // Track MR urgency and vaccine info view if applicable
    const trackMRUrgency = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEYS.vaccineStatus(baby.id));
        const vs = saved ? JSON.parse(saved) : {};
        const ageDays = calculateBabyAgeDays();
        if (!vs['mr-1']?.completed && ageDays >= 180) {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user?.id) {
              trackEvent(session.user.id, 'measles_mr_urgency_shown', { mr1_status: 'pending' }, ageDays).catch(() => {});
              trackEvent(session.user.id, 'measles_vaccine_info_viewed', {}).catch(() => {});
            }
          });
        }
      } catch (e) {}
    };
    trackMRUrgency();

    // One-time migration
    const migrate = async () => {
      try {
        await AsyncStorage.removeItem('vaccine_status');
      } catch (error) {
        // Ignore
      }
    };
    migrate();
  }, [baby.id]);

  // Schedule vaccine reminders when vaccine data loads
  useEffect(() => {
    try {
      BD_EPI_SCHEDULE.forEach(vaccine => {
        if (vaccineStatus[vaccine.id]?.completed) return;

        const dueDate = new Date(baby.birth_date);
        dueDate.setDate(dueDate.getDate() + vaccine.ageDays);

        scheduleVaccineReminder(vaccine.nameBangla, dueDate)
          .catch(e => console.log('Vaccine reminder:', e.message));
      });
    } catch (e) {
      console.log('Vaccine reminder scheduling error:', e.message);
    }
  }, [vaccineStatus, baby.birth_date]);

  const loadVaccineStatus = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.vaccineStatus(baby.id));
      if (saved) {
        setVaccineStatus(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading vaccine status:', error);
    }
  };

  const saveVaccineStatus = async (newStatus) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.vaccineStatus(baby.id), JSON.stringify(newStatus));
    } catch (error) {
      console.error('Error saving vaccine status:', error);
    }
  };

  const calculateBabyAgeDays = () => {
    const birth = new Date(baby.birth_date);
    const today = new Date();
    const diffTime = Math.abs(today - birth);
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  const getVaccineStatus = (vaccine) => {
    const babyAgeDays = calculateBabyAgeDays();
    
    if (vaccineStatus[vaccine.id]?.completed) {
      return { status: 'completed', color: COLORS.success, icon: '✓' };
    }

    const dueDate = new Date(baby.birth_date);
    dueDate.setDate(dueDate.getDate() + vaccine.ageDays);
    const today = new Date();
    const daysUntilDue = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));

    if (babyAgeDays < vaccine.ageDays - 7) {
      return { status: 'upcoming', color: '#BDBDBD', icon: '○' };
    } else if (daysUntilDue > 7) {
      return { status: 'upcoming', color: '#BDBDBD', icon: '○' };
    } else if (daysUntilDue >= 0 && daysUntilDue <= 7) {
      return { status: 'soon', color: '#FFC107', icon: '!' };
    } else {
      return { status: 'overdue', color: COLORS.danger, icon: '⚠' };
    }
  };

  const handleMarkComplete = (vaccine) => {
    const isCompleted = vaccineStatus[vaccine.id]?.completed;
    
    if (isCompleted) {
      Alert.alert(
        'সম্পন্ন টিকা',
        `${vaccine.nameBangla} টিকা ইতিমধ্যে দেওয়া হয়েছে।\n\nবাতিল করতে চান?`,
        [
          { text: 'না', style: 'cancel' },
          {
            text: 'হ্যাঁ, বাতিল করুন',
            style: 'destructive',
            onPress: () => {
              const newStatus = { ...vaccineStatus };
              delete newStatus[vaccine.id];
              setVaccineStatus(newStatus);
              saveVaccineStatus(newStatus);
              // Sync to AppContext so HomeScreen updates
              updateGlobalVaccine(vaccine.id, false);
              Alert.alert('বাতিল করা হয়েছে', 'টিকা রেকর্ড মুছে ফেলা হয়েছে');
            }
          }
        ]
      );
    } else {
      Alert.alert(
        'নিশ্চিত করুন',
        `আপনি কি ${vaccine.nameBangla} টিকা নিয়েছেন?`,
        [
          { text: 'না', style: 'cancel' },
          {
            text: 'হ্যাঁ, নিয়েছি',
            onPress: () => {
              const vaccineData = {
                completed: true,
                completedDate: new Date().toISOString()
              };
              const newStatus = {
                ...vaccineStatus,
                [vaccine.id]: vaccineData
              };
              setVaccineStatus(newStatus);
              saveVaccineStatus(newStatus);
              // Sync to AppContext so HomeScreen updates
              updateGlobalVaccine(vaccine.id, true, vaccineData.completedDate);
              // Sync to Supabase
              syncVaccineRecord(vaccine.id, vaccineData, baby.id).catch(e => console.log('Vaccine sync:', e.message));
              // Track vaccine completion
              const babyAge = calculateBabyAgeDays();
              const isMR = vaccine.id === 'mr-1' || vaccine.id === 'mr-2';
              if (userId) {
                trackEvent(userId, 'vaccine_completed', { vaccine_name: vaccine.nameBangla, is_mr: isMR }, babyAge).catch(() => {});
                if (isMR) {
                  trackEvent(userId, 'measles_mr_vaccine_completed', { vaccine: vaccine.id === 'mr-1' ? 'MR-1' : 'MR-2' }, babyAge).catch(() => {});
                }
              }
              Alert.alert('সফল!', 'টিকা সংরক্ষিত হয়েছে');
            }
          }
        ]
      );
    }
  };

  const getDaysUntilText = (vaccine) => {
    const dueDate = new Date(baby.birth_date);
    dueDate.setDate(dueDate.getDate() + vaccine.ageDays);
    const today = new Date();
    const daysUntil = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));

    if (vaccineStatus[vaccine.id]?.completed) {
      return 'সম্পন্ন';
    }

    if (daysUntil > 0) {
      return `বাকি ${toBengaliNumber(daysUntil)} দিন`;
    } else if (daysUntil === 0) {
      return 'আজ';
    } else {
      return `${toBengaliNumber(Math.abs(daysUntil))} দিন দেরি`;
    }
  };

  const getUpcomingVaccine = () => {
    const babyAgeDays = calculateBabyAgeDays();
    
    return BD_EPI_SCHEDULE.find(vaccine => {
      if (vaccineStatus[vaccine.id]?.completed) return false;
      
      const daysUntilDue = vaccine.ageDays - babyAgeDays;
      return daysUntilDue >= 0 && daysUntilDue <= 7;
    });
  };

  const getRecentVaccines = () => {
    return BD_EPI_SCHEDULE.filter(vaccine => {
      const status = vaccineStatus[vaccine.id];
      if (!status?.completed) return false;
      
      const completedDate = new Date(status.completedDate);
      const daysAgo = (Date.now() - completedDate.getTime()) / (1000 * 60 * 60 * 24);
      
      return daysAgo <= 3;
    });
  };

  const getCompletionPercentage = () => {
    const babyAgeDays = calculateBabyAgeDays();
    
    const dueVaccines = BD_EPI_SCHEDULE.filter(v => v.ageDays <= babyAgeDays);
    const completedVaccines = dueVaccines.filter(v => vaccineStatus[v.id]?.completed);
    
    if (dueVaccines.length === 0) return 0;
    
    return Math.round((completedVaccines.length / dueVaccines.length) * 100);
  };

  const getFormattedDueDate = (vaccine) => {
    const dueDate = new Date(baby.birth_date);
    dueDate.setDate(dueDate.getDate() + vaccine.ageDays);
    return formatDateBengali(dueDate);
  };

  const getVaccineGroups = () => {
    return [
      {
        title: 'জন্মের সময়',
        vaccines: BD_EPI_SCHEDULE.filter(v => v.ageDays === 0)
      },
      {
        title: '৬-১৪ সপ্তাহ',
        vaccines: BD_EPI_SCHEDULE.filter(v => v.ageDays >= 42 && v.ageDays <= 98)
      },
      {
        title: '৯ মাস',
        vaccines: BD_EPI_SCHEDULE.filter(v => v.ageDays >= 270 && v.ageDays < 365)
      },
      {
        title: '১৮ মাস',
        vaccines: BD_EPI_SCHEDULE.filter(v => v.ageDays >= 540)
      }
    ];
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        minHeight: 60,
        backgroundColor: COLORS.background,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border
      }}>
        <TouchableOpacity
          onPress={onBack}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 8
          }}
        >
          <Text style={{ fontSize: 28, marginRight: 8 }}>←</Text>
          <Text style={{ fontSize: 18, color: COLORS.primary, fontWeight: 'bold' }}>
            {TEXT.messages.goBack}
          </Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20 }}>

        {/* MEASLES EMERGENCY ALERT BANNER */}
        <View style={{
          backgroundColor: '#D32F2F',
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
        }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: 'white', marginBottom: 8 }}>
            {'⚠️ সতর্কতা: হাম (Measles) প্রাদুর্ভাব'}
          </Text>
          <Text style={{ fontSize: 13, color: 'white', lineHeight: 20, marginBottom: 12 }}>
            বাংলাদেশে হামের প্রাদুর্ভাব চলছে। শিশুদের সুরক্ষায় সচেতন থাকুন। ৬ মাস-৫ বছর বয়সী সব শিশুকে এখনই টিকা দিন।
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={() => {
                if (userId) trackEvent(userId, 'measles_helpline_tap', {}).catch(() => {});
                Linking.openURL('tel:16263');
              }}
              style={{
                flex: 1, borderWidth: 1, borderColor: 'white', borderRadius: 8,
                paddingVertical: 10, alignItems: 'center',
              }}
            >
              <Text style={{ color: 'white', fontSize: 13, fontWeight: 'bold' }}>{'📞 হেল্পলাইন ১৬২৬৩'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (userId) trackEvent(userId, 'measles_vaccine_center_tap', {}).catch(() => {});
                openVaccineCenterSearch();
              }}
              style={{
                flex: 1, borderWidth: 1, borderColor: 'white', borderRadius: 8,
                paddingVertical: 10, alignItems: 'center',
              }}
            >
              <Text style={{ color: 'white', fontSize: 13, fontWeight: 'bold' }}>{'📍 টিকা কেন্দ্র'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontStyle: 'italic', textAlign: 'center', marginTop: 8 }}>
            তথ্যসূত্র: স্বাস্থ্য ও পরিবার কল্যাণ মন্ত্রণালয়, WHO, UNICEF (এপ্রিল ২০২৬)। এই অ্যাপ চিকিৎসা পরামর্শের বিকল্প নয়। সর্বদা ডাক্তারের পরামর্শ নিন।
          </Text>
        </View>

        {/* COLLAPSIBLE SYMPTOM INFO */}
        <TouchableOpacity
          onPress={() => {
            if (!showSymptoms && userId) trackEvent(userId, 'measles_symptoms_viewed', {}).catch(() => {});
            setShowSymptoms(!showSymptoms);
          }}
          style={{
            backgroundColor: '#FFEBEE', borderRadius: 12, padding: 14, marginBottom: showSymptoms ? 0 : 16,
            borderWidth: 1, borderColor: '#EF9A9A',
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#C62828' }}>
            {showSymptoms ? '🔍 হামের লক্ষণ চিনুন ▼' : '🔍 হামের লক্ষণ চিনুন ▶'}
          </Text>
        </TouchableOpacity>
        {showSymptoms && (
          <View style={{
            backgroundColor: '#FFEBEE', borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
            padding: 14, paddingTop: 0, marginBottom: 16,
            borderWidth: 1, borderTopWidth: 0, borderColor: '#EF9A9A',
          }}>
            <Text style={{ fontSize: 14, color: '#C62828', lineHeight: 22, marginBottom: 4 }}>
              {'হামের প্রধান লক্ষণ:\n🤒 তীব্র জ্বর (১০৩°F+)\n🔴 সারা গায়ে লাল র‍্যাশ/দানা\n😤 কাশি, সর্দি, নাক দিয়ে পানি পড়া\n👁️ চোখ লাল ও পানি পড়া'}
            </Text>
            <Text style={{ fontSize: 14, color: '#C62828', lineHeight: 22, marginTop: 8 }}>
              {'আপনার শিশুর ২+ লক্ষণ থাকলে:\n১. এখনই হাসপাতালে যান\n২. অন্য শিশুদের থেকে আলাদা রাখুন\n৩. পর্যাপ্ত পানি ও বুকের দুধ দিন'}
            </Text>
            <Text style={{ fontSize: 10, color: '#999', fontStyle: 'italic', marginTop: 8 }}>
              তথ্যসূত্র: WHO Measles Fact Sheet, বাংলাদেশ স্বাস্থ্য মন্ত্রণালয়
            </Text>
          </View>
        )}

        {/* MEASLES SYMPTOM CHECKER */}
        <View style={{
          backgroundColor: '#FFEBEE', borderRadius: 12, padding: 16, marginBottom: 16,
          borderWidth: 1, borderColor: '#EF9A9A',
        }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#C62828', marginBottom: 12 }}>
            {'🩺 হামের লক্ষণ চেক করুন'}
          </Text>
          {[
            { key: 'fever', label: 'জ্বর আছে (১০১°F+)' },
            { key: 'rash', label: 'গায়ে র‍্যাশ/দানা আছে' },
            { key: 'cough', label: 'কাশি বা সর্দি আছে' },
            { key: 'redEyes', label: 'চোখ লাল বা পানি পড়ছে' },
          ].map(item => (
            <TouchableOpacity
              key={item.key}
              onPress={() => setSymptomChecks(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
            >
              <Text style={{ fontSize: 20, marginRight: 10 }}>
                {symptomChecks[item.key] ? '☑' : '☐'}
              </Text>
              <Text style={{ fontSize: 15, color: '#C62828' }}>{item.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() => {
              const checked = Object.values(symptomChecks).filter(Boolean).length;
              setSymptomResult(checked >= 2 ? 'high' : 'low');
              if (userId) {
                trackEvent(userId, 'measles_symptom_check', {
                  symptoms_checked: checked,
                  fever: symptomChecks.fever,
                  rash: symptomChecks.rash,
                  cough: symptomChecks.cough,
                  red_eyes: symptomChecks.redEyes,
                  risk_level: checked >= 2 ? 'high' : 'low',
                }, calculateBabyAgeDays()).catch(() => {});
              }
            }}
            style={{
              backgroundColor: '#C62828', borderRadius: 8, padding: 12,
              alignItems: 'center', marginTop: 8,
            }}
          >
            <Text style={{ color: 'white', fontSize: 15, fontWeight: 'bold' }}>চেক করুন</Text>
          </TouchableOpacity>
          {symptomResult === 'low' && (
            <View style={{ marginTop: 12 }}>
              <Text style={{ fontSize: 14, color: '#2E7D32' }}>
                {'✅ এই মুহূর্তে হামের ঝুঁকি কম। তবে সতর্ক থাকুন এবং টিকা দিয়ে রাখুন।'}
              </Text>
              <Text style={{ fontSize: 10, color: '#999', fontStyle: 'italic', marginTop: 4 }}>
                {'⚕️ এটি একটি স্ক্রিনিং টুল, রোগ নির্ণয় নয়। সন্দেহ হলে অবশ্যই ডাক্তার দেখান।'}
              </Text>
            </View>
          )}
          {symptomResult === 'high' && (
            <View style={{ marginTop: 12 }}>
              <Text style={{ fontSize: 14, color: '#C62828', fontWeight: 'bold' }}>
                {'🚨 এখনই নিকটতম হাসপাতালে যান! শিশুকে অন্যদের থেকে আলাদা রাখুন।'}
              </Text>
              <TouchableOpacity
                onPress={() => Linking.openURL('tel:16263')}
                style={{
                  backgroundColor: '#C62828', borderRadius: 8, padding: 10,
                  alignItems: 'center', marginTop: 8,
                }}
              >
                <Text style={{ color: 'white', fontSize: 14, fontWeight: 'bold' }}>{'📞 হেল্পলাইন ১৬২৬৩ কল করুন'}</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 10, color: '#999', fontStyle: 'italic', marginTop: 4 }}>
                {'⚕️ এটি একটি স্ক্রিনিং টুল, রোগ নির্ণয় নয়। সন্দেহ হলে অবশ্যই ডাক্তার দেখান।'}
              </Text>
            </View>
          )}
        </View>

        {/* MR VACCINE URGENCY CARD */}
        {!vaccineStatus['mr-1']?.completed && calculateBabyAgeDays() >= 180 && (
          <View>
            <View style={{
              backgroundColor: '#FFF3E0', borderRadius: 12, padding: 16, marginBottom: 12,
              borderWidth: 1, borderColor: '#FFB74D',
            }}>
              <Text style={{ fontSize: 14, color: '#E65100', lineHeight: 22 }}>
                {'⚠️ '}{baby.name} এর হাম-রুবেলা টিকা এখনো হয়নি। প্রাদুর্ভাব চলছে — যত দ্রুত সম্ভব টিকা দিন!
              </Text>
            </View>
            {/* VACCINE INFO HELP CARD */}
            <View style={{
              backgroundColor: '#E3F2FD', borderRadius: 12, padding: 16, marginBottom: 16,
            }}>
              <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#1565C0', marginBottom: 8 }}>
                {'💡 আপনার শিশু কি হামের টিকা পেয়েছে?'}
              </Text>
              <Text style={{ fontSize: 13, color: '#1565C0', lineHeight: 21 }}>
                {'বাংলাদেশে হাম-রুবেলা (MR) টিকা দেওয়া হয়:\n\n• MR-১: ৯ মাস বয়সে (প্রথম ডোজ)\n• MR-২: ১৫ মাস বয়সে (দ্বিতীয় ডোজ)\n\n📋 টিকা কার্ড চেক করুন — যদি \'MR\' বা \'হাম\' লেখা থাকে সবুজ চিহ্ন সহ, তাহলে টিকা হয়েছে।\n\n❓ টিকা কার্ড হারিয়ে গেলে বা নিশ্চিত না হলে — নিকটতম EPI কেন্দ্রে গিয়ে জানান। পুনরায় টিকা দিলেও কোনো ক্ষতি নেই।\n\n🚨 প্রাদুর্ভাবর সময়: সরকার ৬ মাস+ শিশুদের জরুরি ভিত্তিতে বিনামূল্যে টিকা দিচ্ছে — কার্ড না থাকলেও দেওয়া হবে।'}
              </Text>
            </View>
          </View>
        )}

        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 8 }}>
            💉 টিকার তালিকা
          </Text>
          <Text style={{ fontSize: 16, color: COLORS.gray }}>
            বাংলাদেশ EPI সূচি অনুযায়ী
          </Text>
        </View>

        {/* PROGRESS INDICATOR */}
        <View style={{
          backgroundColor: COLORS.cardBg,
          padding: 20,
          borderRadius: 12,
          marginBottom: 20
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.dark }}>
              অগ্রগতি
            </Text>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.primary }}>
              {toBengaliNumber(getCompletionPercentage())}%
            </Text>
          </View>
          
          <View style={{
            height: 12,
            backgroundColor: COLORS.border,
            borderRadius: 6,
            overflow: 'hidden'
          }}>
            <View style={{
              height: '100%',
              width: `${getCompletionPercentage()}%`,
              backgroundColor: COLORS.primary,
              borderRadius: 6
            }} />
          </View>
          
          <Text style={{ fontSize: 14, color: COLORS.gray, marginTop: 8 }}>
            {toBengaliNumber(BD_EPI_SCHEDULE.filter(v => vaccineStatus[v.id]?.completed).length)} টি সম্পন্ন, {' '}
            {toBengaliNumber(BD_EPI_SCHEDULE.length - BD_EPI_SCHEDULE.filter(v => vaccineStatus[v.id]?.completed).length)} টি বাকি
          </Text>
        </View>

        {/* PRE-VACCINE PREPARATION CARD */}
        {getUpcomingVaccine() && (
          <View style={{
            backgroundColor: '#FFF3E0',
            padding: 20,
            borderRadius: 12,
            marginBottom: 20,
            borderLeftWidth: 4,
            borderLeftColor: COLORS.warning
          }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 12, color: '#E65100' }}>
              ⏰ আসন্ন টিকা: {getUpcomingVaccine().nameBangla}
            </Text>
            
            <Text style={{ fontSize: 15, color: '#E65100', marginBottom: 16 }}>
              তারিখ: {getFormattedDueDate(getUpcomingVaccine())} ({getDaysUntilText(getUpcomingVaccine())})
            </Text>
            
            <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 12, color: '#E65100' }}>
              প্রস্তুতি:
            </Text>
            
            <View style={{ marginLeft: 8 }}>
              <Text style={{ fontSize: 15, color: '#E65100', marginBottom: 6 }}>
                ✓ শিশুকে স্বাভাবিক খাওয়ান (না খেলে টিকা পিছিয়ে যেতে পারে)
              </Text>
              <Text style={{ fontSize: 15, color: '#E65100', marginBottom: 6 }}>
                ✓ জ্বর কমানোর ওষুধ (প্যারাসিটামল) ঘরে রাখুন
              </Text>
              <Text style={{ fontSize: 15, color: '#E65100', marginBottom: 6 }}>
                ✓ সকালে যাওয়ার চেষ্টা করুন (কম ভিড়)
              </Text>
              <Text style={{ fontSize: 15, color: '#E65100', marginBottom: 6 }}>
                ✓ টিকা কার্ড সাথে নিতে ভুলবেন না
              </Text>
            </View>
          </View>
        )}

        {/* POST-VACCINE SYMPTOM GUIDE */}
        {getRecentVaccines().length > 0 && (
          <View style={{
            backgroundColor: '#E3F2FD',
            padding: 20,
            borderRadius: 12,
            marginBottom: 20,
            borderLeftWidth: 4,
            borderLeftColor: COLORS.info
          }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 12, color: '#1565C0' }}>
              💉 সাম্প্রতিক টিকা
            </Text>
            
            <View style={{ marginBottom: 16 }}>
              {getRecentVaccines().map((vaccine, index) => (
                <Text key={vaccine.id} style={{ fontSize: 16, color: '#1976D2', marginBottom: 4, fontWeight: 'bold' }}>
                  {index + 1}. {vaccine.nameBangla}
                </Text>
              ))}
            </View>
            
            <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: '#1976D2' }}>
              টিকার পর যা স্বাভাবিক:
            </Text>
            
            <View style={{ marginLeft: 8, marginBottom: 16 }}>
              <Text style={{ fontSize: 15, color: '#1976D2', marginBottom: 4 }}>
                • হালকা জ্বর (৯৯-১০১°F, ২-৩ দিন)
              </Text>
              <Text style={{ fontSize: 15, color: '#1976D2', marginBottom: 4 }}>
                • টিকার জায়গা লাল বা ফোলা হওয়া
              </Text>
              <Text style={{ fontSize: 15, color: '#1976D2', marginBottom: 4 }}>
                • একটু বেশি কান্না বা খিটখিটে ভাব
              </Text>
              <Text style={{ fontSize: 15, color: '#1976D2', marginBottom: 4 }}>
                • ঘুম কম হওয়া বা বেশি হওয়া
              </Text>
            </View>
            
            <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: '#1976D2' }}>
              করণীয়:
            </Text>
            
            <View style={{ marginLeft: 8, marginBottom: 16 }}>
              <Text style={{ fontSize: 15, color: '#1976D2', marginBottom: 4 }}>
                • বুকের দুধ বেশি করে খাওয়ান
              </Text>
              <Text style={{ fontSize: 15, color: '#1976D2', marginBottom: 4 }}>
                • জ্বর ১০১° এর বেশি হলে প্যারাসিটামল দিন
              </Text>
              <Text style={{ fontSize: 15, color: '#1976D2', marginBottom: 4 }}>
                • টিকার জায়গা পরিষ্কার ও শুকনো রাখুন
              </Text>
            </View>
            
            <View style={{
              backgroundColor: '#FFEBEE',
              padding: 12,
              borderRadius: 8,
              borderLeftWidth: 3,
              borderLeftColor: COLORS.danger
            }}>
              <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#C62828', marginBottom: 6 }}>
                ⚠️ এগুলো হলে অবশ্যই ডাক্তার দেখান:
              </Text>
              <Text style={{ fontSize: 14, color: '#C62828', marginBottom: 3 }}>
                • জ্বর ১০৩°F বা তার বেশি
              </Text>
              <Text style={{ fontSize: 14, color: '#C62828', marginBottom: 3 }}>
                • জ্বর ৩ দিনের বেশি থাকলে
              </Text>
              <Text style={{ fontSize: 14, color: '#C62828', marginBottom: 3 }}>
                • খাওয়া একদম বন্ধ হয়ে গেলে
              </Text>
              <Text style={{ fontSize: 14, color: '#C62828' }}>
                • খিঁচুনি বা অজ্ঞান হয়ে গেলে
              </Text>
            </View>
          </View>
        )}

        {/* FIND NEAREST VACCINE CENTER */}
        <View style={{
          backgroundColor: '#F1F8E9',
          borderRadius: 12,
          padding: 16,
          marginVertical: 12,
        }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#33691E', marginBottom: 6 }}>
            {'📍 নিকটতম টিকা কেন্দ্র খুঁজুন'}
          </Text>
          <Text style={{ fontSize: 13, color: COLORS.gray, marginBottom: 12 }}>
            Google Maps আপনার অবস্থান অনুযায়ী কাছের সরকারি EPI কেন্দ্র দেখাবে
          </Text>
          <TouchableOpacity
            onPress={() => {
              if (userId) trackEvent(userId, 'vaccine_center_search', {}).catch(() => {});
              openVaccineCenterSearch();
            }}
            style={{
              backgroundColor: COLORS.primary, borderRadius: 8,
              padding: 12, alignItems: 'center',
            }}
          >
            <Text style={{ color: 'white', fontSize: 15, fontWeight: 'bold' }}>{'🗺️ Google Maps এ খুঁজুন'}</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 13, color: COLORS.gray, textAlign: 'center', marginTop: 10 }}>
            অথবা জাতীয় স্বাস্থ্য হেল্পলাইন কল করুন
          </Text>
          <TouchableOpacity
            onPress={() => Linking.openURL('tel:16263')}
            style={{ alignItems: 'center', marginTop: 4 }}
          >
            <Text style={{ fontSize: 14, color: COLORS.primary, fontWeight: 'bold' }}>{'📞 ১৬২৬৩'}</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 10, color: '#999', fontStyle: 'italic', textAlign: 'center', marginTop: 8 }}>
            তথ্যসূত্র: Google Maps। যাওয়ার আগে ফোনে নিশ্চিত করুন।
          </Text>
        </View>

        {/* GROUPED VACCINE LIST */}
        {getVaccineGroups().map((group, groupIndex) => (
          <View key={groupIndex} style={{ marginBottom: 24 }}>
            
            <View style={{
              backgroundColor: '#F5F5F5',
              padding: 12,
              borderRadius: 8,
              marginBottom: 12
            }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#424242' }}>
                {group.title}
              </Text>
            </View>
            
            {group.vaccines.map((vaccine) => {
              const status = getVaccineStatus(vaccine);
              
              return (
                <TouchableOpacity
                  key={vaccine.id}
                  onPress={() => handleMarkComplete(vaccine)}
                  style={{
                    backgroundColor: COLORS.cardBg,
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                    borderLeftWidth: 4,
                    borderLeftColor: status.color
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 24, marginRight: 12 }}>
                      {status.icon}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>
                          {vaccine.nameBangla}
                        </Text>
                        {(vaccine.id === 'mr-1' || vaccine.id === 'mr-2') && (
                          <View style={{
                            backgroundColor: '#F44336', borderRadius: 4,
                            paddingHorizontal: 6, paddingVertical: 2, marginLeft: 8,
                          }}>
                            <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>জরুরি</Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ fontSize: 14, color: COLORS.gray, marginTop: 2 }}>
                        {vaccine.ageDisplay} • {getFormattedDueDate(vaccine)}
                      </Text>
                      <Text style={{ fontSize: 14, color: status.color, marginTop: 2, fontWeight: 'bold' }}>
                        {getDaysUntilText(vaccine)}
                      </Text>
                    </View>
                  </View>

                  <Text style={{ fontSize: 14, color: COLORS.gray, marginTop: 4 }}>
                    {vaccine.description}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        <View style={{
          backgroundColor: '#E3F2FD',
          padding: 16,
          borderRadius: 12,
          marginTop: 16
        }}>
          <Text style={{ fontSize: 14, color: '#1976D2' }}>
            💡 টিপস: টিকা নেওয়ার পর এখানে চাপ দিয়ে সংরক্ষণ করুন।
            এতে আপনি কখনো টিকা মিস করবেন না!
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}