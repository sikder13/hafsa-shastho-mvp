// components/MessageBubble.js
// Reusable message bubble component

import React from 'react';
import { View, Text } from 'react-native';

export default function MessageBubble({ message, isUser }) {
  return (
    <View
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        backgroundColor: isUser ? '#4CAF50' : 'white',
        padding: 12,
        paddingHorizontal: 16,
        borderRadius: 16,
        marginBottom: 12,
        maxWidth: '80%',
        borderWidth: isUser ? 0 : 1,
        borderColor: '#E0E0E0',
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
          <Text style={{ fontSize: 13, color: '#4CAF50', fontWeight: 'bold' }}>
            হাফসা আপা
          </Text>
        </View>
      )}
      
      <Text 
        style={{ 
          fontSize: 16, 
          color: isUser ? 'white' : '#212121',
          lineHeight: 22
        }}
      >
        {message.content}
      </Text>
      
      <Text 
        style={{ 
          fontSize: 11, 
          color: isUser ? 'rgba(255,255,255,0.7)' : '#999',
          marginTop: 6,
          textAlign: 'right'
        }}
      >
        {formatTime(message.timestamp)}
      </Text>
      
      {message.autoLogged && (
        <View style={{
          marginTop: 8,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: isUser ? 'rgba(255,255,255,0.3)' : '#E0E0E0'
        }}>
          <Text style={{ 
            fontSize: 12, 
            color: isUser ? 'rgba(255,255,255,0.9)' : '#4CAF50',
            fontStyle: 'italic'
          }}>
            {message.autoLogMessage}
          </Text>
        </View>
      )}
    </View>
  );
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  
  return `${toBengaliNumber(hours)}:${toBengaliNumber(minutes.toString().padStart(2, '0'))}`;
}

function toBengaliNumber(num) {
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).split('').map(d => bengaliDigits[parseInt(d)] || d).join('');
}
