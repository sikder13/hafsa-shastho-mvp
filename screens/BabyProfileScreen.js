import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { supabase } from '../supabaseClient';

export default function BabyProfileScreen({ onProfileCreated }) {
  const [babyName, setBabyName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [loading, setLoading] = useState(false);

  const calculateAge = (dateString) => {
    try {
      const [day, month, year] = dateString.split('-').map(Number);
      const birthDate = new Date(year, month - 1, day);
      const today = new Date();
      
      let years = today.getFullYear() - birthDate.getFullYear();
      let months = today.getMonth() - birthDate.getMonth();
      let days = today.getDate() - birthDate.getDate();

      if (days < 0) {
        months--;
        const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        days += lastMonth.getDate();
      }

      if (months < 0) {
        years--;
        months += 12;
      }

      if (years > 0) {
        return `${years} বছর ${months} মাস`;
      } else if (months > 0) {
        return `${months} মাস ${days} দিন`;
      } else {
        return `${days} দিন`;
      }
    } catch (error) {
      return 'গণনা করা যায়নি';
    }
  };

  const formatDate = (text) => {
    // Remove non-numeric characters
    const numbers = text.replace(/\D/g, '');
    
    // Format as DD-MM-YYYY
    if (numbers.length <= 2) {
      return numbers;
    } else if (numbers.length <= 4) {
      return `${numbers.slice(0, 2)}-${numbers.slice(2)}`;
    } else {
      return `${numbers.slice(0, 2)}-${numbers.slice(2, 4)}-${numbers.slice(4, 8)}`;
    }
  };

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

      // TODO: Re-enable for production
      // Insert subscription table entry if needed
      // const { error: subError } = await supabase
      //   .from('subscriptions')
      //   .insert([
      //     {
      //       user_id: userId,
      //       baby_id: data[0].id,
      //       // ... other subscription fields
      //     },
      //   ]);
      //
      // if (subError) {
      //   Alert.alert('ত্রুটি', subError.message);
      //   setLoading(false);
      //   return;
      // }

      // Mock data for testing (remove in production)
      const userId = 'mock-user-' + Date.now(); // Mock user ID for testing
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

  const ageDisplay = birthDate.length === 10 ? calculateAge(birthDate) : '';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <View style={{ padding: 20, paddingTop: 40 }}>
        <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#4CAF50', marginBottom: 30, textAlign: 'center' }}>
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
            onChangeText={(text) => setBirthDate(formatDate(text))}
            maxLength={10}
            keyboardType="number-pad"
          />
          {ageDisplay && (
            <Text style={{ fontSize: 14, color: '#4CAF50', marginTop: 8 }}>
              বয়স: {ageDisplay}
            </Text>
          )}
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
                borderColor: gender === 'male' ? '#4CAF50' : '#ddd',
                backgroundColor: gender === 'male' ? '#E8F5E9' : '#f9f9f9',
                alignItems: 'center',
              }}
              onPress={() => setGender('male')}
            >
              <Text style={{ 
                fontSize: 16, 
                color: gender === 'male' ? '#4CAF50' : '#666',
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
                borderColor: gender === 'female' ? '#4CAF50' : '#ddd',
                backgroundColor: gender === 'female' ? '#E8F5E9' : '#f9f9f9',
                alignItems: 'center',
              }}
              onPress={() => setGender('female')}
            >
              <Text style={{ 
                fontSize: 16, 
                color: gender === 'female' ? '#4CAF50' : '#666',
                fontWeight: gender === 'female' ? 'bold' : 'normal'
              }}>
                মেয়ে
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={{
            backgroundColor: '#4CAF50',
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
