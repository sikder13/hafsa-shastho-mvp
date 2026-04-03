// screens/SettingsScreen.js
// Settings + Profile Edit — account management, app info, data controls

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { formatDateInput, calculateAge, toBengaliNumber } from '../utils/helpers';
import { COLORS } from '../utils/constants';
import { supabase } from '../supabaseClient';
import { cancelAllNotifications } from '../services/notificationService';

export default function SettingsScreen({ onBack }) {
    const {
        baby,
        motherProfile,
        saveBabyProfile,
        saveMotherProfile,
        resetAllData,
        setIsAuthenticated
      } = useApp();

  const [editingBaby, setEditingBaby] = useState(false);
  const [editingMother, setEditingMother] = useState(false);

  // Baby edit state
  const [babyName, setBabyName] = useState(baby?.name || '');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState(baby?.gender || '');

  // Mother edit state
  const [motherName, setMotherName] = useState(motherProfile?.name || '');
  const [deliveryType, setDeliveryType] = useState(motherProfile?.delivery_type || '');

  // Format existing birth date for display
  const getDisplayBirthDate = () => {
    if (!baby?.birth_date) return '';
    const d = new Date(baby.birth_date);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  const handleSaveBaby = async () => {
    if (!babyName.trim()) {
      Alert.alert('ত্রুটি', 'শিশুর নাম দিন');
      return;
    }

    const updatedBaby = {
      ...baby,
      name: babyName.trim(),
      gender: gender || baby.gender
    };

    // Update birth date only if user entered a new one
    if (birthDate.length === 10) {
      const [dd, mm, yyyy] = birthDate.split('-');
      const formatted = `${yyyy}-${mm}-${dd}`;
      const dateObj = new Date(formatted);
      if (!isNaN(dateObj.getTime())) {
        updatedBaby.birth_date = formatted;
      }
    }

    await saveBabyProfile(updatedBaby);
    setEditingBaby(false);
    Alert.alert('সফল!', 'শিশুর তথ্য আপডেট হয়েছে');
  };

  const handleSaveMother = async () => {
    if (!motherName.trim()) {
      Alert.alert('ত্রুটি', 'আপনার নাম দিন');
      return;
    }

    const updatedMother = {
      ...motherProfile,
      name: motherName.trim(),
      delivery_type: deliveryType || motherProfile?.delivery_type
    };

    await saveMotherProfile(updatedMother);
    setEditingMother(false);
    Alert.alert('সফল!', 'মায়ের তথ্য আপডেট হয়েছে');
  };

  // Logout — clears local session, keeps cloud data
  const handleLogout = () => {
    Alert.alert(
      'লগআউট',
      'লগআউট করলে এই ডিভাইসের ডেটা মুছে যাবে, কিন্তু ক্লাউডে আপনার সব তথ্য সুরক্ষিত থাকবে। আবার লগইন করলে সব ফিরে আসবে।',
      [
        { text: 'না', style: 'cancel' },
        {
          text: 'লগআউট করুন',
          onPress: async () => {
            try {
              await cancelAllNotifications();
              await supabase.auth.signOut();
              await resetAllData();
              setIsAuthenticated(false);
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('ত্রুটি', 'লগআউট করতে সমস্যা হয়েছে।');
            }
          }
        }
      ]
    );
  };

  // Delete account — removes EVERYTHING from local + Supabase (PDPO 2025)
  const handleDeleteAccount = () => {
    Alert.alert(
      'সত্যিই চলে যাবেন? 💚',
      `${motherProfile?.name || 'আপু'}, আপনার এবং ${baby?.name || 'শিশুর'} সব তথ্য — প্রতিদিনের লগ, চেক-ইন, হাফসা আপার সাথে কথা — সব চিরতরে মুছে যাবে।\n\nযদি কোনো সমস্যা থাকে, আমরা সাহায্য করতে চাই। hafsa.shastho@gmail.com এ লিখুন।`,


      [
        { text: 'না, রাখুন', style: 'cancel' },
        {
          text: 'হ্যাঁ, সব মুছুন',
          style: 'destructive',
          onPress: () => {
            // Double confirmation for destructive action
            Alert.alert(
              '🔴 শেষ সুযোগ',
              'আপনি কি নিশ্চিত? এই কাজটি ফিরিয়ে আনা যাবে না।',
              [
                { text: 'না', style: 'cancel' },
                {
                  text: 'চিরতরে মুছুন',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await cancelAllNotifications();
                      // Delete from Supabase (CASCADE will remove all related data)
                      const { data: { user } } = await supabase.auth.getUser();
                      if (user) {
                        // Delete profile — CASCADE removes babies, logs, etc.
                        await supabase.from('profiles').delete().eq('id', user.id);
                        // Delete baby and related data
                        await supabase.from('babies').delete().eq('user_id', user.id);
                        await supabase.from('mother_daily_logs').delete().eq('user_id', user.id);
                        await supabase.from('ai_interactions').delete().eq('user_id', user.id);
                        await supabase.from('epds_assessments').delete().eq('user_id', user.id);
                        await supabase.from('user_consents').delete().eq('user_id', user.id);
                        await supabase.from('subscriptions').delete().eq('user_id', user.id);
                        await supabase.from('ai_usage').delete().eq('user_id', user.id);
                      }

                      // Sign out
                      await supabase.auth.signOut();
                      // Clear local
                      await resetAllData();
                      setIsAuthenticated(false);

                      Alert.alert('সম্পন্ন', 'আপনার অ্যাকাউন্ট মুছে ফেলা হয়েছে।');
                    } catch (error) {
                      console.error('Delete account error:', error);
                      Alert.alert('ত্রুটি', 'অ্যাকাউন্ট মুছতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
                    }
                  }
                }
              ]
            );
          }
        }
      ]
    );
  };
  
  const handleResetApp = () => {
    Alert.alert(
      '⚠️ সব ডেটা মুছে ফেলুন',
      'এই কাজটি ফিরিয়ে আনা যাবে না। সব তথ্য মুছে যাবে এবং নতুন করে শুরু করতে হবে।',
      [
        { text: 'না, রাখুন', style: 'cancel' },
        {
          text: 'হ্যাঁ, সব মুছুন',
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

  const ageInfo = baby ? calculateAge(baby.birth_date) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>

      {/* HEADER */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border
      }}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={{ marginRight: 12, padding: 4 }}>
            <Text style={{ fontSize: 24 }}>←</Text>
          </TouchableOpacity>
        )}
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: COLORS.dark }}>
          ⚙️ সেটিংস
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>

        {/* BABY PROFILE SECTION */}
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.dark, marginBottom: 12 }}>
          👶 শিশুর তথ্য
        </Text>

        {!editingBaby ? (
          <View style={{
            backgroundColor: COLORS.cardBg,
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: COLORS.border
          }}>
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 13, color: COLORS.gray }}>নাম</Text>
              <Text style={{ fontSize: 17, color: COLORS.dark, fontWeight: '600', marginTop: 2 }}>{baby?.name || '—'}</Text>
            </View>
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 13, color: COLORS.gray }}>জন্ম তারিখ</Text>
              <Text style={{ fontSize: 17, color: COLORS.dark, fontWeight: '600', marginTop: 2 }}>
                {getDisplayBirthDate() || '—'}
              </Text>
            </View>
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 13, color: COLORS.gray }}>বয়স</Text>
              <Text style={{ fontSize: 17, color: COLORS.dark, fontWeight: '600', marginTop: 2 }}>
                {ageInfo?.bengaliAge || '—'}
              </Text>
            </View>
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, color: COLORS.gray }}>লিঙ্গ</Text>
              <Text style={{ fontSize: 17, color: COLORS.dark, fontWeight: '600', marginTop: 2 }}>
                {baby?.gender === 'male' ? '👦 ছেলে' : baby?.gender === 'female' ? '👧 মেয়ে' : '—'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setBabyName(baby?.name || '');
                setBirthDate('');
                setGender(baby?.gender || '');
                setEditingBaby(true);
              }}
              style={{
                backgroundColor: COLORS.primaryLight,
                padding: 12,
                borderRadius: 8,
                alignItems: 'center'
              }}
            >
              <Text style={{ color: COLORS.primaryDark, fontSize: 15, fontWeight: 'bold' }}>
                ✏️ এডিট করুন
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{
            backgroundColor: COLORS.cardBg,
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
            borderWidth: 2,
            borderColor: COLORS.primary
          }}>
            <Text style={{ fontSize: 14, color: COLORS.gray, marginBottom: 6 }}>নাম</Text>
            <TextInput
              value={babyName}
              onChangeText={setBabyName}
              placeholder="শিশুর নাম"
              style={{
                borderWidth: 1, borderColor: COLORS.border, borderRadius: 8,
                padding: 12, fontSize: 16, marginBottom: 16
              }}
            />

            <Text style={{ fontSize: 14, color: COLORS.gray, marginBottom: 6 }}>জন্ম তারিখ (DD-MM-YYYY)</Text>
            <TextInput
              value={birthDate}
              onChangeText={(text) => setBirthDate(formatDateInput(text))}
              placeholder={getDisplayBirthDate() || 'DD-MM-YYYY'}
              keyboardType="number-pad"
              maxLength={10}
              style={{
                borderWidth: 1, borderColor: COLORS.border, borderRadius: 8,
                padding: 12, fontSize: 16, marginBottom: 16
              }}
            />

            <Text style={{ fontSize: 14, color: COLORS.gray, marginBottom: 6 }}>লিঙ্গ</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
              {[
                { id: 'male', label: '👦 ছেলে' },
                { id: 'female', label: '👧 মেয়ে' }
              ].map(item => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => setGender(item.id)}
                  style={{
                    flex: 1, padding: 12, borderRadius: 8, alignItems: 'center',
                    borderWidth: 2,
                    borderColor: gender === item.id ? COLORS.primary : COLORS.border,
                    backgroundColor: gender === item.id ? COLORS.primaryLight : COLORS.cardBg
                  }}
                >
                  <Text style={{
                    fontSize: 15,
                    color: gender === item.id ? COLORS.primaryDark : COLORS.gray,
                    fontWeight: gender === item.id ? 'bold' : 'normal'
                  }}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={handleSaveBaby}
                style={{ flex: 1, backgroundColor: COLORS.primary, padding: 14, borderRadius: 8, alignItems: 'center' }}
              >
                <Text style={{ color: 'white', fontSize: 15, fontWeight: 'bold' }}>সংরক্ষণ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setEditingBaby(false)}
                style={{ flex: 1, backgroundColor: COLORS.border, padding: 14, borderRadius: 8, alignItems: 'center' }}
              >
                <Text style={{ color: COLORS.gray, fontSize: 15, fontWeight: 'bold' }}>বাতিল</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* MOTHER PROFILE SECTION */}
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.dark, marginBottom: 12 }}>
          🤱 মায়ের তথ্য
        </Text>

        {!editingMother ? (
          <View style={{
            backgroundColor: COLORS.cardBg,
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: COLORS.border
          }}>
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 13, color: COLORS.gray }}>নাম</Text>
              <Text style={{ fontSize: 17, color: COLORS.dark, fontWeight: '600', marginTop: 2 }}>{motherProfile?.name || '—'}</Text>
            </View>
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 13, color: COLORS.gray }}>ডেলিভারি</Text>
              <Text style={{ fontSize: 17, color: COLORS.dark, fontWeight: '600', marginTop: 2 }}>
                {motherProfile?.delivery_type === 'csection' ? '🏥 সিজার' : motherProfile?.delivery_type === 'normal' ? '🤱 নরমাল' : '—'}
              </Text>
            </View>
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, color: COLORS.gray }}>প্রথম সন্তান</Text>
              <Text style={{ fontSize: 17, color: COLORS.dark, fontWeight: '600', marginTop: 2 }}>
                {motherProfile?.is_first_baby === true ? 'হ্যাঁ' : motherProfile?.is_first_baby === false ? 'না' : '—'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setMotherName(motherProfile?.name || '');
                setDeliveryType(motherProfile?.delivery_type || '');
                setEditingMother(true);
              }}
              style={{
                backgroundColor: '#FFF0F3',
                padding: 12,
                borderRadius: 8,
                alignItems: 'center'
              }}
            >
              <Text style={{ color: COLORS.mother, fontSize: 15, fontWeight: 'bold' }}>
                ✏️ এডিট করুন
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{
            backgroundColor: COLORS.cardBg,
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
            borderWidth: 2,
            borderColor: COLORS.mother
          }}>
            <Text style={{ fontSize: 14, color: COLORS.gray, marginBottom: 6 }}>নাম</Text>
            <TextInput
              value={motherName}
              onChangeText={setMotherName}
              placeholder="আপনার নাম"
              style={{
                borderWidth: 1, borderColor: COLORS.border, borderRadius: 8,
                padding: 12, fontSize: 16, marginBottom: 16
              }}
            />

            <Text style={{ fontSize: 14, color: COLORS.gray, marginBottom: 6 }}>ডেলিভারি ধরন</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
              {[
                { id: 'normal', label: '🤱 নরমাল' },
                { id: 'csection', label: '🏥 সিজার' }
              ].map(item => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => setDeliveryType(item.id)}
                  style={{
                    flex: 1, padding: 12, borderRadius: 8, alignItems: 'center',
                    borderWidth: 2,
                    borderColor: deliveryType === item.id ? COLORS.mother : COLORS.border,
                    backgroundColor: deliveryType === item.id ? '#FFF0F3' : COLORS.cardBg
                  }}
                >
                  <Text style={{
                    fontSize: 15,
                    color: deliveryType === item.id ? COLORS.mother : COLORS.gray,
                    fontWeight: deliveryType === item.id ? 'bold' : 'normal'
                  }}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={handleSaveMother}
                style={{ flex: 1, backgroundColor: COLORS.mother, padding: 14, borderRadius: 8, alignItems: 'center' }}
              >
                <Text style={{ color: 'white', fontSize: 15, fontWeight: 'bold' }}>সংরক্ষণ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setEditingMother(false)}
                style={{ flex: 1, backgroundColor: COLORS.border, padding: 14, borderRadius: 8, alignItems: 'center' }}
              >
                <Text style={{ color: COLORS.gray, fontSize: 15, fontWeight: 'bold' }}>বাতিল</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* APP INFO */}
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.dark, marginBottom: 12 }}>
          📱 অ্যাপ সম্পর্কে
        </Text>

        <View style={{
          backgroundColor: COLORS.cardBg,
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
          borderWidth: 1,
          borderColor: COLORS.border
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 15, color: COLORS.gray }}>ভার্সন</Text>
            <Text style={{ fontSize: 15, color: COLORS.dark, fontWeight: '600' }}>২.০ (MVP)</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 15, color: COLORS.gray }}>ডেটা সংরক্ষণ</Text>
            <Text style={{ fontSize: 15, color: COLORS.dark, fontWeight: '600' }}>এই ডিভাইসে</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 15, color: COLORS.gray }}>AI মডেল</Text>
            <Text style={{ fontSize: 15, color: COLORS.dark, fontWeight: '600' }}>Claude Sonnet</Text>
          </View>
        </View>

        {/* PRIVACY */}
        <View style={{
          backgroundColor: '#E3F2FD',
          borderRadius: 12,
          padding: 16,
          marginBottom: 20
        }}>
          <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#1565C0', marginBottom: 8 }}>
            🔒 আপনার ডেটা নিরাপদ
          </Text>
          <Text style={{ fontSize: 14, color: '#1976D2', lineHeight: 22 }}>
            আপনার সব তথ্য শুধুমাত্র আপনার ফোনে সংরক্ষিত। আমরা কোনো ব্যক্তিগত তথ্য তৃতীয় পক্ষের সাথে শেয়ার করি না। AI চ্যাটের তথ্য শুধুমাত্র আপনাকে ভালো সেবা দিতে ব্যবহৃত হয়।
          </Text>
        </View>

        {/* DANGER ZONE */}
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.danger, marginBottom: 12 }}>
          ⚠️ বিপদ অঞ্চল
        </Text>

        <TouchableOpacity
          onPress={handleResetApp}
          style={{
            backgroundColor: '#FFEBEE',
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: '#FFCDD2',
            marginBottom: 20
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: COLORS.danger, marginBottom: 4 }}>
            🗑️ সব ডেটা মুছে ফেলুন
          </Text>
          <Text style={{ fontSize: 13, color: '#C62828' }}>
            এই কাজটি ফিরিয়ে আনা যাবে না। সব তথ্য মুছে যাবে।
          </Text>
        </TouchableOpacity>

        {/* LOGOUT */}
        <TouchableOpacity
          onPress={handleLogout}
          style={{
            backgroundColor: '#FFF3E0',
            padding: 16,
            borderRadius: 12,
            alignItems: 'center',
            marginTop: 12,
            borderWidth: 1.5,
            borderColor: '#FF9800',
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#E65100' }}>
            🚪 লগআউট
          </Text>
          <Text style={{ fontSize: 12, color: '#FF9800', marginTop: 4 }}>
            ক্লাউডে ডেটা সুরক্ষিত থাকবে
          </Text>
        </TouchableOpacity>

        {/* DELETE ACCOUNT — intentionally subtle, required by App Store */}
        <TouchableOpacity
          onPress={handleDeleteAccount}
          style={{
            alignItems: 'center',
            marginTop: 40,
            marginBottom: 20,
            padding: 8,
          }}
        >
          <Text style={{ fontSize: 12, color: '#BDBDBD', textDecorationLine: 'underline' }}>
            অ্যাকাউন্ট মুছে ফেলুন
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}