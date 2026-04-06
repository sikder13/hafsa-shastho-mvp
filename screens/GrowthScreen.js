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
  TextInput,
  Alert,
  Dimensions,
  Share
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, Circle, Line, Text as SvgText, G } from 'react-native-svg';
import dayjs from 'dayjs';
import { calculatePercentile, WHO_WEIGHT_BOYS, WHO_WEIGHT_GIRLS } from '../data/whoGrowthStandards';
import { toBengaliNumber, calculateAgeInMonths, formatDateBengali } from '../utils/helpers';
import { COLORS, STORAGE_KEYS, TEXT } from '../utils/constants';
import { syncGrowthRecord } from '../services/supabaseService';
import { getGrowthInsight } from '../services/intelligenceService';

export default function GrowthScreen({ baby, onBack }) {
  const [measurements, setMeasurements] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [milestoneAcknowledged, setMilestoneAcknowledged] = useState({});

  useEffect(() => {
    loadMeasurements();

    // Load acknowledged milestones
    const loadAcknowledged = async () => {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const milestoneKeys = keys.filter(k => k.startsWith('growth_milestone_'));
        const acked = {};
        for (const k of milestoneKeys) {
          const kg = k.replace('growth_milestone_', '');
          acked[kg] = true;
        }
        setMilestoneAcknowledged(acked);
      } catch (e) {
        // Ignore
      }
    };
    loadAcknowledged();

    // One-time migration
    const migrate = async () => {
      try {
        await AsyncStorage.removeItem('growth_measurements');
      } catch (error) {
        // Ignore
      }
    };
    migrate();
  }, [baby.id]);

  const loadMeasurements = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.growthMeasurements(baby.id));
      if (saved) {
        setMeasurements(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading measurements:', error);
    }
  };

  

  const saveMeasurements = async (newMeasurements) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.growthMeasurements(baby.id), JSON.stringify(newMeasurements));
    } catch (error) {
      console.error('Error saving measurements:', error);
    }
  };

  // Intelligence feedback state
  const [growthFeedback, setGrowthFeedback] = useState(null);

  const handleAddMeasurement = () => {
    if (!weight || !height) {
      Alert.alert('ত্রুটি', 'ওজন এবং উচ্চতা দিন');
      return;
    }

    const weightNum = parseFloat(weight);
    const heightNum = parseFloat(height);

    if (isNaN(weightNum) || isNaN(heightNum)) {
      Alert.alert('ত্রুটি', 'সঠিক সংখ্যা দিন');
      return;
    }

    const newMeasurement = {
      id: Date.now(),
      weight: weightNum,
      height: heightNum,
      date: new Date().toISOString(),
      ageMonths: calculateAgeInMonths(baby.birth_date)
    };

    const updated = [newMeasurement, ...measurements];
    setMeasurements(updated);
    saveMeasurements(updated);

    // Sync to Supabase
    syncGrowthRecord(newMeasurement, baby.id).catch(e => console.log('Growth sync:', e.message));
    
    // Get intelligent feedback from rules engine
    const feedback = getGrowthInsight(updated, calculateAgeInMonths(baby.birth_date), baby.gender);
    setGrowthFeedback(feedback);

    setWeight('');
    setHeight('');
    setShowAddForm(false);
  };

  const getStatusText = (status) => {
    return TEXT.growthStatus[status] || 'অজানা';
  };

  // Check if baby hit a milestone weight
  const checkMilestone = (currentWeight) => {
    const milestones = [4, 5, 6, 7, 8, 9, 10]; // kg
    
    if (measurements.length < 2) return null;
    
    const previousWeight = measurements[1].weight;
    
    const crossedMilestone = milestones.find(m => 
      previousWeight < m && currentWeight >= m
    );
    
    return crossedMilestone;
  };

  // Calculate growth velocity (gain per month)
  const getGrowthVelocity = () => {
    if (measurements.length < 2) return null;
    
    const latest = measurements[0];
    const previous = measurements[1];
    
    const weightGain = latest.weight - previous.weight;
    const daysBetween = Math.floor(
      (new Date(latest.date) - new Date(previous.date)) / (1000 * 60 * 60 * 24)
    );
    
    if (daysBetween === 0) return null;
    
    const gramsPerMonth = (weightGain * 1000 / daysBetween) * 30;
    
    return {
      gain: weightGain,
      days: daysBetween,
      gramsPerMonth: Math.round(gramsPerMonth),
      isGood: gramsPerMonth >= 400
    };
  };

  // Predict next month's weight
  const predictNextWeight = () => {
    const velocity = getGrowthVelocity();
    if (!velocity || measurements.length === 0) return null;
    
    const currentWeight = measurements[0].weight;
    const predictedWeight = currentWeight + (velocity.gramsPerMonth / 1000);
    
    return predictedWeight;
  };

  // WHO percentile curve chart
  const renderWHOCurveChart = () => {
    if (!baby?.birth_date) return null;

    const whoData = baby.gender === 'female' ? WHO_WEIGHT_GIRLS : WHO_WEIGHT_BOYS;
    const currentAgeMonths = dayjs().diff(dayjs(baby.birth_date), 'month', true);
    const maxMonth = Math.min(24, Math.ceil(currentAgeMonths) + 2);
    const maxMonthClamped = Math.max(maxMonth, 6); // Show at least 6 months

    // Find max weight needed for Y-axis
    const maxWHOWeight = whoData[Math.min(maxMonthClamped, 24)]?.p97 || 15;
    const maxBabyWeight = measurements.length > 0 ? Math.max(...measurements.map(m => m.weight)) : 0;
    const yMax = Math.ceil(Math.max(maxWHOWeight, maxBabyWeight) + 2);
    const yMin = 0;

    // Chart layout
    const screenWidth = Dimensions.get('window').width;
    const chartPadding = 20;
    const leftMargin = 38;
    const rightMargin = 36;
    const topMargin = 12;
    const bottomMargin = 28;
    const totalWidth = screenWidth - chartPadding * 2;
    const totalHeight = 250;
    const chartWidth = totalWidth - leftMargin - rightMargin;
    const chartHeight = totalHeight - topMargin - bottomMargin;

    const toX = (month) => leftMargin + (month / maxMonthClamped) * chartWidth;
    const toY = (weight) => topMargin + chartHeight - ((weight - yMin) / (yMax - yMin)) * chartHeight;

    // Build SVG path from WHO data for a given percentile key
    const buildCurvePath = (pKey) => {
      let d = '';
      for (let m = 0; m <= Math.min(maxMonthClamped, 24); m++) {
        const val = whoData[m]?.[pKey];
        if (val === undefined) continue;
        const x = toX(m);
        const y = toY(val);
        d += d === '' ? `M${x},${y}` : ` L${x},${y}`;
      }
      return d;
    };

    // Build filled zone path between two percentile curves
    const buildZonePath = (lowerKey, upperKey) => {
      const limit = Math.min(maxMonthClamped, 24);
      let upper = '';
      let lower = '';
      for (let m = 0; m <= limit; m++) {
        const uVal = whoData[m]?.[upperKey];
        const lVal = whoData[m]?.[lowerKey];
        if (uVal === undefined || lVal === undefined) continue;
        const x = toX(m);
        upper += upper === '' ? `M${x},${toY(uVal)}` : ` L${x},${toY(uVal)}`;
        lower = `L${x},${toY(lVal)}` + (lower ? ' ' + lower : '');
      }
      // Close: first point of lower
      const firstLowerVal = whoData[0]?.[lowerKey];
      if (firstLowerVal === undefined) return '';
      lower = `L${toX(0)},${toY(firstLowerVal)} ` + lower;
      return upper + ' ' + lower + ' Z';
    };

    // Build zone below P3 (down to yMin)
    const buildBelowP3Zone = () => {
      const limit = Math.min(maxMonthClamped, 24);
      let upper = '';
      for (let m = 0; m <= limit; m++) {
        const val = whoData[m]?.p3;
        if (val === undefined) continue;
        const x = toX(m);
        upper += upper === '' ? `M${x},${toY(val)}` : ` L${x},${toY(val)}`;
      }
      // Close down to bottom
      upper += ` L${toX(limit)},${toY(yMin)} L${toX(0)},${toY(yMin)} Z`;
      return upper;
    };

    // Build zone above P97 (up to yMax)
    const buildAboveP97Zone = () => {
      const limit = Math.min(maxMonthClamped, 24);
      let lower = '';
      for (let m = 0; m <= limit; m++) {
        const val = whoData[m]?.p97;
        if (val === undefined) continue;
        const x = toX(m);
        lower += lower === '' ? `M${x},${toY(val)}` : ` L${x},${toY(val)}`;
      }
      lower += ` L${toX(limit)},${toY(yMax)} L${toX(0)},${toY(yMax)} Z`;
      return lower;
    };

    // Determine dot color based on which zone the weight falls in
    const getDotColor = (weight, ageMonths) => {
      const month = Math.min(24, Math.max(0, Math.round(ageMonths)));
      const std = whoData[month];
      if (!std) return '#9E9E9E';
      if (weight < std.p3 || weight >= std.p97) return '#F44336';
      if (weight < std.p15 || weight >= std.p85) return '#FF9800';
      return '#4CAF50';
    };

    // Baby measurement dots — compute positions
    const dots = measurements.map((m, i) => ({
      x: toX(m.ageMonths),
      y: toY(m.weight),
      color: getDotColor(m.weight, m.ageMonths),
      isLatest: i === 0,
      weight: m.weight,
      ageMonths: m.ageMonths,
    })).filter(d => d.x >= leftMargin && d.x <= leftMargin + chartWidth);

    // Trajectory line connecting dots (chronological order)
    const sortedDots = [...dots].sort((a, b) => a.ageMonths - b.ageMonths);
    let trajectoryPath = '';
    for (const d of sortedDots) {
      trajectoryPath += trajectoryPath === '' ? `M${d.x},${d.y}` : ` L${d.x},${d.y}`;
    }

    // Y-axis tick values
    const yTicks = [];
    for (let w = 0; w <= yMax; w += 2) {
      yTicks.push(w);
    }

    // X-axis tick values
    const xTickCandidates = [0, 3, 6, 9, 12, 18, 24];
    const xTicks = xTickCandidates.filter(m => m <= maxMonthClamped);

    return (
      <View style={{
        backgroundColor: COLORS.cardBg,
        padding: 12,
        borderRadius: 12,
        marginBottom: 20
      }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12, paddingHorizontal: 4 }}>
          📈 WHO বৃদ্ধি কার্ভ
        </Text>

        <Svg width={totalWidth} height={totalHeight}>
          {/* Filled zones */}
          <Path d={buildBelowP3Zone()} fill="rgba(244,67,54,0.1)" />
          <Path d={buildZonePath('p3', 'p15')} fill="rgba(255,152,0,0.1)" />
          <Path d={buildZonePath('p15', 'p85')} fill="rgba(76,175,80,0.15)" />
          <Path d={buildZonePath('p85', 'p97')} fill="rgba(255,152,0,0.1)" />
          <Path d={buildAboveP97Zone()} fill="rgba(244,67,54,0.1)" />

          {/* Y-axis grid lines */}
          {yTicks.map(w => (
            <Line
              key={`yg-${w}`}
              x1={leftMargin}
              y1={toY(w)}
              x2={leftMargin + chartWidth}
              y2={toY(w)}
              stroke="#E0E0E0"
              strokeWidth={0.5}
            />
          ))}

          {/* Percentile curves */}
          <Path d={buildCurvePath('p3')} stroke="#F44336" strokeWidth={1} fill="none" strokeDasharray="4,3" />
          <Path d={buildCurvePath('p15')} stroke="#FF9800" strokeWidth={1} fill="none" strokeDasharray="4,3" />
          <Path d={buildCurvePath('p50')} stroke="#4CAF50" strokeWidth={2} fill="none" />
          <Path d={buildCurvePath('p85')} stroke="#FF9800" strokeWidth={1} fill="none" strokeDasharray="4,3" />
          <Path d={buildCurvePath('p97')} stroke="#F44336" strokeWidth={1} fill="none" strokeDasharray="4,3" />

          {/* P50 label — "গড়" */}
          {(() => {
            const labelMonth = Math.min(Math.floor(maxMonthClamped * 0.7), 24);
            const p50Val = whoData[labelMonth]?.p50;
            if (!p50Val) return null;
            return (
              <SvgText
                x={toX(labelMonth) + 4}
                y={toY(p50Val) - 6}
                fill="#4CAF50"
                fontSize={10}
                fontWeight="bold"
              >
                গড়
              </SvgText>
            );
          })()}

          {/* Y-axis labels */}
          {yTicks.map(w => (
            <SvgText
              key={`yl-${w}`}
              x={leftMargin - 6}
              y={toY(w) + 4}
              fill="#757575"
              fontSize={10}
              textAnchor="end"
            >
              {toBengaliNumber(w)}
            </SvgText>
          ))}

          {/* Y-axis unit */}
          <SvgText
            x={4}
            y={toY(yMax / 2) + 4}
            fill="#9E9E9E"
            fontSize={9}
          >
            কেজি
          </SvgText>

          {/* X-axis labels */}
          {xTicks.map(m => (
            <SvgText
              key={`xl-${m}`}
              x={toX(m)}
              y={totalHeight - 4}
              fill="#757575"
              fontSize={10}
              textAnchor="middle"
            >
              {toBengaliNumber(m)}
            </SvgText>
          ))}

          {/* X-axis unit */}
          <SvgText
            x={leftMargin + chartWidth / 2}
            y={totalHeight}
            fill="#9E9E9E"
            fontSize={9}
            textAnchor="middle"
          >
            মাস
          </SvgText>

          {/* Zone labels on right edge */}
          {(() => {
            const edgeMonth = Math.min(maxMonthClamped, 24);
            const p3 = whoData[edgeMonth]?.p3 || 0;
            const p15 = whoData[edgeMonth]?.p15 || 0;
            const p50 = whoData[edgeMonth]?.p50 || 0;
            const p85 = whoData[edgeMonth]?.p85 || 0;
            const p97 = whoData[edgeMonth]?.p97 || 0;
            return (
              <G>
                <SvgText x={leftMargin + chartWidth + 4} y={toY((p3 + yMin) / 2) + 3} fill="#F44336" fontSize={9}>কম</SvgText>
                <SvgText x={leftMargin + chartWidth + 4} y={toY((p15 + p85) / 2) + 3} fill="#4CAF50" fontSize={9}>স্বাভাবিক</SvgText>
                <SvgText x={leftMargin + chartWidth + 4} y={toY((p97 + yMax) / 2) + 3} fill="#F44336" fontSize={9}>বেশি</SvgText>
              </G>
            );
          })()}

          {/* Baby trajectory line */}
          {sortedDots.length > 1 && (
            <Path d={trajectoryPath} stroke="#333" strokeWidth={1} fill="none" />
          )}

          {/* Baby measurement dots */}
          {dots.map((d, i) => (
            <G key={`dot-${i}`}>
              {d.isLatest && (
                <Circle cx={d.x} cy={d.y} r={10} fill="white" opacity={0.8} />
              )}
              <Circle
                cx={d.x}
                cy={d.y}
                r={d.isLatest ? 8 : 6}
                fill={d.color}
                stroke={d.isLatest ? 'white' : 'none'}
                strokeWidth={d.isLatest ? 2 : 0}
              />
            </G>
          ))}
        </Svg>

        {/* Legend */}
        <View style={{
          marginTop: 8,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          flexDirection: 'row',
          justifyContent: 'space-around'
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 12, height: 12, backgroundColor: '#F44336', borderRadius: 6, marginRight: 4 }} />
            <Text style={{ fontSize: 11, color: COLORS.gray }}>কম/বেশি</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 12, height: 12, backgroundColor: '#FF9800', borderRadius: 6, marginRight: 4 }} />
            <Text style={{ fontSize: 11, color: COLORS.gray }}>সতর্ক</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 12, height: 12, backgroundColor: '#4CAF50', borderRadius: 6, marginRight: 4 }} />
            <Text style={{ fontSize: 11, color: COLORS.gray }}>স্বাভাবিক</Text>
          </View>
        </View>
      </View>
    );
  };

  const currentMeasurement = measurements[0];
  const percentileData = currentMeasurement ? 
  calculatePercentile(currentMeasurement.ageMonths, currentMeasurement.weight, baby.gender) : null;

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
            📈 বৃদ্ধি চার্ট
          </Text>
          <Text style={{ fontSize: 16, color: COLORS.gray }}>
            ওজন ও উচ্চতা ট্র্যাকিং
          </Text>
        </View>

        {currentMeasurement && percentileData && (
          <View style={{
            backgroundColor: percentileData.color,
            padding: 20,
            borderRadius: 12,
            marginBottom: 20
          }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: 'white', marginBottom: 8 }}>
              বর্তমান অবস্থা: {getStatusText(percentileData.status)}
            </Text>
            <Text style={{ fontSize: 16, color: 'white' }}>
              ওজন: {toBengaliNumber(currentMeasurement.weight.toFixed(1))} কেজি
            </Text>
            <Text style={{ fontSize: 16, color: 'white', marginTop: 4 }}>
              উচ্চতা: {toBengaliNumber(currentMeasurement.height.toFixed(1))} সেমি
            </Text>
            <Text style={{ fontSize: 14, color: 'white', marginTop: 8 }}>
              WHO পার্সেন্টাইল: {percentileData.percentile}
            </Text>
          </View>
        )}

        {/* MILESTONE CELEBRATION */}
        {measurements.length > 0 && checkMilestone(measurements[0].weight) && !milestoneAcknowledged[String(checkMilestone(measurements[0].weight))] && (
          <View style={{
            backgroundColor: COLORS.primaryLight,
            padding: 24,
            borderRadius: 16,
            marginBottom: 20,
            borderWidth: 2,
            borderColor: COLORS.primary,
            alignItems: 'center'
          }}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>🎉</Text>
            
            <Text style={{ fontSize: 22, fontWeight: 'bold', color: COLORS.primaryDark, marginBottom: 8, textAlign: 'center' }}>
              বড় খবর!
            </Text>
            
            <Text style={{ fontSize: 20, color: COLORS.primaryDarker, marginBottom: 16, textAlign: 'center' }}>
              {baby.name} আজ {toBengaliNumber(checkMilestone(measurements[0].weight))} কেজি হয়েছে!
            </Text>
            
            <Text style={{ fontSize: 16, color: COLORS.primaryDark, marginBottom: 4, textAlign: 'center' }}>
              এই বয়সে {toBengaliNumber(checkMilestone(measurements[0].weight))} কেজি মানে:
            </Text>
            
            <View style={{ marginTop: 12, alignItems: 'flex-start', width: '100%', paddingHorizontal: 20 }}>
              <Text style={{ fontSize: 15, color: COLORS.primaryDark, marginBottom: 6 }}>
                ✅ স্বাভাবিক বৃদ্ধি
              </Text>
              <Text style={{ fontSize: 15, color: COLORS.primaryDark, marginBottom: 6 }}>
                ✅ পুষ্টি ঠিক আছে
              </Text>
              <Text style={{ fontSize: 15, color: COLORS.primaryDark, marginBottom: 6 }}>
                ✅ খাওয়া ভালো হচ্ছে
              </Text>
            </View>
            
            <View style={{ flexDirection: 'row', marginTop: 16, gap: 10 }}>
              <TouchableOpacity
                onPress={async () => {
                  const milestoneKg = checkMilestone(measurements[0].weight);
                  setMilestoneAcknowledged(prev => ({ ...prev, [String(milestoneKg)]: true }));
                  try {
                    await AsyncStorage.setItem('growth_milestone_' + milestoneKg, 'true');
                  } catch (e) {
                    console.log('Milestone ack error:', e.message);
                  }
                }}
                style={{
                  flex: 1,
                  backgroundColor: 'white',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: COLORS.primary,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: COLORS.primary, fontSize: 16, fontWeight: 'bold' }}>
                  ✓ দেখেছি
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    const milestoneKg = checkMilestone(measurements[0].weight);
                    const shareText = `👶 ${baby.name} আজ ${toBengaliNumber(milestoneKg)} কেজি হয়েছে! ✅ | হাফসা স্বাস্থ্য অ্যাপ দিয়ে ট্র্যাক করছি। ডাউনলোড করুন: https://nahltech.com/product/hafsa-sastho`;
                    await Share.share({ message: shareText });
                  } catch (e) {
                    console.log('Share error:', e.message);
                  }
                }}
                style={{
                  flex: 1,
                  backgroundColor: COLORS.primary,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 8,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
                  📤 শেয়ার করুন
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!showAddForm ? (
          <TouchableOpacity
            onPress={() => setShowAddForm(true)}
            style={{
              backgroundColor: COLORS.primary,
              padding: 16,
              borderRadius: 12,
              alignItems: 'center',
              marginBottom: 20
            }}
          >
            <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
              + পরিমাপ যোগ করুন
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={{
            backgroundColor: COLORS.cardBg,
            padding: 20,
            borderRadius: 12,
            marginBottom: 20
          }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
              নতুন পরিমাপ
            </Text>

            <Text style={{ fontSize: 16, marginBottom: 8 }}>ওজন (কেজি)</Text>
            <TextInput
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              placeholder="উদাহরণ: 5.2"
              style={{
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
                marginBottom: 16
              }}
            />

            <Text style={{ fontSize: 16, marginBottom: 8 }}>উচ্চতা (সেমি)</Text>
            <TextInput
              value={height}
              onChangeText={setHeight}
              keyboardType="decimal-pad"
              placeholder="উদাহরণ: 55"
              style={{
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
                marginBottom: 16
              }}
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={handleAddMeasurement}
                style={{
                  flex: 1,
                  backgroundColor: COLORS.primary,
                  padding: 14,
                  borderRadius: 8,
                  alignItems: 'center'
                }}
              >
                <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
                  {TEXT.messages.save}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setShowAddForm(false);
                  setWeight('');
                  setHeight('');
                }}
                style={{
                  flex: 1,
                  backgroundColor: COLORS.border,
                  padding: 14,
                  borderRadius: 8,
                  alignItems: 'center'
                }}
              >
                <Text style={{ color: COLORS.gray, fontSize: 16, fontWeight: 'bold' }}>
                  {TEXT.messages.cancel}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
 {/* INTELLIGENT GROWTH FEEDBACK — from rules engine */}
 {growthFeedback && (
          <View style={{
            backgroundColor: growthFeedback.feedbackType === 'healthy' ? '#E8F5E9'
              : growthFeedback.feedbackType === 'concern' ? '#FFEBEE'
              : growthFeedback.feedbackType === 'good_velocity' ? '#E8F5E9'
              : growthFeedback.feedbackType === 'slow_velocity' ? '#FFF3E0'
              : '#F1F8E9',
            borderRadius: 12, padding: 16, marginBottom: 20,
            borderLeftWidth: 4,
            borderLeftColor: growthFeedback.feedbackType === 'healthy' ? COLORS.success
              : growthFeedback.feedbackType === 'concern' ? COLORS.danger
              : growthFeedback.feedbackType === 'slow_velocity' ? COLORS.warning
              : COLORS.primary,
          }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8,
              color: growthFeedback.feedbackType === 'concern' ? COLORS.danger
                : growthFeedback.feedbackType === 'slow_velocity' ? COLORS.warning
                : COLORS.primaryDark }}>
              {growthFeedback.feedbackType === 'healthy' ? '✅ ওজন স্বাভাবিক!'
                : growthFeedback.feedbackType === 'concern' ? '⚠️ ওজন নিয়ে সতর্ক হন'
                : growthFeedback.feedbackType === 'good_velocity' ? '✅ বৃদ্ধির গতি ভালো!'
                : growthFeedback.feedbackType === 'slow_velocity' ? '⚠️ বৃদ্ধি একটু ধীর'
                : '📊 পরিমাপ সংরক্ষিত'}
            </Text>
            <Text style={{ fontSize: 14, color: COLORS.dark, lineHeight: 22 }}>
              {growthFeedback.feedbackType === 'healthy'
                ? `${baby.name} এর ওজন WHO মান অনুযায়ী স্বাভাবিক পরিসরে আছে। চালিয়ে যান! 💚`
                : growthFeedback.feedbackType === 'concern'
                ? `${baby.name} এর ওজন স্বাভাবিকের নিচে। পরবর্তী ডাক্তার ভিজিটে এটা জানান। খাওয়ানোর পরিমাণ বাড়ান।`
                : growthFeedback.feedbackType === 'good_velocity'
                ? `গত পরিমাপের চেয়ে ভালো বাড়ছে। প্রতি মাসে ${toBengaliNumber(growthFeedback.assessment?.velocity?.gramsPerMonth || 0)} গ্রাম বাড়ছে — দারুণ!`
                : growthFeedback.feedbackType === 'slow_velocity'
                ? `ওজন বৃদ্ধির হার কম (${toBengaliNumber(growthFeedback.assessment?.velocity?.gramsPerMonth || 0)} গ্রাম/মাস)। ৬ মাসের নিচে ৪০০+ গ্রাম/মাস দরকার। ডাক্তারকে জানান।`
                : 'পরিমাপ সফলভাবে সংরক্ষিত হয়েছে।'}
            </Text>
            {growthFeedback.milestone && (
              <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#C8E6C9' }}>
                <Text style={{ fontSize: 15, fontWeight: 'bold', color: COLORS.primaryDark }}>
                  🎉 {baby.name} {toBengaliNumber(growthFeedback.milestone)} কেজি হয়েছে!
                </Text>
              </View>
            )}
          </View>
        )}
        {/* WHO GROWTH CURVE */}
        {renderWHOCurveChart()}

        {/* GROWTH VELOCITY */}
        {(() => {
          const velocity = getGrowthVelocity();
          if (!velocity) return null;
          
          return (
            <View style={{
              backgroundColor: '#E3F2FD',
              padding: 20,
              borderRadius: 12,
              marginBottom: 20
            }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: '#1565C0' }}>
                📊 বৃদ্ধির গতি
              </Text>
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                <View>
                  <Text style={{ fontSize: 14, color: COLORS.gray, marginBottom: 4 }}>
                    গত {toBengaliNumber(velocity.days)} দিনে:
                  </Text>
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1976D2' }}>
                    +{toBengaliNumber(Math.round(velocity.gain * 1000))} গ্রাম
                  </Text>
                </View>
                
                <View>
                  <Text style={{ fontSize: 14, color: COLORS.gray, marginBottom: 4 }}>
                    প্রতি মাসে গড়:
                  </Text>
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: velocity.isGood ? COLORS.success : COLORS.warning }}>
                    {toBengaliNumber(velocity.gramsPerMonth)} গ্রাম
                  </Text>
                </View>
              </View>
              
              <View style={{
                marginTop: 12,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: '#BBDEFB'
              }}>
                <Text style={{ fontSize: 15, color: '#1976D2', marginBottom: 8 }}>
                  {velocity.isGood ? '✅' : '⚠️'} {velocity.isGood ? 'দারুণ গতি!' : 'একটু ধীরে'}
                </Text>
                
                {predictNextWeight() && (
                  <Text style={{ fontSize: 14, color: COLORS.gray }}>
                    এই গতিতে চললে পরের মাসে হবে: {toBengaliNumber(predictNextWeight().toFixed(1))} কেজি
                  </Text>
                )}
              </View>
            </View>
          );
        })()}

        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>
            পরিমাপের ইতিহাস
          </Text>
        </View>

        {measurements.length === 0 ? (
          <View style={{
            backgroundColor: COLORS.cardBg,
            padding: 24,
            borderRadius: 12,
            alignItems: 'center'
          }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>📊</Text>
            <Text style={{ fontSize: 16, color: COLORS.gray, textAlign: 'center' }}>
              এখনো কোনো পরিমাপ যোগ করা হয়নি।
            </Text>
            <Text style={{ fontSize: 14, color: COLORS.lightGray, marginTop: 8, textAlign: 'center' }}>
              শিশুর ওজন ও উচ্চতা পরিমাপ করে যোগ করুন।
            </Text>
          </View>
        ) : (
          measurements.map((measurement) => {
            const data = calculatePercentile(measurement.ageMonths, measurement.weight, baby.gender);
            return (
              <View
                key={measurement.id}
                style={{
                  backgroundColor: COLORS.cardBg,
                  padding: 16,
                  borderRadius: 12,
                  marginBottom: 12,
                  borderLeftWidth: 4,
                  borderLeftColor: data?.color || '#BDBDBD'
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ fontSize: 16, fontWeight: 'bold' }}>
                    {formatDateBengali(measurement.date)}
                  </Text>
                  <Text style={{ fontSize: 14, color: COLORS.gray }}>
                    বয়স: {toBengaliNumber(measurement.ageMonths)} মাস
                  </Text>
                </View>
                <Text style={{ fontSize: 15, color: COLORS.gray }}>
                  ওজন: {toBengaliNumber(measurement.weight.toFixed(1))} কেজি | 
                  উচ্চতা: {toBengaliNumber(measurement.height.toFixed(1))} সেমি
                </Text>
                {data && (
                  <Text style={{ fontSize: 14, color: data.color, marginTop: 4, fontWeight: 'bold' }}>
                    {getStatusText(data.status)}
                  </Text>
                )}
              </View>
            );
          })
        )}

        <View style={{
          backgroundColor: COLORS.primaryLight,
          padding: 16,
          borderRadius: 12,
          marginTop: 16
        }}>
          <Text style={{ fontSize: 14, color: COLORS.primaryDark }}>
            💡 টিপস: প্রতি মাসে একবার ওজন ও উচ্চতা মাপুন। 
            WHO মান অনুযায়ী স্বাভাবিক বৃদ্ধি নিশ্চিত করুন।
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}