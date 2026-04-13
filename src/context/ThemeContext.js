import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = 'theme_pref';

const light = {
  background: '#F0EBE1',
  card: '#FAF6EF',
  primary: '#8B7355',
  primaryLight: '#EAE3D8',
  text: '#2D2820',
  textSecondary: '#9B8E7E',
  border: '#E5DDD2',
  danger: '#E07060',
  success: '#6CC97C',
  white: '#FFFFFF',
};

const dark = {
  background: '#1A1714',
  card: '#242018',
  primary: '#C4A882',
  primaryLight: '#2E2820',
  text: '#F0EBE1',
  textSecondary: '#7A6E62',
  border: '#332E28',
  danger: '#E07060',
  success: '#6CC97C',
  white: '#FFFFFF',
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
