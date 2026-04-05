/**
 * Hafsa Sastho (হাফসা স্বাস্থ্য)
 * Bangladesh's First AI Companion for Postpartum and Early Childhood Care
 * Copyright © 2026 Nahl Technologies Inc. All rights reserved.
 *
 * @author Udaay Sikder — Co-Founder & Dev
 */
// components/LoadingScreen.js
// Warm loading screen with pulsing green heart — shown while data loads.

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';

export default function LoadingScreen() {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.3, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <View style={{
      flex: 1,
      backgroundColor: 'white',
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <Animated.Text style={{
        fontSize: 48,
        transform: [{ scale: pulse }],
        marginBottom: 16,
      }}>
        💚
      </Animated.Text>
      <Text style={{ fontSize: 16, color: '#999' }}>
        লোড হচ্ছে...
      </Text>
    </View>
  );
}
