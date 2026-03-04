import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { calculatePercentile } from '../data/whoGrowthStandards';
import { toBengaliNumber, calculateAgeInMonths, formatDateBengali } from '../utils/helpers';
import { COLORS, STORAGE_KEYS, TEXT } from '../utils/constants';

export default function GrowthScreen({ baby, onBack }) {
  const [measurements, setMeasurements] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');

  useEffect(() => {
    loadMeasurements();
    
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
    
    setWeight('');
    setHeight('');
    setShowAddForm(false);
    Alert.alert('সফল!', 'পরিমাপ সংরক্ষিত হয়েছে');
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

  // Simple growth chart
  const renderSimpleChart = () => {
    if (measurements.length === 0) return null;
    
    const last5 = measurements.slice(0, 5).reverse();
    if (last5.length < 2) return null;
    
    const weights = last5.map(m => m.weight);
    const maxWeight = Math.max(...weights);
    const minWeight = Math.min(...weights);
    const range = maxWeight - minWeight || 1;
    
    return (
      <View style={{
        backgroundColor: COLORS.cardBg,
        padding: 20,
        borderRadius: 12,
        marginBottom: 20
      }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
          📈 বৃদ্ধির গ্রাফ
        </Text>
        
        {last5.map((m, i) => {
          const barHeight = ((m.weight - minWeight) / range) * 100;
          const percentile = calculatePercentile(m.ageMonths, m.weight);
          
          return (
            <View key={m.id} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 4 }}>
                <Text style={{ fontSize: 11, width: 70, color: COLORS.gray }}>
                  {formatDateBengali(m.date)}
                </Text>
                
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end' }}>
                  <View style={{
                    width: `${Math.max(barHeight, 10)}%`,
                    height: 32,
                    backgroundColor: percentile?.color || '#BDBDBD',
                    borderRadius: 4,
                    justifyContent: 'center',
                    paddingLeft: 8
                  }}>
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: 'white' }}>
                      {toBengaliNumber(m.weight.toFixed(1))} kg
                    </Text>
                  </View>
                </View>
              </View>
              
              {percentile && (
                <Text style={{ fontSize: 11, color: percentile.color, marginLeft: 70 }}>
                  {getStatusText(percentile.status)}
                </Text>
              )}
            </View>
          );
        })}
        
        {/* Legend */}
        <View style={{
          marginTop: 16,
          paddingTop: 16,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          flexDirection: 'row',
          justifyContent: 'space-around'
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 12, height: 12, backgroundColor: COLORS.danger, borderRadius: 2, marginRight: 6 }} />
            <Text style={{ fontSize: 11, color: COLORS.gray }}>কম</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 12, height: 12, backgroundColor: COLORS.success, borderRadius: 2, marginRight: 6 }} />
            <Text style={{ fontSize: 11, color: COLORS.gray }}>স্বাভাবিক</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 12, height: 12, backgroundColor: COLORS.warning, borderRadius: 2, marginRight: 6 }} />
            <Text style={{ fontSize: 11, color: COLORS.gray }}>সতর্ক</Text>
          </View>
        </View>
      </View>
    );
  };

  const currentMeasurement = measurements[0];
  const percentileData = currentMeasurement ? 
    calculatePercentile(currentMeasurement.ageMonths, currentMeasurement.weight) : null;

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
        {measurements.length > 0 && checkMilestone(measurements[0].weight) && (
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
            
            <TouchableOpacity
              onPress={() => Alert.alert('শেয়ার করুন', 'এই মাইলস্টোন পরিবারের সাথে শেয়ার করার ফিচার শীঘ্রই আসছে! 💚')}
              style={{
                marginTop: 16,
                backgroundColor: COLORS.primary,
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 8
              }}
            >
              <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
                📤 শেয়ার করুন
              </Text>
            </TouchableOpacity>
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

        {/* VISUAL CHART */}
        {renderSimpleChart()}

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
            const data = calculatePercentile(measurement.ageMonths, measurement.weight);
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