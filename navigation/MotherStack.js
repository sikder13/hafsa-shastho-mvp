// navigation/MotherStack.js
// Stack navigator for mother tab: MotherCheckIn → Edinburgh Scale

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

import MotherCheckInScreen from '../screens/MotherCheckInScreen';
import EdinburghScaleScreen from '../screens/EdinburghScaleScreen';

const Stack = createNativeStackNavigator();

export default function MotherStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MotherCheckIn">
        {(props) => (
          <MotherCheckInWrapper navigation={props.navigation} />
        )}
      </Stack.Screen>
      <Stack.Screen name="Edinburgh">
        {(props) => (
          <EdinburghScaleScreen
            {...props}
            onBack={() => props.navigation.goBack()}
            onComplete={() => props.navigation.goBack()}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function MotherCheckInWrapper({ navigation }) {
  const parentNav = useNavigation();

  return (
    <MotherCheckInScreen
      onBack={() => parentNav.navigate('HomeTab')}
      onNavigateEPDS={() => navigation.navigate('Edinburgh')}
    />
  );
}