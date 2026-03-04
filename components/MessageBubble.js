// components/MessageBubble.js
// Reusable message bubble component

import React from 'react';
import { View, Text } from 'react-native';
import { formatTimeBengali } from '../utils/helpers';
import { COLORS } from '../utils/constants';

export default function MessageBubble({ message, isUser }) {
  return (
    <View
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        backgroundColor: isUser ? COLORS.userBubble : COLORS.aiBubble,
        padding: 12,
        paddingHorizontal: 16,
        borderRadius: 16,
        marginBottom: 12,
        maxWidth: '80%',
        borderWidth: isUser ? 0 : 1,
        borderColor: COLORS.aiBorder,
        shadowColor: isUser ? 'transparent' : '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1
      }}
    >
      {!isUser && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Text style={{ fontSize: 16, marginRight: 6 }}>💚</Text>
          <Text style={{ fontSize: 13, color: COLORS.primary, fontWeight: 'bold' }}>
            হাফসা আপা
          </Text>
        </View>
      )}
      
      <Text 
        style={{ 
          fontSize: 16, 
          color: isUser ? 'white' : COLORS.dark,
          lineHeight: 22
        }}
      >
        {message.content}
      </Text>
      
      <Text 
        style={{ 
          fontSize: 11, 
          color: isUser ? 'rgba(255,255,255,0.7)' : COLORS.lightGray,
          marginTop: 6,
          textAlign: 'right'
        }}
      >
        {formatTimeBengali(message.timestamp)}
      </Text>
      
      {message.autoLogged && (
        <View style={{
          marginTop: 8,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: isUser ? 'rgba(255,255,255,0.3)' : COLORS.border
        }}>
          <Text style={{ 
            fontSize: 12, 
            color: isUser ? 'rgba(255,255,255,0.9)' : COLORS.primary,
            fontStyle: 'italic'
          }}>
            {message.autoLogMessage}
          </Text>
        </View>
      )}
    </View>
  );
}