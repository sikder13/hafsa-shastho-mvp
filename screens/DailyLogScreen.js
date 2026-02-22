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

export default function DailyLogScreen({ baby, onBack }) {
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

  const saveLogs = async (newLogs) => {
    try {
      await AsyncStorage.setItem(`daily_logs_${baby.id}`, JSON.stringify(newLogs));
    } catch (error) {
      console.error('Error saving logs:', error);
    }
  };

  const handleLog = async (type) => {
    const newLog = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      type: type
    };

    const updatedLogs = {
      ...logs,
      [type]: [newLog, ...(logs[type] || [])]
    };

    setLogs(updatedLogs);
    await saveLogs(updatedLogs);

    const feedback = getSmartFeedback(type, updatedLogs);
    
    Alert.alert(
      feedback.title,
      feedback.message,
      [{ text: feedback.buttonText || 'ঠিক আছে' }]
    );
  };

  const getSmartFeedback = (type, logs) => {
    const todayCount = getTodayCount(type, logs);
    const avgLast7Days = getAverageLast7Days(type, logs);
    const totalLogs = (logs[type] || []).length;
    
    const typeName = {
      feed: 'দুধ খাওয়ানো',
      sleep: 'ঘুম',
      diaper: 'ডায়াপার বদলানো',
      food: 'খাবার খাওয়ানো'
    }[type];

    if (totalLogs === 1) {
      return {
        title: '🎉 প্রথম লগ!',
        message: `চমৎকার! ${typeName} লগ শুরু করেছেন।\n\nআরও ৬ দিন লগ করলে আমি প্যাটার্ন শিখতে পারব এবং আপনাকে সাহায্য করতে পারব। 💚`
      };
    }

    if (totalLogs === 21 && avgLast7Days !== null) {
      return {
        title: '📊 ৭ দিন সম্পূর্ণ!',
        message: `অসাধারণ! এক সপ্তাহ নিয়মিত লগ করেছেন! 🎉\n\n${baby.name} ${typeName} দিনে গড়ে ${toBengaliNumber(Math.round(avgLast7Days))} বার।\n\nএটি এই বয়সের জন্য স্বাভাবিক। ✅`
      };
    }

    if (avgLast7Days !== null && totalLogs >= 21) {
      const difference = todayCount - avgLast7Days;
      
      if (difference >= 3) {
        return {
          title: '💡 লক্ষ্য করেছি',
          message: `আজ ${typeName} স্বাভাবিকের চেয়ে ${toBengaliNumber(Math.abs(Math.round(difference)))} বার বেশি।\n\n${type === 'feed' ? 'বৃদ্ধির সময় বা গরম আবহাওয়ায় বেশি খেতে পারে।' : 'এটি স্বাভাবিক হতে পারে।'}\n\nচিন্তা নেই! ✅`
        };
      }
      
      if (difference <= -3) {
        return {
          title: '💡 লক্ষ্য করেছি',
          message: `আজ ${typeName} স্বাভাবিকের চেয়ে কম।\n\nযদি শিশু সুস্থ এবং খুশি থাকে, তাহলে চিন্তা নেই। কখনো কখনো কম হতে পারে।`
        };
      }
      
      return {
        title: '✅ সংরক্ষিত!',
        message: `চমৎকার! আজ ${toBengaliNumber(todayCount)} বার ${typeName}।\n\nএটি একদম স্বাভাবিক! দারুণ যত্ন নিচ্ছেন মা! 💚`
      };
    }

    return {
      title: '✅ সংরক্ষিত!',
      message: `${typeName} লগ সংরক্ষিত হয়েছে। আজ ${toBengaliNumber(todayCount)} বার।\n\nভালো যাচ্ছে! চালিয়ে যান! 💪`
    };
  };

  const getTodayCount = (type, logs) => {
    const today = new Date().toDateString();
    return (logs[type] || []).filter(log => {
      return new Date(log.timestamp).toDateString() === today;
    }).length;
  };

  const getAverageLast7Days = (type, logs) => {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const last7DaysLogs = (logs[type] || []).filter(log => {
      return new Date(log.timestamp).getTime() > sevenDaysAgo;
    });

    if (last7DaysLogs.length < 21) return null;
    
    return last7DaysLogs.length / 7;
  };

  const toBengaliNumber = (num) => {
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(num).split('').map(d => bengaliDigits[parseInt(d)] || d).join('');
  };

  const calculateAgeInMonths = (birthDate) => {
    const birth = new Date(birthDate);
    const today = new Date();
    
    let months = (today.getFullYear() - birth.getFullYear()) * 12;
    months += today.getMonth() - birth.getMonth();
    
    if (today.getDate() < birth.getDate()) {
      months--;
    }
    
    return Math.max(0, months);
  };

  const babyAgeMonths = calculateAgeInMonths(baby.birth_date);
  const showFoodButton = babyAgeMonths >= 6;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9F9F9' }}>
      
      {/* BACK BUTTON */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#F9F9F9',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0'
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
          <Text style={{ fontSize: 18, color: '#4CAF50', fontWeight: 'bold' }}>
            ফিরে যান
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        
        {/* HEADER */}
        <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 8 }}>
          📊 দৈনিক লগ
        </Text>
        <Text style={{ fontSize: 16, color: '#666', marginBottom: 24 }}>
          {baby.name} এর আজকের কার্যকলাপ
        </Text>

        {/* TODAY'S SUMMARY */}
        <View style={{
          backgroundColor: '#E8F5E9',
          padding: 16,
          borderRadius: 12,
          marginBottom: 24
        }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: '#2E7D32' }}>
            আজকের সারসংক্ষেপ
          </Text>
          <Text style={{ fontSize: 16, color: '#1B5E20', marginBottom: 4 }}>
            🍼 দুধ: {toBengaliNumber(getTodayCount('feed', logs))} বার
          </Text>
          <Text style={{ fontSize: 16, color: '#1B5E20', marginBottom: 4 }}>
            😴 ঘুম: {toBengaliNumber(getTodayCount('sleep', logs))} বার
          </Text>
          <Text style={{ fontSize: 16, color: '#1B5E20', marginBottom: 4 }}>
            💩 ডায়াপার: {toBengaliNumber(getTodayCount('diaper', logs))} বার
          </Text>
          {showFoodButton && (
            <Text style={{ fontSize: 16, color: '#1B5E20' }}>
              🍚 খাবার: {toBengaliNumber(getTodayCount('food', logs))} বার
            </Text>
          )}
        </View>

        {/* QUICK LOG SECTION */}
        <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 16 }}>
          ⚡ দ্রুত লগ
        </Text>

        {/* FEED BUTTON */}
        <TouchableOpacity 
          onPress={() => handleLog('feed')}
          style={{
            backgroundColor: '#4CAF50',
            height: 80,
            borderRadius: 12,
            marginBottom: 16,
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'row',
            paddingHorizontal: 20
          }}
        >
          <Text style={{ fontSize: 40, marginRight: 12 }}>🍼</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>
              দুধ খাওয়ালাম
            </Text>
          </View>
        </TouchableOpacity>

        {/* FOOD BUTTON (6+ months) */}
        {showFoodButton && (
          <TouchableOpacity 
            onPress={() => handleLog('food')}
            style={{
              backgroundColor: '#FF9800',
              height: 80,
              borderRadius: 12,
              marginBottom: 16,
              justifyContent: 'center',
              alignItems: 'center',
              flexDirection: 'row',
              paddingHorizontal: 20
            }}
          >
            <Text style={{ fontSize: 40, marginRight: 12 }}>🍚</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>
                খাবার খাওয়ালাম
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* SLEEP BUTTON */}
        <TouchableOpacity 
          onPress={() => handleLog('sleep')}
          style={{
            backgroundColor: '#2196F3',
            height: 80,
            borderRadius: 12,
            marginBottom: 16,
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'row',
            paddingHorizontal: 20
          }}
        >
          <Text style={{ fontSize: 40, marginRight: 12 }}>😴</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>
              ঘুমাচ্ছে
            </Text>
          </View>
        </TouchableOpacity>

        {/* DIAPER BUTTON */}
        <TouchableOpacity 
          onPress={() => handleLog('diaper')}
          style={{
            backgroundColor: '#9C27B0',
            height: 80,
            borderRadius: 12,
            marginBottom: 16,
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'row',
            paddingHorizontal: 20
          }}
        >
          <Text style={{ fontSize: 40, marginRight: 12 }}>💩</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>
              ডায়াপার বদলালাম
            </Text>
          </View>
        </TouchableOpacity>

        {/* WEEKLY SUMMARY (if 7+ days) */}
        {((logs.feed || []).length >= 21 || (logs.sleep || []).length >= 21 || (logs.diaper || []).length >= 21) && (
          <View style={{
            backgroundColor: '#E3F2FD',
            padding: 20,
            borderRadius: 16,
            marginTop: 24,
            borderLeftWidth: 6,
            borderLeftColor: '#2196F3'
          }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 16, color: '#1565C0' }}>
              📊 গত ৭ দিনের সারসংক্ষেপ
            </Text>
            
            {(logs.feed || []).length >= 21 && (
              <Text style={{ fontSize: 16, color: '#1976D2', marginBottom: 8 }}>
                🍼 দুধ: দিনে গড়ে {toBengaliNumber(Math.round(getAverageLast7Days('feed', logs) || 0))} বার
              </Text>
            )}
            
            {(logs.sleep || []).length >= 21 && (
              <Text style={{ fontSize: 16, color: '#1976D2', marginBottom: 8 }}>
                😴 ঘুম: দিনে গড়ে {toBengaliNumber(Math.round(getAverageLast7Days('sleep', logs) || 0))} বার
              </Text>
            )}
            
            {(logs.diaper || []).length >= 21 && (
              <Text style={{ fontSize: 16, color: '#1976D2', marginBottom: 8 }}>
                💩 ডায়াপার: দিনে গড়ে {toBengaliNumber(Math.round(getAverageLast7Days('diaper', logs) || 0))} বার
              </Text>
            )}
            
            <View style={{
              marginTop: 16,
              paddingTop: 16,
              borderTopWidth: 1,
              borderTopColor: '#BBDEFB'
            }}>
              <Text style={{ fontSize: 15, color: '#1565C0', fontWeight: 'bold' }}>
                ✅ সবকিছু স্বাভাবিক আছে!
              </Text>
              <Text style={{ fontSize: 14, color: '#1976D2', marginTop: 4 }}>
                চমৎকার যত্ন নিচ্ছেন! চালিয়ে যান! 💚
              </Text>
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}
