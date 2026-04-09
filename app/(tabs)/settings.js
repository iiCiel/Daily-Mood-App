import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { Stack, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initSupabase, syncEntries } from '../../src/lib/supabase';
import { getUnsyncedEntries, markSynced } from '../../src/db/database';
import { COLORS } from '../../src/constants/theme';
import { useTheme } from '../../src/context/ThemeContext';
import {
  requestPermissions,
  scheduleReminder,
  cancelReminder,
  getSavedReminder,
} from '../../src/notifications';
import * as LocalAuthentication from 'expo-local-authentication';

const STORAGE_KEYS = {
  SUPABASE_URL: 'supabase_url',
  SUPABASE_KEY: 'supabase_anon_key',
};

export default function SettingsScreen() {
  const COLORS = useTheme();
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reminder, setReminder] = useState(null);
  const [lockEnabled, setLockEnabled] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const REMINDER_PRESETS = [
    { label: '8:00 am', hour: 8, minute: 0 },
    { label: '12:00 pm', hour: 12, minute: 0 },
    { label: '6:00 pm', hour: 18, minute: 0 },
    { label: '9:00 pm', hour: 21, minute: 0 },
  ];

  useEffect(() => {
    loadSettings();
    getSavedReminder().then(setReminder);
    AsyncStorage.getItem('app_lock_enabled').then((v) => setLockEnabled(v === 'true'));
    Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()])
      .then(([hw, enrolled]) => setBiometricsAvailable(hw && enrolled));
  }, []);

  async function loadSettings() {
    try {
      const url = await AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_URL);
      const key = await AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_KEY);
      if (url) setSupabaseUrl(url);
      if (key) setSupabaseKey(key);
      if (url && key) {
        initSupabase(url, key);
        setSaved(true);
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  }

  async function handleSave() {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_URL, supabaseUrl);
      await AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_KEY, supabaseKey);
      if (supabaseUrl && supabaseKey) {
        initSupabase(supabaseUrl, supabaseKey);
        setSaved(true);
      }
      Alert.alert('saved', 'configuration saved.');
    } catch (e) {
      Alert.alert('error', 'failed to save settings.');
    }
  }

  async function handleSync() {
    if (!supabaseUrl || !supabaseKey) {
      Alert.alert('not configured', 'please enter your supabase url and key first.');
      return;
    }
    setSyncing(true);
    try {
      const result = await syncEntries(getUnsyncedEntries, markSynced);
      if (result.success) {
        Alert.alert('synced', `${result.synced} entries synced to the cloud.`);
      } else {
        Alert.alert('sync failed', result.error);
      }
    } catch (e) {
      Alert.alert('error', 'sync failed. check your connection and config.');
    } finally {
      setSyncing(false);
    }
  }

  async function handleClearConfig() {
    Alert.alert('clear config', 'remove supabase configuration?', [
      { text: 'cancel', style: 'cancel' },
      {
        text: 'clear',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem(STORAGE_KEYS.SUPABASE_URL);
          await AsyncStorage.removeItem(STORAGE_KEYS.SUPABASE_KEY);
          setSupabaseUrl('');
          setSupabaseKey('');
          setSaved(false);
        },
      },
    ]);
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={[styles.container, { backgroundColor: COLORS.background }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>settings</Text>

        {/* Daily Reminder */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: COLORS.textSecondary }]}>daily reminder</Text>
          <Text style={[styles.sectionDesc, { color: COLORS.text }]}>
            get a nudge to log your mood each day.
          </Text>
          <View style={styles.reminderRow}>
            {REMINDER_PRESETS.map((p) => {
              const active = reminder && reminder.hour === p.hour && reminder.minute === p.minute;
              return (
                <TouchableOpacity
                  key={p.label}
                  style={[
                    styles.reminderChip,
                    { borderColor: COLORS.border, backgroundColor: active ? COLORS.text : COLORS.card },
                  ]}
                  onPress={async () => {
                    const granted = await requestPermissions();
                    if (!granted) {
                      Alert.alert('permission needed', 'enable notifications in your phone settings.');
                      return;
                    }
                    await scheduleReminder(p.hour, p.minute);
                    setReminder({ hour: p.hour, minute: p.minute });
                  }}
                >
                  <Text style={[styles.reminderChipText, { color: active ? COLORS.white : COLORS.textSecondary }]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {reminder && (
            <TouchableOpacity
              onPress={async () => {
                await cancelReminder();
                setReminder(null);
              }}
            >
              <Text style={[styles.clearReminder, { color: COLORS.danger }]}>turn off reminder</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* App Lock */}
        {biometricsAvailable && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: COLORS.textSecondary }]}>app lock</Text>
            <Text style={[styles.sectionDesc, { color: COLORS.text }]}>
              require face id or fingerprint to open the app.
            </Text>
            <TouchableOpacity
              style={[styles.lockToggle, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}
              onPress={async () => {
                const next = !lockEnabled;
                await AsyncStorage.setItem('app_lock_enabled', next ? 'true' : 'false');
                setLockEnabled(next);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.lockToggleText, { color: COLORS.text }]}>
                {lockEnabled ? 'enabled' : 'disabled'}
              </Text>
              <View style={[
                styles.toggle,
                { backgroundColor: lockEnabled ? COLORS.text : COLORS.border }
              ]}>
                <View style={[styles.toggleThumb, { left: lockEnabled ? 18 : 2 }]} />
              </View>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: COLORS.textSecondary }]}>cloud sync</Text>
          <Text style={styles.sectionDesc}>
            connect to supabase to back up your entries. optional — everything is stored locally first.
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>supabase url</Text>
          <TextInput
            style={styles.input}
            placeholder="https://your-project.supabase.co"
            placeholderTextColor={COLORS.textSecondary}
            value={supabaseUrl}
            onChangeText={setSupabaseUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>anon key</Text>
          <TextInput
            style={styles.input}
            placeholder="your-anon-key"
            placeholderTextColor={COLORS.textSecondary}
            value={supabaseKey}
            onChangeText={setSupabaseKey}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={handleSave}>
          <Text style={styles.primaryBtnText}>save</Text>
        </TouchableOpacity>

        {saved && (
          <TouchableOpacity
            style={[styles.secondaryBtn, syncing && { opacity: 0.5 }]}
            onPress={handleSync}
            disabled={syncing}
          >
            <Text style={styles.secondaryBtnText}>
              {syncing ? 'syncing...' : 'sync now'}
            </Text>
          </TouchableOpacity>
        )}

        {saved && (
          <TouchableOpacity style={styles.dangerBtn} onPress={handleClearConfig}>
            <Text style={styles.dangerBtnText}>clear configuration</Text>
          </TouchableOpacity>
        )}

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>how to set up sync</Text>
          <Text style={styles.infoText}>
            1. create a free supabase project at supabase.com{'\n'}
            2. create an "entries" table: id (text, PK), date (text), mood (int4), note (text), created_at, updated_at{'\n'}
            3. copy your project URL and anon key from Settings › API{'\n'}
            4. paste them above and hit save
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  backBtn: {
    alignSelf: 'flex-start',
    padding: 4,
  },
  backText: {
    fontSize: 24,
    color: COLORS.text,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.5,
    marginBottom: 28,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  sectionDesc: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 21,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 0.4,
    marginBottom: 7,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  primaryBtn: {
    backgroundColor: COLORS.text,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  secondaryBtn: {
    backgroundColor: COLORS.success,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  dangerBtn: {
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.danger,
    marginBottom: 28,
  },
  dangerBtnText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  reminderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    marginBottom: 10,
  },
  reminderChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  reminderChipText: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  lockToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 12,
  },
  lockToggleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  toggle: {
    width: 42,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    position: 'relative',
  },
  toggleThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    top: 3,
  },
  clearReminder: {
    fontSize: 13,
    letterSpacing: 0.3,
    marginTop: 2,
  },
  infoBox: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoTitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  infoText: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 22,
  },
});
