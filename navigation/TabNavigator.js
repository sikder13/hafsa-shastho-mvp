import React from 'react';
import { Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeScreen from '../screens/HomeScreen';
import BabyStack from './BabyStack';
import MotherStack from './MotherStack';
import ChatScreen from '../screens/ChatScreen';
import { useApp } from '../context/AppContext';

const Tab = createBottomTabNavigator();

function ChatScreenWrapper() {
  const { baby } = useApp();
  return <ChatScreen baby={baby} />;
}

function TabIcon({ emoji, showDot }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      {showDot && (
        <View style={{
          position: 'absolute',
          top: -2,
          right: -8,
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: '#E91E63',
        }} />
      )}
    </View>
  );
}

export default function TabNavigator() {
  const { todayMotherLog } = useApp();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          title: 'হোম',
          tabBarIcon: () => <TabIcon emoji="🏠" />,
        }}
      />
      <Tab.Screen
        name="BabyTab"
        component={BabyStack}
        options={{
          title: 'শিশু',
          tabBarIcon: () => <TabIcon emoji="👶" />,
        }}
      />
      <Tab.Screen
        name="MotherTab"
        component={MotherStack}
        options={{
          title: 'মা',
          tabBarIcon: () => <TabIcon emoji="🤱" showDot={!todayMotherLog} />,
        }}
      />
      <Tab.Screen
        name="HafsaTab"
        component={ChatScreenWrapper}
        options={{
          title: 'হাফসা',
          tabBarIcon: () => <TabIcon emoji="💚" />,
        }}
      />
    </Tab.Navigator>
  );
}