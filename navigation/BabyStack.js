// navigation/BabyStack.js
// Stack navigator for baby tab: BabyHub → DailyLog, Vaccine, Growth

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useApp } from '../context/AppContext';

import BabyHubScreen from '../screens/BabyHubScreen';
import DailyLogScreen from '../screens/DailyLogScreen';
import VaccineScreen from '../screens/VaccineScreen';
import GrowthScreen from '../screens/GrowthScreen';

const Stack = createNativeStackNavigator();

export default function BabyStack() {
  const { baby } = useApp();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BabyHub">
        {(props) => <BabyHubScreen {...props} baby={baby} />}
      </Stack.Screen>
      <Stack.Screen name="DailyLog">
        {(props) => <DailyLogScreen {...props} baby={baby} onBack={() => props.navigation.goBack()} />}
      </Stack.Screen>
      <Stack.Screen name="Vaccine">
        {(props) => <VaccineScreen {...props} baby={baby} onBack={() => props.navigation.goBack()} />}
      </Stack.Screen>
      <Stack.Screen name="Growth">
        {(props) => <GrowthScreen {...props} baby={baby} onBack={() => props.navigation.goBack()} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}