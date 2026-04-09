import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as LocalAuthentication from 'expo-local-authentication';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { saveEntry } from '../src/db/database';
import { registerMoodCategory } from '../src/notifications';
import LockScreen from './lock';

const LOCK_KEY = 'app_lock_enabled';
// Lock after 5 minutes in background
const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

function AppLayout() {
  const COLORS = useTheme();
  const scheme = useColorScheme();
  const [locked, setLocked] = useState(false);
  const bgTimestampRef = { current: null };

  useEffect(() => {
    checkOnboarding();
    registerMoodCategory();
    initLock();

    // Handle quick mood from notification action
    const notifSub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const actionId = response.actionIdentifier;
      const mood = parseInt(actionId);
      if (mood >= 1 && mood <= 5) {
        const d = new Date();
        const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        await saveEntry(date, mood, '', []);
      }
    });

    // Lock when returning from background after timeout
    const appStateSub = AppState.addEventListener('change', async (next) => {
      if (next.match(/inactive|background/)) {
        bgTimestampRef.current = Date.now();
      } else if (next === 'active') {
        const lockEnabled = await AsyncStorage.getItem(LOCK_KEY);
        if (lockEnabled !== 'true') return;
        const bg = bgTimestampRef.current;
        if (bg && Date.now() - bg > LOCK_TIMEOUT_MS) {
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          const enrolled = await LocalAuthentication.isEnrolledAsync();
          if (hasHardware && enrolled) setLocked(true);
        }
      }
    });

    return () => {
      notifSub.remove();
      appStateSub.remove();
    };
  }, []);

  async function initLock() {
    const lockEnabled = await AsyncStorage.getItem(LOCK_KEY);
    if (lockEnabled !== 'true') return;
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (hasHardware && enrolled) setLocked(true);
  }

  async function checkOnboarding() {
    const done = await AsyncStorage.getItem('onboarding_done');
    if (!done) {
      router.replace('/onboarding');
    }
  }

  if (locked) {
    return <LockScreen onUnlock={() => setLocked(false)} />;
  }

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.background },
          headerTintColor: COLORS.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: COLORS.background },
          headerTitleStyle: { fontWeight: '700' },
          headerShown: false,
          animation: 'fade_from_bottom',
        }}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppLayout />
    </ThemeProvider>
  );
}
