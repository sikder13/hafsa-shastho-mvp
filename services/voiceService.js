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

import {
    ExpoSpeechRecognitionModule,
    useSpeechRecognitionEvent,
  } from 'expo-speech-recognition';
  import { useState, useCallback, useRef, useEffect } from 'react';
  import { Alert } from 'react-native';
  
  // Bengali locale for Bangladesh
  const BENGALI_LOCALE = 'bn-BD';
  
  // Fallback locale if Bengali not available
  const FALLBACK_LOCALE = 'bn-IN';
  
  /**
   * Request microphone and speech recognition permissions
   * @returns {Promise<boolean>} true if all permissions granted
   */
  export async function requestVoicePermissions() {
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
   */
  export function useVoiceInput() {
    const [isListening, setIsListening] = useState(false);
    const [partialText, setPartialText] = useState('');
    const [finalText, setFinalText] = useState('');
    const [error, setError] = useState(null);
    const [isAvailable, setIsAvailable] = useState(true);
  
    // Handle real-time partial results — text appears as mother speaks
    useSpeechRecognitionEvent('result', (event) => {
      const transcript = event.results[0]?.transcript || '';
  
      if (event.isFinal) {
        setFinalText(transcript);
        setPartialText('');
        setIsListening(false);
      } else {
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
  
        const hasPermission = await requestVoicePermissions();
        if (!hasPermission) return;
  
        await ExpoSpeechRecognitionModule.start({
          lang: BENGALI_LOCALE,
          interimResults: true,
          continuous: false,
          maxAlternatives: 1,
          androidIntentOptions: {
            EXTRA_LANGUAGE_MODEL: 'LANGUAGE_MODEL_FREE_FORM',
          },
        });
  
        setIsListening(true);
      } catch (err) {
        console.error('Start listening error:', err);
  
        // If Bengali BD not available, try Indian Bengali
        try {
          await ExpoSpeechRecognitionModule.start({
            lang: FALLBACK_LOCALE,
            interimResults: true,
            continuous: false,
            maxAlternatives: 1,
          });
          setIsListening(true);
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
      try {
        await ExpoSpeechRecognitionModule.stop();
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
        await ExpoSpeechRecognitionModule.abort();
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
      partialText,
      finalText,
      startListening,
      stopListening,
      cancelListening,
      isAvailable,
      error,
    };
  }