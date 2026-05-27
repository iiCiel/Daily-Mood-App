import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = 'theme_pref';

const light = {
  background: '#F6F7FB',
  card: '#FFFFFF',
  primary: '#2563EB',
  primaryLight: '#EAF1FF',
  text: '#111827',
  textSecondary: '#667085',
  border: '#DDE3EC',
  danger: '#E5484D',
  success: '#16A34A',
  white: '#FFFFFF',
  accent: '#F97316',
  mint: '#E7F8EF',
  lavender: '#F0ECFF',
  sand: '#FFF5D6',
  blue: '#EAF1FF',
  peach: '#FFEDE3',
  yellow: '#FFF6CC',
  inkSoft: '#263244',
  panel: '#EEF2F7',
  teal: '#0D9488',
  grape: '#7C3AED',
};

const dark = {
  background: '#0B1020',
  card: '#121A2B',
  primary: '#60A5FA',
  primaryLight: '#16243D',
  text: '#F8FAFC',
  textSecondary: '#A7B0C0',
  border: '#25314A',
  danger: '#FB7185',
  success: '#4ADE80',
  white: '#FFFFFF',
  accent: '#FDBA74',
  mint: '#102A22',
  lavender: '#231A3D',
  sand: '#312914',
  blue: '#14233E',
  peach: '#321D18',
  yellow: '#302A10',
  inkSoft: '#E5E7EB',
  panel: '#101827',
  teal: '#2DD4BF',
  grape: '#A78BFA',
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
