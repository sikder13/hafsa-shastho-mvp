/**
 * Hafsa Sastho (হাফসা স্বাস্থ্য)
 * Bangladesh's First AI Companion for Postpartum and Early Childhood Care
 * Copyright © 2026 Nahl Technologies Inc. All rights reserved.
 *
 * @author Udaay Sikder — Co-Founder & Dev
 */
// services/voiceService.js
// Voice input service for Bengali speech-to-text
// Uses expo-speech-recognition with device-native Bengali (bn-BD) engine
//
// Architecture:
//   Mother speaks → device STT engine → Bengali text → input field → mother reviews → send
//   The text ALWAYS appears in input field before sending — mother can edit/correct
//
// Banglish handling: Device native engines handle common English loanwords
//   (diaper, fever, formula, bottle) reasonably well in bn-BD mode.
//   Post-beta: evaluate MediBeng Whisper for better code-switching accuracy.
//
// Safe import: Works in both Expo Go (graceful fallback) and dev builds (full functionality)

import { useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';

// Safely import native module — won't exist in Expo Go
let ExpoSpeechRecognitionModule = null;
let useSpeechRecognitionEvent = (_event, _handler) => {};

try {
  const speechModule = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = speechModule.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = speechModule.useSpeechRecognitionEvent;
} catch (e) {
  console.log('expo-speech-recognition not available (Expo Go)');
}

// Bengali locale for Bangladesh
const BENGALI_LOCALE = 'bn-BD';

// Max voice recording duration (exported for ChatScreen countdown UI)
export const VOICE_MAX_SECONDS = 30;

// Fallback locale if Bengali BD not available on device
const FALLBACK_LOCALE = 'bn-IN';

/**
 * Request microphone and speech recognition permissions
 * @returns {Promise<boolean>} true if all permissions granted
 */
export async function requestVoicePermissions() {
  if (!ExpoSpeechRecognitionModule) return false;

  try {
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (result.granted) {
      return true;
    }

    Alert.alert(
      'মাইক্রোফোন দরকার',
      'হাফসা আপার সাথে কথা বলতে মাইক্রোফোন ও স্পিচ রিকগনিশন চালু করুন। সেটিংসে গিয়ে অনুমতি দিন।',
      [{ text: 'ঠিক আছে' }]
    );
    return false;
  } catch (error) {
    console.error('Voice permission error:', error);
    return false;
  }
}

/**
 * Custom hook for voice input in ChatScreen
 * Returns state and controls for the voice recording UI
 *
 * Safe for Expo Go — returns isAvailable: false when native module missing
 */
export function useVoiceInput() {
  const [isListening, setIsListening] = useState(false);
  const [partialText, setPartialText] = useState('');
  const [finalText, setFinalText] = useState('');
  const [error, setError] = useState(null);
  const [isAvailable, setIsAvailable] = useState(!!ExpoSpeechRecognitionModule);
  const timeoutRef = useRef(null);

  // Handle real-time partial results — text appears as mother speaks
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript || '';

    if (event.isFinal) {
      // Clear auto-stop timeout
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }

      // Final result — confirmed transcription (with character limit)
      const MAX_CHARS = 500;
      if (transcript.length > MAX_CHARS) {
        setFinalText(transcript.substring(0, MAX_CHARS));
        console.log('🎙️ Voice text truncated from', transcript.length, 'to', MAX_CHARS, 'chars');
      } else {
        setFinalText(transcript);
      }
      setPartialText('');
      setIsListening(false);
    } else {
      // Partial result — still speaking, show live preview
      setPartialText(transcript);
    }
  });

  // Handle errors
  useSpeechRecognitionEvent('error', (event) => {
    console.log('Speech recognition error:', event.error, event.message);

    if (event.error === 'no-speech') {
      setError('কিছু শোনা যায়নি। আবার চেষ্টা করুন।');
    } else if (event.error === 'network') {
      setError('ইন্টারনেট সংযোগ দরকার।');
    } else if (event.error === 'not-allowed') {
      setError('মাইক্রোফোন অনুমতি দিন।');
    } else {
      setError('কিছু সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    }

    setIsListening(false);
    setPartialText('');
  });

  // Handle end of speech recognition
  useSpeechRecognitionEvent('end', () => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    setIsListening(false);
  });

  /**
   * Start listening for Bengali speech
   */
  const startListening = useCallback(async () => {
    try {
      setError(null);
      setPartialText('');
      setFinalText('');

      // Guard: native module not available (Expo Go)
      if (!ExpoSpeechRecognitionModule) {
        setError('ভয়েস ইনপুট এখনো চালু হয়নি। শীঘ্রই আসছে!');
        return;
      }

      // Request permissions
      const hasPermission = await requestVoicePermissions();
      if (!hasPermission) return;

      // Start speech recognition with Bengali BD locale
      await ExpoSpeechRecognitionModule.start({
        lang: BENGALI_LOCALE,
        interimResults: true,        // Show partial results as mother speaks
        continuous: false,            // Stop after one utterance
        maxAlternatives: 1,
        // Android-specific: prefer Google's cloud STT for better Bengali
        androidIntentOptions: {
          EXTRA_LANGUAGE_MODEL: 'LANGUAGE_MODEL_FREE_FORM',
        },
      });

      setIsListening(true);

      // Auto-stop after 30 seconds to prevent long recordings
      timeoutRef.current = setTimeout(() => {
        if (ExpoSpeechRecognitionModule) {
          try { ExpoSpeechRecognitionModule.stop(); } catch (e) {}
        }
        setIsListening(false);
      }, VOICE_MAX_SECONDS * 1000);
    } catch (err) {
      console.error('Start listening error:', err);

      // If Bengali BD not available, try Indian Bengali as fallback
      try {
        await ExpoSpeechRecognitionModule.start({
          lang: FALLBACK_LOCALE,
          interimResults: true,
          continuous: false,
          maxAlternatives: 1,
        });
        setIsListening(true);

        // Auto-stop after 30 seconds to prevent long recordings
        timeoutRef.current = setTimeout(() => {
          if (ExpoSpeechRecognitionModule) {
            try { ExpoSpeechRecognitionModule.stop(); } catch (e) {}
          }
          setIsListening(false);
        }, VOICE_MAX_SECONDS * 1000);
      } catch (fallbackErr) {
        console.error('Fallback locale also failed:', fallbackErr);
        setError('এই ডিভাইসে বাংলা ভয়েস সাপোর্ট নেই।');
        setIsAvailable(false);
      }
    }
  }, []);

  /**
   * Stop listening and get final result
   */
  const stopListening = useCallback(async () => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    try {
      if (ExpoSpeechRecognitionModule) await ExpoSpeechRecognitionModule.stop();
    } catch (err) {
      console.log('Stop error:', err);
    }
    setIsListening(false);
  }, []);

  /**
   * Cancel listening without using result
   */
  const cancelListening = useCallback(async () => {
    try {
      if (ExpoSpeechRecognitionModule) await ExpoSpeechRecognitionModule.abort();
    } catch (err) {
      console.log('Cancel error:', err);
    }
    setIsListening(false);
    setPartialText('');
    setFinalText('');
    setError(null);
  }, []);

  return {
    isListening,
    partialText,      // Live text while speaking
    finalText,         // Confirmed text after stopping
    startListening,
    stopListening,
    cancelListening,
    isAvailable,
    error,
  };
}