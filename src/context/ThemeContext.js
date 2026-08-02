import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = 'theme_pref';

const light = {
  background: '#F5F0E8',
  card: '#FFFDF7',
  primary: '#C96B3A',
  primaryLight: '#FAE8DB',
  text: '#2C1A0E',
  textSecondary: '#9A7B5A',
  border: '#E8DDD0',
  danger: '#C53030',
  success: '#5A8A5A',
  white: '#FFFDF7',
  accent: '#8B4A20',
  mint: '#E8F0E4',
  lavender: '#EDE8F5',
  sand: '#FFF4E0',
  blue: '#E8EFF5',
  peach: '#FFEAE0',
  yellow: '#FFF5D6',
  inkSoft: '#4A3728',
  panel: '#EDE6D8',
  teal: '#5B8C7A',
  grape: '#8B6BAE',
};

const dark = {
  background: '#1C1108',
  card: '#271A0C',
  primary: '#D4844A',
  primaryLight: '#3A2010',
  text: '#F5EDE0',
  textSecondary: '#A07B58',
  border: '#3D2A1A',
  danger: '#E06050',
  success: '#7AAD78',
  white: '#FFFDF7',
  accent: '#E8A060',
  mint: '#1A2E1C',
  lavender: '#261A35',
  sand: '#302418',
  blue: '#1A2030',
  peach: '#321C14',
  yellow: '#30250E',
  inkSoft: '#F0E0CC',
  panel: '#201408',
  teal: '#3D7A68',
  grape: '#7B5BA0',
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
