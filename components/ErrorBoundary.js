/**
 * Hafsa Sastho (হাফসা স্বাস্থ্য)
 * Bangladesh's First AI Companion for Postpartum and Early Childhood Care
 * Copyright © 2026 Nahl Technologies Inc. All rights reserved.
 *
 * @author Udaay Sikder — Co-Founder & Dev
 */
// components/ErrorBoundary.js
// Catches JavaScript errors in child components and shows a friendly Bengali fallback UI.
// Must be a class component — React hooks do not support error boundaries.

import React, { Component } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Screen crash:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={{
          flex: 1,
          backgroundColor: '#FFF3E0',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 32,
        }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>😔</Text>

          <Text style={{
            fontSize: 22,
            fontWeight: 'bold',
            color: '#333',
            textAlign: 'center',
            marginBottom: 12,
          }}>
            কিছু সমস্যা হয়েছে
          </Text>

          <Text style={{
            fontSize: 15,
            color: '#666',
            textAlign: 'center',
            marginBottom: 32,
            lineHeight: 22,
          }}>
            চিন্তা করবেন না, আপনার ডেটা সুরক্ষিত আছে।
          </Text>

          <TouchableOpacity
            onPress={this.handleRetry}
            style={{
              backgroundColor: '#FF9800',
              paddingHorizontal: 32,
              paddingVertical: 14,
              borderRadius: 10,
              marginBottom: 12,
            }}
          >
            <Text style={{ color: 'white', fontSize: 17, fontWeight: 'bold' }}>
              🔄 আবার চেষ্টা করুন
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}
