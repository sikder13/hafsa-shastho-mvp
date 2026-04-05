/**
 * Hafsa Sastho (হাফসা স্বাস্থ্য)
 * Bangladesh's First AI Companion for Postpartum and Early Childhood Care
 * Copyright © 2026 Nahl Technologies Inc. All rights reserved.
 *
 * @author Udaay Sikder — Co-Founder & Dev
 */
// screens/BabyHubScreen.js
// Baby tab hub — shows today's baby summary + feature cards

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { toBengaliNumber, calculateAge, countToday } from '../utils/helpers';
import { COLORS } from '../utils/constants';

export default function BabyHubScreen({ baby, navigation }) {
  const { logs } = useApp();

  const ageInfo = calculateAge(baby.birth_date);

  const todayFeed = countToday(logs.feed);
  const todaySleep = countToday(logs.sleep);
  const todayDiaper = countToday(logs.diaper);
  const todayFood = countToday(logs.food);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>

        {/* HEADER */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: COLORS.dark }}>
            👶 {baby.name}
          </Text>
          <Text style={{ fontSize: 16, color: COLORS.gray, marginTop: 4 }}>
            বয়স: {ageInfo.bengaliAge}
          </Text>
        </View>

        {/* TODAY'S SUMMARY */}
        <View style={{
          backgroundColor: COLORS.primaryLight,
          borderRadius: 16,
          padding: 20,
          marginBottom: 24,
          borderLeftWidth: 5,
          borderLeftColor: COLORS.primary
        }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.primaryDark, marginBottom: 16 }}>
            📊 আজকের সারাংশ
          </Text>

          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 28 }}>🍼</Text>
              <Text style={{ fontSize: 22, fontWeight: 'bold', color: COLORS.feed, marginTop: 4 }}>
                {toBengaliNumber(todayFeed)}
              </Text>
              <Text style={{ fontSize: 12, color: COLORS.gray }}>দুধ</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 28 }}>😴</Text>
              <Text style={{ fontSize: 22, fontWeight: 'bold', color: COLORS.sleep, marginTop: 4 }}>
                {toBengaliNumber(todaySleep)}
              </Text>
              <Text style={{ fontSize: 12, color: COLORS.gray }}>ঘুম</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 28 }}>💩</Text>
              <Text style={{ fontSize: 22, fontWeight: 'bold', color: COLORS.diaper, marginTop: 4 }}>
                {toBengaliNumber(todayDiaper)}
              </Text>
              <Text style={{ fontSize: 12, color: COLORS.gray }}>ডায়াপার</Text>
            </View>
            {ageInfo.ageMonths >= 6 && (
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 28 }}>🍚</Text>
                <Text style={{ fontSize: 22, fontWeight: 'bold', color: COLORS.food, marginTop: 4 }}>
                  {toBengaliNumber(todayFood)}
                </Text>
                <Text style={{ fontSize: 12, color: COLORS.gray }}>খাবার</Text>
              </View>
            )}
          </View>
        </View>

        {/* FEATURE CARDS */}
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: COLORS.dark, marginBottom: 16 }}>
          ফিচার
        </Text>

        {/* DAILY LOG */}
        <TouchableOpacity
          onPress={() => navigation.navigate('DailyLog')}
          activeOpacity={0.8}
          style={{
            backgroundColor: COLORS.cardBg,
            borderRadius: 16,
            padding: 20,
            marginBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 4,
            elevation: 3
          }}
        >
          <Text style={{ fontSize: 36, marginRight: 16 }}>📊</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.dark, marginBottom: 4 }}>
              দৈনিক লগ
            </Text>
            <Text style={{ fontSize: 14, color: COLORS.gray }}>
              আজ: 🍼 {toBengaliNumber(todayFeed)} • 😴 {toBengaliNumber(todaySleep)} • 💩 {toBengaliNumber(todayDiaper)}
            </Text>
          </View>
          <Text style={{ fontSize: 20, color: COLORS.primary }}>→</Text>
        </TouchableOpacity>

        {/* VACCINE */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Vaccine')}
          activeOpacity={0.8}
          style={{
            backgroundColor: COLORS.cardBg,
            borderRadius: 16,
            padding: 20,
            marginBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 4,
            elevation: 3
          }}
        >
          <Text style={{ fontSize: 36, marginRight: 16 }}>💉</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.dark, marginBottom: 4 }}>
              টিকা ট্র্যাকার
            </Text>
            <Text style={{ fontSize: 14, color: COLORS.gray }}>
              EPI সূচি ও কেন্দ্র
            </Text>
          </View>
          <Text style={{ fontSize: 20, color: COLORS.vaccine }}>→</Text>
        </TouchableOpacity>

        {/* GROWTH */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Growth')}
          activeOpacity={0.8}
          style={{
            backgroundColor: COLORS.cardBg,
            borderRadius: 16,
            padding: 20,
            marginBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 4,
            elevation: 3
          }}
        >
          <Text style={{ fontSize: 36, marginRight: 16 }}>📈</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.dark, marginBottom: 4 }}>
              বৃদ্ধি চার্ট
            </Text>
            <Text style={{ fontSize: 14, color: COLORS.gray }}>
              ওজন ও উচ্চতা ট্র্যাকিং
            </Text>
          </View>
          <Text style={{ fontSize: 20, color: COLORS.growth }}>→</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}