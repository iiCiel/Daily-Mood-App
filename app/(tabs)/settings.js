import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ScrollView, Linking, Share,
} from 'react-native';
import { Stack, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initSupabase, syncEntries } from '../../src/lib/supabase';
import { getUnsyncedEntries, markSynced, getEntries } from '../../src/db/database';
import { useTheme, useSetTheme, useThemePref } from '../../src/context/ThemeContext';
import {
  requestPermissions, getReminders, addReminder, removeReminder,
} from '../../src/notifications';
import * as LocalAuthentication from 'expo-local-authentication';
import { getGoals } from '../../src/db/goalsDatabase';
import { getNotes } from '../../src/db/notesDatabase';
import { getRecentSleep } from '../../src/db/sleepDatabase';

const STORAGE_KEYS = { SUPABASE_URL: 'supabase_url', SUPABASE_KEY: 'supabase_anon_key' };
const APP_VERSION = '1.0.0';
const PLAY_STORE_URL = 'market://details?id=com.iiciel.moodjournal';

const REMINDER_PRESETS = [
  { label: '7:00 am', hour: 7, minute: 0 },
  { label: '9:00 am', hour: 9, minute: 0 },
  { label: '12:00 pm', hour: 12, minute: 0 },
  { label: '3:00 pm', hour: 15, minute: 0 },
  { label: '6:00 pm', hour: 18, minute: 0 },
  { label: '9:00 pm', hour: 21, minute: 0 },
];

function Toggle({ value, onToggle, C }) {
  return (
    <TouchableOpacity
      style={[ss.toggle, { backgroundColor: value ? C.text : C.border }]}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <View style={[ss.thumb, { left: value ? 18 : 2 }]} />
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const C = useTheme();
  const setThemePref = useSetTheme();
  const themePref = useThemePref();

  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reminders, setReminders] = useState([]);
  const [lockEnabled, setLockEnabled] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);

  useEffect(() => {
    loadSettings();
    getReminders().then(setReminders);
    AsyncStorage.getItem('app_lock_enabled').then(v => setLockEnabled(v === 'true'));
    Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()])
      .then(([hw, enrolled]) => setBiometricsAvailable(hw && enrolled));
  }, []);

  async function loadSettings() {
    const url = await AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_URL);
    const key = await AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_KEY);
    if (url) setSupabaseUrl(url);
    if (key) setSupabaseKey(key);
    if (url && key) { initSupabase(url, key); setSaved(true); }
  }

  async function toggleReminder(hour, minute) {
    const active = reminders.some(r => r.hour === hour && r.minute === minute);
    if (active) {
      await removeReminder(hour, minute);
    } else {
      const granted = await addReminder(hour, minute);
      if (!granted) {
        Alert.alert('permission needed', 'enable notifications in your phone settings.');
        return;
      }
    }
    setReminders(await getReminders());
  }

  async function handleSave() {
    await AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_URL, supabaseUrl);
    await AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_KEY, supabaseKey);
    if (supabaseUrl && supabaseKey) { initSupabase(supabaseUrl, supabaseKey); setSaved(true); }
    Alert.alert('saved', 'configuration saved.');
  }

  async function handleSync() {
    if (!supabaseUrl || !supabaseKey) { Alert.alert('not configured', 'enter your supabase credentials first.'); return; }
    setSyncing(true);
    try {
      const result = await syncEntries(getUnsyncedEntries, markSynced);
      Alert.alert(result.success ? 'synced' : 'sync failed', result.success ? `${result.synced} entries synced.` : result.error);
    } catch { Alert.alert('error', 'sync failed.'); }
    finally { setSyncing(false); }
  }

  async function handleExport() {
    try {
      const [entries, goals, notes, sleep] = await Promise.all([
        getEntries(1000),
        getGoals(),
        getNotes(),
        getRecentSleep(365),
      ]);
      const data = {
        exported_at: new Date().toISOString(),
        mood_entries: entries,
        goals,
        notes,
        sleep,
      };
      const json = JSON.stringify(data, null, 2);
      await Share.share({ message: json, title: 'mood journal export' });
    } catch (e) {
      Alert.alert('error', 'could not export data.');
    }
  }

  function SectionTitle({ label }) {
    return <Text style={[ss.sectionTitle, { color: C.textSecondary }]}>{label}</Text>;
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={[ss.container, { backgroundColor: C.background }]} contentContainerStyle={ss.content} keyboardShouldPersistTaps="handled">
        <View style={ss.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[ss.back, { color: C.text }]}>←</Text>
          </TouchableOpacity>
          <Text style={[ss.title, { color: C.text }]}>settings</Text>
        </View>

        {/* Appearance */}
        <SectionTitle label="appearance" />
        <View style={[ss.card, { backgroundColor: C.card, borderColor: C.border }]}>
          {(['system', 'light', 'dark']).map((opt, i, arr) => (
            <TouchableOpacity
              key={opt}
              style={[ss.themeRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border }]}
              onPress={() => setThemePref(opt)}
              activeOpacity={0.7}
            >
              <Text style={[ss.themeLabel, { color: C.text }]}>{opt === 'system' ? 'follow system' : opt + ' mode'}</Text>
              <View style={[ss.radio, { borderColor: C.border }, themePref === opt && { borderColor: C.text, backgroundColor: C.text }]}>
                {themePref === opt && <View style={ss.radioDot} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Reminders */}
        <SectionTitle label="daily reminders" />
        <Text style={[ss.sectionDesc, { color: C.textSecondary }]}>tap to add or remove. multiple times allowed.</Text>
        <View style={ss.chipRow}>
          {REMINDER_PRESETS.map(p => {
            const active = reminders.some(r => r.hour === p.hour && r.minute === p.minute);
            return (
              <TouchableOpacity
                key={p.label}
                style={[ss.chip, { borderColor: C.border, backgroundColor: active ? C.text : C.card }]}
                onPress={() => toggleReminder(p.hour, p.minute)}
              >
                <Text style={[ss.chipText, { color: active ? C.white : C.textSecondary }]}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {reminders.length > 0 && (
          <Text style={[ss.activeReminders, { color: C.textSecondary }]}>
            active: {reminders.map(r => {
              const p = REMINDER_PRESETS.find(x => x.hour === r.hour && x.minute === r.minute);
              return p?.label || `${r.hour}:${String(r.minute).padStart(2,'0')}`;
            }).join(', ')}
          </Text>
        )}

        {/* App Lock */}
        {biometricsAvailable && (
          <>
            <SectionTitle label="app lock" />
            <TouchableOpacity
              style={[ss.row, { backgroundColor: C.card, borderColor: C.border }]}
              onPress={async () => {
                const next = !lockEnabled;
                await AsyncStorage.setItem('app_lock_enabled', next ? 'true' : 'false');
                setLockEnabled(next);
              }}
              activeOpacity={0.7}
            >
              <Text style={[ss.rowLabel, { color: C.text }]}>biometric lock</Text>
              <Toggle value={lockEnabled} onToggle={async () => {
                const next = !lockEnabled;
                await AsyncStorage.setItem('app_lock_enabled', next ? 'true' : 'false');
                setLockEnabled(next);
              }} C={C} />
            </TouchableOpacity>
          </>
        )}

        {/* Cloud sync */}
        <SectionTitle label="cloud sync" />
        <Text style={[ss.sectionDesc, { color: C.textSecondary }]}>optional. connect supabase to back up your entries.</Text>
        <View style={ss.inputGroup}>
          <TextInput style={[ss.input, { backgroundColor: C.card, borderColor: C.border, color: C.text }]}
            placeholder="supabase url" placeholderTextColor={C.textSecondary}
            value={supabaseUrl} onChangeText={setSupabaseUrl}
            autoCapitalize="none" autoCorrect={false}
          />
        </View>
        <View style={ss.inputGroup}>
          <TextInput style={[ss.input, { backgroundColor: C.card, borderColor: C.border, color: C.text }]}
            placeholder="anon key" placeholderTextColor={C.textSecondary}
            value={supabaseKey} onChangeText={setSupabaseKey}
            autoCapitalize="none" autoCorrect={false} secureTextEntry
          />
        </View>
        <TouchableOpacity style={[ss.btn, { backgroundColor: C.text }]} onPress={handleSave}>
          <Text style={[ss.btnText, { color: C.white }]}>save</Text>
        </TouchableOpacity>
        {saved && (
          <TouchableOpacity style={[ss.btn, { backgroundColor: C.success }, syncing && { opacity: 0.5 }]} onPress={handleSync} disabled={syncing}>
            <Text style={[ss.btnText, { color: '#fff' }]}>{syncing ? 'syncing...' : 'sync now'}</Text>
          </TouchableOpacity>
        )}

        {/* About */}
        <SectionTitle label="about" />
        <View style={[ss.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <TouchableOpacity style={[ss.aboutRow, { borderBottomWidth: 1, borderBottomColor: C.border }]} onPress={() => router.push('/privacy')}>
            <Text style={[ss.aboutLabel, { color: C.text }]}>privacy policy</Text>
            <Text style={{ color: C.textSecondary }}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[ss.aboutRow, { borderBottomWidth: 1, borderBottomColor: C.border }]} onPress={handleExport}>
            <Text style={[ss.aboutLabel, { color: C.text }]}>export my data</Text>
            <Text style={{ color: C.textSecondary }}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[ss.aboutRow, { borderBottomWidth: 1, borderBottomColor: C.border }]} onPress={() => Linking.openURL(PLAY_STORE_URL).catch(() => Alert.alert('', 'app not on store yet.'))}>
            <Text style={[ss.aboutLabel, { color: C.text }]}>rate the app ⭐</Text>
            <Text style={{ color: C.textSecondary }}>›</Text>
          </TouchableOpacity>
          <View style={ss.aboutRow}>
            <Text style={[ss.aboutLabel, { color: C.textSecondary }]}>version</Text>
            <Text style={{ color: C.textSecondary }}>{APP_VERSION}</Text>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const ss = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 60, paddingBottom: 50 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 28 },
  back: { fontSize: 24 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  sectionTitle: { fontSize: 12, letterSpacing: 0.6, marginTop: 24, marginBottom: 10 },
  sectionDesc: { fontSize: 13, letterSpacing: 0.2, marginBottom: 12, marginTop: -4 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 8 },
  themeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  themeLabel: { fontSize: 15, letterSpacing: 0.1 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: '500', letterSpacing: 0.2 },
  activeReminders: { fontSize: 12, letterSpacing: 0.3, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8 },
  rowLabel: { fontSize: 15, letterSpacing: 0.1 },
  toggle: { width: 42, height: 26, borderRadius: 13, justifyContent: 'center', position: 'relative' },
  thumb: { position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', top: 3 },
  inputGroup: { marginBottom: 12 },
  input: { borderRadius: 14, padding: 14, fontSize: 14, borderWidth: 1 },
  btn: { borderRadius: 999, paddingVertical: 15, alignItems: 'center', marginBottom: 12 },
  btnText: { fontSize: 15, fontWeight: '600', letterSpacing: 0.8 },
  aboutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  aboutLabel: { fontSize: 15, letterSpacing: 0.1 },
});
