import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useEffect, useState, useRef } from 'react';
import { useColorScheme, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as LocalAuthentication from 'expo-local-authentication';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { getEntry, saveEntry } from '../src/db/database';
import { registerMoodCategory } from '../src/notifications';
import { runAutoBackupIfDue } from '../src/lib/autoBackup';
import LockScreen from './lock';

const LOCK_KEY = 'app_lock_enabled';
// Lock after 5 minutes in background
const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

function AppLayout() {
  const C = useTheme();
  const scheme = useColorScheme();
  const [locked, setLocked] = useState(false);
  const bgTimestampRef = useRef(null);

  useEffect(() => {
    registerMoodCategory();
    initLock();
    // Fire-and-forget: writes at most one verified backup per day if a folder is set.
    // Never blocks launch and never surfaces errors here — Settings reports status.
    runAutoBackupIfDue();

    // Handle quick mood from notification action
    const notifSub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const actionId = response.actionIdentifier;
      const mood = parseInt(actionId);
      if (mood >= 1 && mood <= 5) {
        const d = new Date();
        const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const existing = await getEntry(date);
        await saveEntry(
          date,
          mood,
          existing?.note || '',
          existing?.photos?.map((p) => p.uri) || [],
          existing?.tags || [],
          existing?.gratitude || [],
          existing?.productivity || null,
          existing?.prayers || {}
        );
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

  if (locked) {
    return <LockScreen onUnlock={() => setLocked(false)} />;
  }

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.background },
          headerTintColor: C.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: C.background },
          headerTitleStyle: { fontWeight: '700' },
          headerShown: false,
          animation: 'fade_from_bottom',
        }}
      />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Story: require('../assets/fonts/Caveat.ttf'),
    Rounded: require('../assets/fonts/Nunito.ttf'),
  });

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider>
      <AppLayout />
    </ThemeProvider>
  );
}
