import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../supabaseClient';

export default function AuthScreen() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    if (!phone || phone.length < 10) {
      Alert.alert('ত্রুটি', 'অনুগ্রহ করে একটি বৈধ ফোন নম্বর লিখুন');
      return;
    }

    setLoading(true);
    try {
      const phoneNumber = phone.startsWith('+880') ? phone : `+880${phone}`;
      const { error } = await supabase.auth.signInWithOtp({
        phone: phoneNumber,
      });

      if (error) {
        Alert.alert('ত্রুটি', error.message);
      } else {
        setOtpSent(true);
        Alert.alert('সফল', 'OTP কোডটি আপনার ফোনে পাঠানো হয়েছে');
      }
    } catch (error) {
      Alert.alert('ত্রুটি', 'কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      Alert.alert('ত্রুটি', 'অনুগ্রহ করে ৬ সংখ্যার OTP কোড লিখুন');
      return;
    }

    setLoading(true);
    try {
      const phoneNumber = phone.startsWith('+880') ? phone : `+880${phone}`;
      const { data, error } = await supabase.auth.verifyOtp({
        phone: phoneNumber,
        token: otp,
        type: 'sms',
      });

      if (error) {
        Alert.alert('ত্রুটি', error.message);
      } else {
        // Authentication successful, App.js will handle navigation
        Alert.alert('সফল', 'লগইন সফল হয়েছে!');
      }
    } catch (error) {
      Alert.alert('ত্রুটি', 'কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff', justifyContent: 'center', padding: 20 }}>
      <View style={{ alignItems: 'center', marginBottom: 40 }}>
        <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#4CAF50', marginBottom: 10 }}>
          হাফসা স্বাস্থ্য
        </Text>
        <Text style={{ fontSize: 20, color: '#333', marginTop: 10 }}>
          আস্সালামু আলাইকুম
        </Text>
      </View>

      {!otpSent ? (
        <View>
          <Text style={{ fontSize: 16, color: '#333', marginBottom: 8 }}>
            ফোন নম্বর
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 18, color: '#666', marginRight: 8 }}>+880</Text>
            <TextInput
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: '#ddd',
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
                backgroundColor: '#f9f9f9',
              }}
              placeholder="1XXXXXXXXX"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              maxLength={10}
            />
          </View>

          <TouchableOpacity
            style={{
              backgroundColor: '#4CAF50',
              padding: 16,
              borderRadius: 8,
              alignItems: 'center',
            }}
            onPress={handleSendOtp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: 'bold' }}>
                OTP পাঠান
              </Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          <Text style={{ fontSize: 16, color: '#333', marginBottom: 8 }}>
            OTP কোড
          </Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: '#ddd',
              borderRadius: 8,
              padding: 12,
              fontSize: 18,
              backgroundColor: '#f9f9f9',
              marginBottom: 20,
              textAlign: 'center',
              letterSpacing: 8,
            }}
            placeholder="000000"
            keyboardType="number-pad"
            value={otp}
            onChangeText={setOtp}
            maxLength={6}
          />

          <TouchableOpacity
            style={{
              backgroundColor: '#4CAF50',
              padding: 16,
              borderRadius: 8,
              alignItems: 'center',
              marginBottom: 15,
            }}
            onPress={handleVerifyOtp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: 'bold' }}>
                যাচাই করুন
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setOtpSent(false);
              setOtp('');
            }}
          >
            <Text style={{ color: '#4CAF50', fontSize: 16, textAlign: 'center' }}>
              নতুন OTP পাঠান
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
