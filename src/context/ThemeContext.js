import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = 'theme_pref';

const light = {
  background: '#FAF8F5',
  card: '#FFFFFF',
  primary: '#B85B3A',
  primaryLight: '#FCEEE8',
  text: '#1A1109',
  textSecondary: '#877060',
  border: '#EDE3D9',
  danger: '#D63939',
  success: '#3A8A52',
  white: '#FFFFFF',
  accent: '#944528',
  mint: '#E4F2EB',
  lavender: '#EEE6F5',
  sand: '#F5EDDC',
  blue: '#E5EDF5',
  peach: '#FCEEE8',
  yellow: '#FDF5D8',
  inkSoft: '#3D1A0A',
};

const dark = {
  background: '#100C08',
  card: '#1E160E',
  primary: '#D9713E',
  primaryLight: '#3D1E0A',
  text: '#FAF0E8',
  textSecondary: '#9E8A78',
  border: '#362515',
  danger: '#EF4444',
  success: '#5E9B72',
  white: '#FFFFFF',
  accent: '#D9713E',
  mint: '#152E1E',
  lavender: '#26183A',
  sand: '#302818',
  blue: '#162030',
  peach: '#3A1C12',
  yellow: '#302A10',
  inkSoft: '#FAF0E8',
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
