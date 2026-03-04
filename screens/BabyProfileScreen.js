import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { supabase } from '../supabaseClient';
import { formatDateInput, calculateAge } from '../utils/helpers';
import { COLORS } from '../utils/constants';

export default function BabyProfileScreen({ onProfileCreated }) {
  const [babyName, setBabyName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!babyName.trim()) {
      Alert.alert('ত্রুটি', 'অনুগ্রহ করে শিশুর নাম লিখুন');
      return;
    }

    if (!birthDate || birthDate.length !== 10) {
      Alert.alert('ত্রুটি', 'অনুগ্রহ করে জন্ম তারিখ লিখুন (DD-MM-YYYY)');
      return;
    }

    if (!gender) {
      Alert.alert('ত্রুটি', 'অনুগ্রহ করে লিঙ্গ নির্বাচন করুন');
      return;
    }

    // Validate date format
    const dateRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
    if (!dateRegex.test(birthDate)) {
      Alert.alert('ত্রুটি', 'তারিখের ফরম্যাট সঠিক নয় (DD-MM-YYYY)');
      return;
    }

    setLoading(true);
    try {
      // Parse date for database storage (YYYY-MM-DD format)
      const [day, month, year] = birthDate.split('-');
      const formattedDate = `${year}-${month}-${day}`;

      // TODO: Re-enable for production
      // Get authenticated user
      // const { data: { user } } = await supabase.auth.getUser();
      // 
      // if (!user) {
      //   Alert.alert('ত্রুটি', 'ব্যবহারকারী লগইন নেই');
      //   setLoading(false);
      //   return;
      // }
      // 
      // const userId = user.id;

      // TODO: Re-enable for production
      // Insert baby profile into Supabase
      // const { data, error } = await supabase
      //   .from('babies')
      //   .insert([
      //     {
      //       user_id: userId,
      //       name: babyName.trim(),
      //       birth_date: formattedDate,
      //       gender: gender || null,
      //     },
      //   ]);
      //
      // if (error) {
      //   Alert.alert('ত্রুটি', error.message);
      //   setLoading(false);
      //   return;
      // }

      // Mock data for testing (remove in production)
      const userId = 'mock-user-' + Date.now();
      const mockBabyData = {
        id: 'mock-baby-' + Date.now(),
        user_id: userId,
        name: babyName.trim(),
        birth_date: formattedDate,
        gender: gender || null,
        created_at: new Date().toISOString()
      };
      
      // Call parent callback FIRST
      if (onProfileCreated) {
        onProfileCreated(mockBabyData);
      }
      
      // Then show success message
      Alert.alert(
        'সফল!',
        'প্রোফাইল তৈরি হয়েছে',
        [{ text: 'ঠিক আছে' }]
      );
    } catch (error) {
      Alert.alert('ত্রুটি', 'কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন');
    } finally {
      setLoading(false);
    }
  };

  // Calculate age display using shared helper
  const getAgeDisplay = () => {
    if (birthDate.length !== 10) return '';
    try {
      const [day, month, year] = birthDate.split('-');
      const formattedDate = `${year}-${month}-${day}`;
      const ageInfo = calculateAge(formattedDate);
      return ageInfo.bengaliAge;
    } catch {
      return 'গণনা করা যায়নি';
    }
  };

  const ageDisplay = getAgeDisplay();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <View style={{ padding: 20, paddingTop: 40 }}>
        <Text style={{ fontSize: 28, fontWeight: 'bold', color: COLORS.primary, marginBottom: 30, textAlign: 'center' }}>
          শিশুর প্রোফাইল তৈরি করুন
        </Text>

        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 16, color: '#333', marginBottom: 8 }}>
            শিশুর নাম
          </Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: '#ddd',
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              backgroundColor: '#f9f9f9',
            }}
            placeholder="শিশুর নাম লিখুন"
            value={babyName}
            onChangeText={setBabyName}
          />
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 16, color: '#333', marginBottom: 8 }}>
            জন্ম তারিখ (DD-MM-YYYY)
          </Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: '#ddd',
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              backgroundColor: '#f9f9f9',
            }}
            placeholder="DD-MM-YYYY"
            value={birthDate}
            onChangeText={(text) => setBirthDate(formatDateInput(text))}
            maxLength={10}
            keyboardType="number-pad"
          />
          {ageDisplay ? (
            <Text style={{ fontSize: 14, color: COLORS.primary, marginTop: 8 }}>
              বয়স: {ageDisplay}
            </Text>
          ) : null}
        </View>

        <View style={{ marginBottom: 30 }}>
          <Text style={{ fontSize: 16, color: '#333', marginBottom: 12 }}>
            লিঙ্গ
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={{
                flex: 1,
                padding: 16,
                borderRadius: 8,
                borderWidth: 2,
                borderColor: gender === 'male' ? COLORS.primary : '#ddd',
                backgroundColor: gender === 'male' ? COLORS.primaryLight : '#f9f9f9',
                alignItems: 'center',
              }}
              onPress={() => setGender('male')}
            >
              <Text style={{ 
                fontSize: 16, 
                color: gender === 'male' ? COLORS.primary : COLORS.gray,
                fontWeight: gender === 'male' ? 'bold' : 'normal'
              }}>
                ছেলে
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                flex: 1,
                padding: 16,
                borderRadius: 8,
                borderWidth: 2,
                borderColor: gender === 'female' ? COLORS.primary : '#ddd',
                backgroundColor: gender === 'female' ? COLORS.primaryLight : '#f9f9f9',
                alignItems: 'center',
              }}
              onPress={() => setGender('female')}
            >
              <Text style={{ 
                fontSize: 16, 
                color: gender === 'female' ? COLORS.primary : COLORS.gray,
                fontWeight: gender === 'female' ? 'bold' : 'normal'
              }}>
                মেয়ে
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={{
            backgroundColor: COLORS.primary,
            padding: 16,
            borderRadius: 8,
            alignItems: 'center',
            marginTop: 10,
          }}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: 'bold' }}>
              সংরক্ষণ করুন
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}