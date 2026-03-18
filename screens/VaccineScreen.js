import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BD_EPI_SCHEDULE } from '../data/bdEPISchedule';
import { EPI_CENTERS, AREAS } from '../data/epiCenters';
import { toBengaliNumber, formatDateBengali } from '../utils/helpers';
import { COLORS, STORAGE_KEYS, TEXT } from '../utils/constants';
import { syncVaccineRecord } from '../services/supabaseService';
import { useApp } from '../context/AppContext';

export default function VaccineScreen({ baby, onBack }) {
  const { updateVaccineStatus: updateGlobalVaccine } = useApp();
  const [vaccineStatus, setVaccineStatus] = useState({});
  const [userArea, setUserArea] = useState('');
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [nearestCenters, setNearestCenters] = useState([]);

  useEffect(() => {
    loadVaccineStatus();
    checkUserArea();
    
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

  const checkUserArea = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.userArea);
      if (saved) {
        setUserArea(saved);
        findNearestCenters(saved);
      } else {
        setShowLocationPicker(true);
      }
    } catch (error) {
      console.error('Error loading area:', error);
    }
  };

  const handleAreaSelect = async (area) => {
    setUserArea(area);
    await AsyncStorage.setItem(STORAGE_KEYS.userArea, area);
    findNearestCenters(area);
    setShowLocationPicker(false);
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const findNearestCenters = (area) => {
    const areaCenter = EPI_CENTERS.find(c => c.area === area);
    if (!areaCenter) return;

    const centersWithDistance = EPI_CENTERS.map(center => ({
      ...center,
      distance: calculateDistance(
        areaCenter.lat,
        areaCenter.lng,
        center.lat,
        center.lng
      )
    })).sort((a, b) => a.distance - b.distance);

    setNearestCenters(centersWithDistance.slice(0, 3));
  };

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

        {showLocationPicker && (
          <View style={{
            backgroundColor: COLORS.cardBg,
            padding: 20,
            borderRadius: 12,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: COLORS.border
          }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>
              📍 আপনার এলাকা নির্বাচন করুন
            </Text>
            <Text style={{ fontSize: 14, color: COLORS.gray, marginBottom: 16 }}>
              নিকটতম টিকা সেন্টার খুঁজতে
            </Text>
            <ScrollView style={{ maxHeight: 200 }}>
              {AREAS.map(area => (
                <TouchableOpacity
                  key={area}
                  onPress={() => handleAreaSelect(area)}
                  style={{
                    padding: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: COLORS.border
                  }}
                >
                  <Text style={{ fontSize: 16 }}>{area}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {userArea && nearestCenters.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <View style={{
              backgroundColor: '#FFF3E0',
              padding: 16,
              borderRadius: 12,
              marginBottom: 16,
              borderLeftWidth: 4,
              borderLeftColor: COLORS.warning
            }}>
              <Text style={{ fontSize: 14, color: '#E65100', fontWeight: 'bold' }}>
                ⚠️ গুরুত্বপূর্ণ
              </Text>
              <Text style={{ fontSize: 13, color: '#E65100', marginTop: 4 }}>
                দয়া করে যাওয়ার আগে ফোন করে নিশ্চিত করুন। আমরা নিয়মিত তথ্য আপডেট করছি।
              </Text>
            </View>

            <View style={{
              backgroundColor: COLORS.primaryLight,
              padding: 16,
              borderRadius: 12
            }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>
                📍 আপনার এলাকায় ({userArea})
              </Text>
              
              {nearestCenters.map((center, index) => (
                <TouchableOpacity
                  key={center.id}
                  onPress={() => {
                    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(center.name + ' ' + center.address)}`;
                    Linking.openURL(url);
                  }}
                  style={{
                    backgroundColor: COLORS.cardBg,
                    padding: 12,
                    borderRadius: 8,
                    marginBottom: index < nearestCenters.length - 1 ? 12 : 0
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: 'bold' }}>
                    {index + 1}. {center.name}
                  </Text>
                  <Text style={{ fontSize: 14, color: COLORS.gray, marginTop: 4 }}>
                    📏 {center.distance < 1 
                      ? `${(center.distance * 1000).toFixed(0)} মিটার` 
                      : `${center.distance.toFixed(1)} কিমি`} দূরে
                  </Text>
                  <Text style={{ fontSize: 14, color: COLORS.gray, marginTop: 2 }}>
                    🕐 {center.hours}
                  </Text>
                  <Text style={{ fontSize: 14, color: COLORS.gray, marginTop: 2 }}>
                    📞 {center.phone}
                  </Text>
                  <Text style={{ fontSize: 14, color: COLORS.info, marginTop: 8 }}>
                    মানচিত্রে দেখুন →
                  </Text>
                </TouchableOpacity>
              ))}
              
              <TouchableOpacity
                onPress={() => setShowLocationPicker(true)}
                style={{
                  marginTop: 12,
                  alignItems: 'center'
                }}
              >
                <Text style={{ fontSize: 14, color: COLORS.primary }}>
                  এলাকা পরিবর্তন করুন
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

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
                      <Text style={{ fontSize: 18, fontWeight: 'bold' }}>
                        {vaccine.nameBangla}
                      </Text>
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