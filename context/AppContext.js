// context/AppContext.js
// Global state provider — the single brain of the app
// All screens read from and write to this context
// Data flows: AsyncStorage ←→ AppContext ←→ Screens

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../utils/constants';
import { safeJSONParse } from '../utils/helpers';

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
  }, []);

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

      // Load mother's today log
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const savedMotherLog = await AsyncStorage.getItem(STORAGE_KEYS.motherLog(today));
      if (savedMotherLog) {
        setTodayMotherLog(safeJSONParse(savedMotherLog, null));
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
    } catch (error) {
      console.error('Error saving baby profile:', error);
    }
  }, []);

  // --- Mother Profile ---

  const saveMotherProfile = useCallback(async (newProfile) => {
    try {
      setMotherProfile(newProfile);
      await AsyncStorage.setItem(STORAGE_KEYS.motherProfile, JSON.stringify(newProfile));
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

    return newLog;
  }, [baby?.id, logs]);

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
      ].slice(0, 30); // Keep last 30 days

      setMotherLogHistory(updatedHistory);
      await AsyncStorage.setItem(STORAGE_KEYS.motherLogsHistory, JSON.stringify(updatedHistory));

    } catch (error) {
      console.error('Error saving mother log:', error);
    }
  }, [todayMotherLog, motherLogHistory]);

  // --- Vaccine Status ---

  const updateVaccineStatus = useCallback(async (vaccineId, completed, completedDate = null) => {
    if (!baby?.id) return;

    const updatedStatus = {
      ...vaccineStatus,
      [vaccineId]: {
        completed,
        completedDate: completedDate || new Date().toISOString()
      }
    };

    setVaccineStatus(updatedStatus);
    await AsyncStorage.setItem(STORAGE_KEYS.vaccineStatus(baby.id), JSON.stringify(updatedStatus));
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

  // --- Reset (for development) ---

  const resetAllData = useCallback(async () => {
    try {
      // Get all keys and remove them one by one
      // (AsyncStorage.clear() fails on iOS due to directory permission)
      const allKeys = await AsyncStorage.getAllKeys();
      if (allKeys.length > 0) {
        await AsyncStorage.multiRemove(allKeys);
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
    updateSettings,
    resetAllData,

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
