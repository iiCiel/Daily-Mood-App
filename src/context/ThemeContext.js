import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';

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

export function ThemeProvider({ children }) {
  const scheme = useColorScheme();
  const colors = scheme === 'dark' ? dark : light;
  return <ThemeContext.Provider value={colors}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
