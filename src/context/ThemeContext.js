import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = 'theme_pref';

const light = {
  background: '#F0F4F0',
  card: '#FFFFFF',
  primary: '#4A7856',
  primaryLight: '#E6F2EB',
  text: '#1A1A1A',
  textSecondary: '#6B7280',
  border: '#E8ECE9',
  danger: '#EF4444',
  success: '#4A7856',
  white: '#FFFFFF',
  accent: '#2D5A3D',
};

const dark = {
  background: '#101810',
  card: '#1A2620',
  primary: '#5E9972',
  primaryLight: '#1C3025',
  text: '#F0F4F0',
  textSecondary: '#7A9280',
  border: '#253320',
  danger: '#EF4444',
  success: '#5E9972',
  white: '#FFFFFF',
  accent: '#5E9972',
};

const ThemeContext = createContext(light);
const ThemeDispatchContext = createContext(async () => {});
const ThemePrefContext = createContext('system');

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [pref, setPref] = useState('system');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(v => { if (v) setPref(v); });
  }, []);

  async function setThemePref(newPref) {
    setPref(newPref);
    await AsyncStorage.setItem(THEME_KEY, newPref);
  }

  const scheme = pref === 'system' ? systemScheme : pref;
  const colors = scheme === 'dark' ? dark : light;

  return (
    <ThemePrefContext.Provider value={pref}>
      <ThemeDispatchContext.Provider value={setThemePref}>
        <ThemeContext.Provider value={colors}>
          {children}
        </ThemeContext.Provider>
      </ThemeDispatchContext.Provider>
    </ThemePrefContext.Provider>
  );
}

export function useTheme() { return useContext(ThemeContext); }
export function useSetTheme() { return useContext(ThemeDispatchContext); }
export function useThemePref() { return useContext(ThemePrefContext); }
