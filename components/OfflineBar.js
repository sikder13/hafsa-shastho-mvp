// components/OfflineBar.js
// Small bar shown when there's no internet. Auto-hides when connection returns.

import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

export default function OfflineBar() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  if (!isOffline) return null;

  return (
    <View style={{
      width: '100%',
      height: 36,
      backgroundColor: '#FFF3E0',
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <Text style={{ fontSize: 12, color: '#E65100', textAlign: 'center' }}>
        📡 ইন্টারনেট নেই — হাফসা আপা এখন উত্তর দিতে পারবে না
      </Text>
    </View>
  );
}

// Hook for other components to check connectivity
export function useIsOffline() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  return isOffline;
}
