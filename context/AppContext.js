// context/AppContext.js
// Global state provider — the single brain of the app
// All screens read from and write to this context
// Data flows: AsyncStorage ←→ AppContext ←→ Screens

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../utils/constants';
import { safeJSONParse } from '../utils/helpers';
import {
    syncProfile, syncBaby, syncDailyLog, syncMotherLog,
    syncGrowthRecord, syncVaccineRecord, syncAIInteraction,
    processSyncQueue, getCurrentUserId, hydrateFromCloud
  } from '../services/supabaseService';

// Create the context
const AppContext = createContext(null);

// Custom hook — every screen uses this to access global state
// Usage: const { baby, logs, addLog } = useApp();
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

// The provider component that wraps the entire app
export function AppProvider({ children }) {

  // ============================================================
  // STATE
  // ============================================================

  // User & profiles
  const [user, setUser] = useState(null);
  const [baby, setBaby] = useState(null);
  const [motherProfile, setMotherProfile] = useState(null);

  // Baby daily logs
  const [logs, setLogs] = useState({
    feed: [],
    sleep: [],
    diaper: [],
    food: []
  });

  // Mother daily log (today's entry)
  const [todayMotherLog, setTodayMotherLog] = useState(null);

  // Mother log history (last 30 days for pattern detection)
  const [motherLogHistory, setMotherLogHistory] = useState([]);

  // Vaccine status
  const [vaccineStatus, setVaccineStatus] = useState({});

  // Growth measurements
  const [growthMeasurements, setGrowthMeasurements] = useState([]);

  // App state
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [settings, setSettings] = useState({
    language: 'bn',
    notifications: {
      vaccine: true,
      daily: true,
      mood: true,
      milestone: true,
      evening: true
    }
  });

  // ============================================================
  // INITIALIZATION — Load everything from AsyncStorage on app start
  // ============================================================

  useEffect(() => {
    loadAllData();
    // Try processing queued syncs on app start
    processSyncQueue().catch(e => console.log('Queue process error:', e));
  }, []);
// Reset todayMotherLog when date changes (midnight reset)
useEffect(() => {
    const checkDateInterval = setInterval(() => {
      const today = new Date().toISOString().split('T')[0];
      if (todayMotherLog && todayMotherLog.date !== today) {
        console.log('📅 New day detected — resetting today\'s mother log');
        setTodayMotherLog(null);
      }
    }, 60000); // Check every minute

    return () => clearInterval(checkDateInterval);
  }, [todayMotherLog]);
  // Reload baby-specific data when baby profile changes
  useEffect(() => {
    if (baby?.id) {
      loadBabyData(baby.id);
    }
  }, [baby?.id]);

  const loadAllData = async () => {
    try {
      // Load profiles
      const [savedBaby, savedMother, savedSettings] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.babyProfile),
        AsyncStorage.getItem(STORAGE_KEYS.motherProfile),
        AsyncStorage.getItem(STORAGE_KEYS.userSettings),
      ]);

      const babyData = safeJSONParse(savedBaby, null);
      const motherData = safeJSONParse(savedMother, null);
      const settingsData = safeJSONParse(savedSettings, null);

      if (babyData) setBaby(babyData);
      if (motherData) setMotherProfile(motherData);
      if (settingsData) setSettings(prev => ({ ...prev, ...settingsData }));

      // Load baby-specific data if baby exists
      if (babyData?.id) {
        await loadBabyData(babyData.id);
      }

      // Load mother's today log (only if date matches today)
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const savedMotherLog = await AsyncStorage.getItem(STORAGE_KEYS.motherLog(today));
      const parsedMotherLog = safeJSONParse(savedMotherLog, null);
      if (parsedMotherLog && parsedMotherLog.date === today) {
        setTodayMotherLog(parsedMotherLog);
      } else {
        setTodayMotherLog(null); // New day — no check-in yet
      }

      // Load mother log history
      const savedHistory = await AsyncStorage.getItem(STORAGE_KEYS.motherLogsHistory);
      if (savedHistory) {
        setMotherLogHistory(safeJSONParse(savedHistory, []));
      }

    } catch (error) {
      console.error('Error loading app data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBabyData = async (babyId) => {
    try {
      const [savedLogs, savedVaccines, savedGrowth] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.dailyLogs(babyId)),
        AsyncStorage.getItem(STORAGE_KEYS.vaccineStatus(babyId)),
        AsyncStorage.getItem(STORAGE_KEYS.growthMeasurements(babyId)),
      ]);

      setLogs(safeJSONParse(savedLogs, { feed: [], sleep: [], diaper: [], food: [] }));
      setVaccineStatus(safeJSONParse(savedVaccines, {}));
      setGrowthMeasurements(safeJSONParse(savedGrowth, []));

    } catch (error) {
      console.error('Error loading baby data:', error);
    }
  };

  // ============================================================
  // ACTIONS — Functions screens call to update data
  // Each action updates state AND saves to AsyncStorage
  // ============================================================

  // --- Baby Profile ---

  const saveBabyProfile = useCallback(async (newProfile) => {
    try {
      setBaby(newProfile);
      await AsyncStorage.setItem(STORAGE_KEYS.babyProfile, JSON.stringify(newProfile));
      // Background sync to Supabase (non-blocking)
      syncBaby(newProfile).catch(e => console.log('Baby sync bg:', e.message));
    } catch (error) {
      console.error('Error saving baby profile:', error);
    }
  }, []);

  // --- Mother Profile ---

  const saveMotherProfile = useCallback(async (newProfile) => {
    try {
      setMotherProfile(newProfile);
      await AsyncStorage.setItem(STORAGE_KEYS.motherProfile, JSON.stringify(newProfile));
      // Background sync to Supabase (non-blocking)
      syncProfile(newProfile).catch(e => console.log('Profile sync bg:', e.message));
    } catch (error) {
      console.error('Error saving mother profile:', error);
    }
  }, []);

  // --- Daily Logs ---

  const addLog = useCallback(async (type, logData = {}) => {
    if (!baby?.id) return;

    const newLog = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      type: type,
      autoLogged: logData.autoLogged || false,
      ...logData
    };

    const updatedLogs = {
      ...logs,
      [type]: [newLog, ...(logs[type] || [])]
    };

    setLogs(updatedLogs);
    await AsyncStorage.setItem(STORAGE_KEYS.dailyLogs(baby.id), JSON.stringify(updatedLogs));

    // Background sync to Supabase (non-blocking)
    syncDailyLog(newLog, baby.id, baby.birth_date).catch(e => console.log('Log sync bg:', e.message));

    return newLog;
  }, [baby?.id, baby?.birth_date, logs]);

  // --- Mother Daily Log ---

  const saveMotherLog = useCallback(async (logData) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const updatedLog = { ...todayMotherLog, ...logData, date: today };

      setTodayMotherLog(updatedLog);
      await AsyncStorage.setItem(STORAGE_KEYS.motherLog(today), JSON.stringify(updatedLog));

      // Update history
      const updatedHistory = [
        updatedLog,
        ...motherLogHistory.filter(log => log.date !== today)
      ].slice(0, 30);

      setMotherLogHistory(updatedHistory);
      await AsyncStorage.setItem(STORAGE_KEYS.motherLogsHistory, JSON.stringify(updatedHistory));

      // Background sync to Supabase (non-blocking)
      // Calculate postpartum day from baby's birth date
      const postpartumDay = baby?.birth_date
        ? Math.floor((new Date() - new Date(baby.birth_date)) / (1000 * 60 * 60 * 24))
        : 0;
      syncMotherLog(updatedLog, postpartumDay).catch(e => console.log('Mother log sync bg:', e.message));

    } catch (error) {
      console.error('Error saving mother log:', error);
    }
  }, [todayMotherLog, motherLogHistory, baby?.birth_date]);

  // --- Vaccine Status ---

  const updateVaccineStatus = useCallback(async (vaccineId, completed, completedDate = null) => {
    if (!baby?.id) return;

    const vaccineData = {
      completed,
      completedDate: completedDate || new Date().toISOString()
    };

    const updatedStatus = {
      ...vaccineStatus,
      [vaccineId]: vaccineData
    };

    setVaccineStatus(updatedStatus);
    await AsyncStorage.setItem(STORAGE_KEYS.vaccineStatus(baby.id), JSON.stringify(updatedStatus));

    // Background sync to Supabase (non-blocking)
    syncVaccineRecord(vaccineId, vaccineData, baby.id).catch(e => console.log('Vaccine sync bg:', e.message));
  }, [baby?.id, vaccineStatus]);

  // --- Growth Measurements ---

  const addGrowthMeasurement = useCallback(async (measurement) => {
    if (!baby?.id) return;

    const newMeasurement = {
      id: Date.now(),
      date: new Date().toISOString(),
      ...measurement
    };

    const updated = [newMeasurement, ...growthMeasurements];

    setGrowthMeasurements(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.growthMeasurements(baby.id), JSON.stringify(updated));

    // Background sync to Supabase (non-blocking)
    syncGrowthRecord(newMeasurement, baby.id).catch(e => console.log('Growth sync bg:', e.message));

    return newMeasurement;
  }, [baby?.id, growthMeasurements]);

  // --- Settings ---

  const updateSettings = useCallback(async (newSettings) => {
    try {
      const updated = { ...settings, ...newSettings };
      setSettings(updated);
      await AsyncStorage.setItem(STORAGE_KEYS.userSettings, JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }, [settings]);

  // --- Cloud Hydration (pull Supabase data into local) ---

  const hydrateFromSupabase = useCallback(async () => {
    try {
      console.log('☁️ Starting cloud hydration...');
      const result = await hydrateFromCloud();

      if (!result.success || !result.data) {
        console.log('☁️ No cloud data to hydrate');
        return false;
      }

      const { profile, babies, motherLogs, subscription, dailyLogs, growthRecords, vaccineRecords } = result.data;
      let hydrated = false;

      // Hydrate mother profile
      if (profile && profile.name) {
        const motherData = {
          name: profile.name,
          phone: profile.phone,
          email: profile.email,
          division: profile.division,
          district: profile.district,
          delivery_type: profile.delivery_type || 'normal',
          is_first_baby: profile.is_first_baby !== false,
          concerns: profile.concerns || [],
          language: profile.language || 'bn',
        };
        setMotherProfile(motherData);
        await AsyncStorage.setItem(STORAGE_KEYS.motherProfile, JSON.stringify(motherData));
        hydrated = true;
        console.log('☁️ Hydrated mother profile');
      }

      // Hydrate baby profile
      if (babies && babies.length > 0) {
        const cloudBaby = babies[0]; // First baby
        const babyData = {
          id: cloudBaby.id,
          user_id: cloudBaby.user_id,
          name: cloudBaby.name,
          birth_date: cloudBaby.birth_date,
          gender: cloudBaby.gender,
          created_at: cloudBaby.created_at,
        };
        setBaby(babyData);
        await AsyncStorage.setItem(STORAGE_KEYS.babyProfile, JSON.stringify(babyData));
        hydrated = true;
        console.log('☁️ Hydrated baby profile:', babyData.name);

        // Hydrate daily logs
        if (dailyLogs && dailyLogs.length > 0) {
          const logsByType = { feed: [], sleep: [], diaper: [], food: [] };
          for (const log of dailyLogs) {
            const type = log.log_type;
            if (logsByType[type]) {
              logsByType[type].push({
                id: log.id,
                timestamp: log.timestamp,
                type: type,
                source: log.source || 'manual',
                autoLogged: log.auto_logged || false,
                details: log.details,
                notes: log.notes,
              });
            }
          }
          setLogs(logsByType);
          await AsyncStorage.setItem(STORAGE_KEYS.dailyLogs(cloudBaby.id), JSON.stringify(logsByType));
          console.log('☁️ Hydrated daily logs:', dailyLogs.length, 'entries');
        }

        // Hydrate growth records
        if (growthRecords && growthRecords.length > 0) {
          const measurements = growthRecords.map(r => ({
            id: r.id,
            weight: parseFloat(r.weight_kg),
            height: r.height_cm ? parseFloat(r.height_cm) : null,
            date: r.recorded_date,
            ageMonths: r.age_months,
          }));
          setGrowthMeasurements(measurements);
          await AsyncStorage.setItem(STORAGE_KEYS.growthMeasurements(cloudBaby.id), JSON.stringify(measurements));
          console.log('☁️ Hydrated growth records:', measurements.length);
        }

        // Hydrate vaccine records
        if (vaccineRecords && vaccineRecords.length > 0) {
          const vaccineMap = {};
          for (const v of vaccineRecords) {
            vaccineMap[v.vaccine_name] = {
              completed: v.status === 'completed',
              completedDate: v.completed_date,
            };
          }
          setVaccineStatus(vaccineMap);
          await AsyncStorage.setItem(STORAGE_KEYS.vaccineStatus(cloudBaby.id), JSON.stringify(vaccineMap));
          console.log('☁️ Hydrated vaccine records:', vaccineRecords.length);
        }
      }

      // Hydrate mother daily logs
      if (motherLogs && motherLogs.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const todayLog = motherLogs.find(l => l.date === today);

        if (todayLog) {
          const formattedLog = {
            date: todayLog.date,
            mood: todayLog.mood,
            bleeding: todayLog.bleeding,
            pain: todayLog.pain,
            breastPain: todayLog.breast_pain,
            csectionHealing: todayLog.csection_healing,
            sleepHours: todayLog.sleep_hours,
            waterIntake: todayLog.water_intake || 0,
            mealsEaten: todayLog.meals_eaten || 0,
            breastfeedingSessions: todayLog.breastfeeding_sessions || 0,
            hadHelp: todayLog.had_help,
            completedAt: todayLog.completed_at,
          };
          setTodayMotherLog(formattedLog);
          await AsyncStorage.setItem(STORAGE_KEYS.motherLog(today), JSON.stringify(formattedLog));
        }

        // History
        const history = motherLogs.map(l => ({
          date: l.date,
          mood: l.mood,
          bleeding: l.bleeding,
          pain: l.pain,
          breastPain: l.breast_pain,
          csectionHealing: l.csection_healing,
          sleepHours: l.sleep_hours,
          waterIntake: l.water_intake || 0,
          mealsEaten: l.meals_eaten || 0,
          breastfeedingSessions: l.breastfeeding_sessions || 0,
          hadHelp: l.had_help,
          completedAt: l.completed_at,
        }));
        setMotherLogHistory(history);
        await AsyncStorage.setItem(STORAGE_KEYS.motherLogsHistory, JSON.stringify(history));
        console.log('☁️ Hydrated mother logs:', motherLogs.length, 'days');
      }

      if (hydrated) {
        console.log('☁️ Cloud hydration complete!');
      }
      return hydrated;

    } catch (error) {
      console.error('☁️ Hydration error:', error);
      return false;
    }
  }, []);

  // --- Reset (for development) ---

  const resetAllData = useCallback(async () => {
    try {
      // Get all keys and remove them one by one
      // (AsyncStorage.clear() fails on iOS due to directory permission)
      const allKeys = await AsyncStorage.getAllKeys();
      // Preserve celebrated milestones across logout/login cycles
      const keysToRemove = allKeys.filter(k => k !== 'celebrated_milestones');
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
      }
      setBaby(null);
      setMotherProfile(null);
      setLogs({ feed: [], sleep: [], diaper: [], food: [] });
      setTodayMotherLog(null);
      setMotherLogHistory([]);
      setVaccineStatus({});
      setGrowthMeasurements([]);
      setSettings({
        language: 'bn',
        notifications: { vaccine: true, daily: true, mood: true, milestone: true, evening: true }
      });
    } catch (error) {
      console.error('Error resetting data:', error);
    }
  }, []);

  // ============================================================
  // CONTEXT VALUE — Everything available to screens
  // ============================================================

  const value = {
    // State
    user,
    baby,
    motherProfile,
    logs,
    todayMotherLog,
    motherLogHistory,
    vaccineStatus,
    growthMeasurements,
    settings,
    loading,

    // Actions
    setUser,
    saveBabyProfile,
    saveMotherProfile,
    addLog,
    setLogs, // For direct updates (e.g., from DailyLogScreen's existing logic)
    saveMotherLog,
    updateVaccineStatus,
    addGrowthMeasurement,
    setGrowthMeasurements,
    updateSettings,
    resetAllData,

    // Auth state
    isAuthenticated,
    setIsAuthenticated,
    // Cloud sync
    hydrateFromSupabase,

    // Reload (useful after sync or import)
    reloadAllData: loadAllData,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export default AppContext;
