import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ImageBackground,
  StyleSheet, Alert, ScrollView, Linking, Share, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initSupabase, syncEntries } from '../../src/lib/supabase';
import { getUnsyncedEntries, markSynced, getEntries, importFromText } from '../../src/db/database';
import { useTheme, useSetTheme, useThemePref } from '../../src/context/ThemeContext';
import {
  getReminders, addReminder, removeReminder,
  getHabitReminder, addHabitReminder, removeHabitReminder,
} from '../../src/notifications';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Clipboard from 'expo-clipboard';
import { getGoals } from '../../src/db/goalsDatabase';
import { getNotes } from '../../src/db/notesDatabase';
import { getRecentSleep } from '../../src/db/sleepDatabase';
import { getAllCalorieEntries } from '../../src/db/calorieDatabase';
import { getAllHabitCompletions, getAllHabitsForBackup } from '../../src/db/habitDatabase';
import { getWeightEntries } from '../../src/db/weightDatabase';
import {
  getAllPlannerEntries,
  getAllPlanningTasksForBackup,
  getAllProjectsForBackup,
  getAllTaskListsForBackup,
} from '../../src/db/plannerDatabase';
import { getAllFocusSessions } from '../../src/db/focusDatabase';
import { getSavedMeals } from '../../src/db/savedMealsDatabase';
import { importBackup } from '../../src/db/backupDatabase';
import * as FileSystem from 'expo-file-system';

const STORAGE_KEYS = { SUPABASE_URL: 'supabase_url', SUPABASE_KEY: 'supabase_anon_key' };
const APP_VERSION = '1.0.0';
const PLAY_STORE_URL = 'market://details?id=com.iiciel.moodjournal';
const paperArt = require('../../assets/illustrations/storybook-paper-rich.png');

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
  const [habitReminder, setHabitReminder] = useState(null);
  const [lockEnabled, setLockEnabled] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    loadSettings();
    getReminders().then(setReminders);
    getHabitReminder().then(setHabitReminder);
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

  async function toggleHabitReminder(hour, minute) {
    if (habitReminder?.hour === hour && habitReminder?.minute === minute) {
      await removeHabitReminder();
      setHabitReminder(null);
    } else {
      const ok = await addHabitReminder(hour, minute);
      if (!ok) { Alert.alert('permission needed', 'enable notifications in your phone settings.'); return; }
      setHabitReminder({ hour, minute });
    }
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

  async function handleImport() {
    if (!importText.trim()) {
      Alert.alert('nothing to import', 'paste your copied month data first.');
      return;
    }
    setImporting(true);
    try {
      const result = await importFromText(importText.trim());
      if (result.error) {
        Alert.alert('import failed', result.error);
      } else {
        setShowImport(false);
        setImportText('');
        Alert.alert(
          'import complete',
          `${result.imported} ${result.imported === 1 ? 'entry' : 'entries'} imported.${result.skipped ? `\n${result.skipped} skipped (already exist).` : ''}`
        );
      }
    } catch (e) {
      Alert.alert('error', 'import failed. please try again.');
    } finally {
      setImporting(false);
    }
  }

  async function handleExportEverything() {
    try {
      const [
        moodEntries, sleepEntries, calorieEntries, habitCompletions, habitDefinitions, weightEntries,
        goals, notes, plannerEntries, focusSessions, tasks, projects, taskLists, savedMeals,
      ] = await Promise.all([
        getEntries(10000),
        getRecentSleep(3650),
        getAllCalorieEntries(),
        getAllHabitCompletions(),
        getAllHabitsForBackup(),
        getWeightEntries(3650),
        getGoals(),
        getNotes(),
        getAllPlannerEntries(),
        getAllFocusSessions(),
        getAllPlanningTasksForBackup(),
        getAllProjectsForBackup(),
        getAllTaskListsForBackup(),
        getSavedMeals(),
      ]);

      const backup = {
        app: 'Daily Mood',
        exported_at: new Date().toISOString(),
        version: 4,
        photo_note: 'Photos stay local to this device and are not embedded in this backup.',
        mood: moodEntries,
        sleep: sleepEntries,
        calories: calorieEntries,
        habits: habitCompletions,
        habit_definitions: habitDefinitions,
        weight: weightEntries,
        goals,
        notes,
        planner: plannerEntries,
        focus_sessions: focusSessions,
        tasks,
        projects,
        task_lists: taskLists,
        saved_meals: savedMeals,
      };

      const json = JSON.stringify(backup, null, 2);
      await Clipboard.setStringAsync(json);
      await Share.share({
        message: json,
        title: `daily_app_backup_${new Date().toISOString().slice(0, 10)}.json`,
      });
    } catch (e) {
      Alert.alert('export error', String(e?.message || e));
    }
  }

  async function handleImportBackup() {
    Alert.alert(
      'restore from backup',
      'copy the backup JSON text to your clipboard first, then tap restore. matching records will be updated.',
      [
        { text: 'cancel', style: 'cancel' },
        {
          text: 'restore',
          onPress: async () => {
            try {
              const text = await Clipboard.getStringAsync();
              if (!text?.trim()) { Alert.alert('nothing on clipboard', 'copy the backup JSON first.'); return; }
              let backup;
              try { backup = JSON.parse(text); } catch { Alert.alert('invalid backup', 'clipboard does not contain valid JSON.'); return; }
              const counts = await importBackup(backup);
              const summary = Object.entries(counts)
                .filter(([, v]) => v > 0)
                .map(([k, v]) => `${v} ${k}`)
                .join(', ');
              Alert.alert('restore complete', summary || 'nothing was imported.');
            } catch (e) {
              console.error(e);
              Alert.alert('error', `restore failed: ${e?.message || e}`);
            }
          },
        },
      ]
    );
  }

  function toCSV(headers, rows) {
    const escape = (v) => {
      if (v == null) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? '"' + s.replace(/"/g, '""') + '"'
        : s;
    };
    return [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n');
  }

  async function handleExportCSV() {
    try {
      if (!FileSystem.StorageAccessFramework) {
        Alert.alert('not available', 'csv folder export is available on Android.');
        return;
      }
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permissions.granted) return;
      const dir = permissions.directoryUri;

      const [moodEntries, sleepEntries, calorieEntries, habitCompletions, weightEntries] = await Promise.all([
        getEntries(5000),
        getRecentSleep(3650),
        getAllCalorieEntries(),
        getAllHabitCompletions(),
        getWeightEntries(3650),
      ]);

      const MOODS_MAP = { 1: 'bad', 2: 'low', 3: 'okay', 4: 'good', 5: 'great' };

      const files = [
        {
          name: 'mood.csv',
          content: toCSV(
            ['date', 'mood', 'mood_label', 'note', 'tags'],
            moodEntries.map((e) => {
              let tags = '';
              try { tags = JSON.parse(e.tags || '[]').join('; '); } catch {}
              return [e.date, e.mood, MOODS_MAP[e.mood] || '', e.note || '', tags];
            })
          ),
        },
        {
          name: 'sleep.csv',
          content: toCSV(
            ['date', 'bedtime', 'wake_time', 'quality', 'note'],
            sleepEntries.map((e) => [e.date, e.bedtime || '', e.wake_time || '', e.quality || '', e.note || ''])
          ),
        },
        {
          name: 'calories.csv',
          content: toCSV(
            ['date', 'meal', 'food_name', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'note'],
            calorieEntries.map((e) => [e.date, e.meal, e.name, e.calories, e.protein || '', e.carbs || '', e.fat || '', e.note || ''])
          ),
        },
        {
          name: 'habits.csv',
          content: toCSV(
            ['date', 'habit', 'emoji', 'schedule_days'],
            habitCompletions.map((e) => [e.date, e.title, e.emoji || '', e.schedule_days || '[0,1,2,3,4,5,6]'])
          ),
        },
        {
          name: 'weight.csv',
          content: toCSV(
            ['date', 'weight', 'unit', 'note'],
            weightEntries.map((e) => [e.date, e.weight, e.unit, e.note || ''])
          ),
        },
      ];

      for (const file of files) {
        const uri = await FileSystem.StorageAccessFramework.createFileAsync(dir, file.name, 'text/csv');
        await FileSystem.writeAsStringAsync(uri, file.content, { encoding: FileSystem.EncodingType.UTF8 });
      }

      Alert.alert('export complete', `${files.length} csv files saved to the selected folder.`);
    } catch (e) {
      Alert.alert('error', 'could not export csv files.');
    }
  }

  function SectionTitle({ label }) {
    return <Text style={[ss.sectionTitle, { color: C.text }]}>{label}</Text>;
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ImageBackground source={paperArt} style={[ss.container, { backgroundColor: C.background }]} imageStyle={ss.backgroundImage}>
        <ScrollView contentContainerStyle={ss.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={ss.topBar}>
          <TouchableOpacity style={[ss.iconButton, { backgroundColor: C.card, borderColor: C.border }]} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={19} color={C.text} />
          </TouchableOpacity>
        </View>

        <View style={[ss.heroCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={[ss.heroIcon, { backgroundColor: C.primaryLight }]}>
            <Ionicons name="settings-outline" size={24} color={C.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[ss.title, { color: C.text }]}>Settings</Text>
            <Text style={[ss.heroScript, { color: C.text }]}>tiny controls for your day</Text>
          </View>
        </View>

        {/* Appearance */}
        <SectionTitle label="Appearance" />
        <View style={[ss.card, { backgroundColor: C.card, borderColor: C.border }]}>
          {(['system', 'light', 'dark']).map((opt, i, arr) => (
            <TouchableOpacity
              key={opt}
              style={[ss.themeRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border }]}
              onPress={() => setThemePref(opt)}
              activeOpacity={0.7}
            >
              <View style={ss.rowCopy}>
                <Ionicons
                  name={opt === 'system' ? 'phone-portrait-outline' : opt === 'light' ? 'sunny-outline' : 'moon-outline'}
                  size={18}
                  color={themePref === opt ? C.primary : C.textSecondary}
                />
                <Text style={[ss.themeLabel, { color: C.text }]}>{opt === 'system' ? 'follow system' : opt + ' mode'}</Text>
              </View>
              <View style={[ss.radio, { borderColor: C.border }, themePref === opt && { borderColor: C.text, backgroundColor: C.text }]}>
                {themePref === opt && <View style={ss.radioDot} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Reminders */}
        <SectionTitle label="Daily Reminders" />
        <Text style={[ss.sectionDesc, { color: C.textSecondary }]}>tap to add or remove. multiple times allowed.</Text>
        <View style={ss.chipRow}>
          {REMINDER_PRESETS.map(p => {
            const active = reminders.some(r => r.hour === p.hour && r.minute === p.minute);
            return (
              <TouchableOpacity
                key={p.label}
                style={[ss.chip, { borderColor: active ? C.primary : C.border, backgroundColor: active ? C.primary : C.card }]}
                onPress={() => toggleReminder(p.hour, p.minute)}
              >
                <Text style={[ss.chipText, { color: active ? '#fff' : C.textSecondary }]}>{p.label}</Text>
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

        {/* Habit Reminder */}
        <SectionTitle label="Habit Reminder" />
        <Text style={[ss.sectionDesc, { color: C.textSecondary }]}>a daily nudge to check your habits.</Text>
        <View style={ss.chipRow}>
          {REMINDER_PRESETS.map(p => {
            const active = habitReminder?.hour === p.hour && habitReminder?.minute === p.minute;
            return (
              <TouchableOpacity
                key={p.label}
                style={[ss.chip, { borderColor: active ? C.primary : C.border, backgroundColor: active ? C.primary : C.card }]}
                onPress={() => toggleHabitReminder(p.hour, p.minute)}
              >
                <Text style={[ss.chipText, { color: active ? '#fff' : C.textSecondary }]}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {habitReminder && (
          <Text style={[ss.activeReminders, { color: C.textSecondary }]}>
            active: {REMINDER_PRESETS.find(x => x.hour === habitReminder.hour && x.minute === habitReminder.minute)?.label || `${habitReminder.hour}:${String(habitReminder.minute).padStart(2,'0')}`}
          </Text>
        )}

        {/* App Lock */}
        {biometricsAvailable && (
          <>
            <SectionTitle label="App Lock" />
            <TouchableOpacity
              style={[ss.row, { backgroundColor: C.card, borderColor: C.border }]}
              onPress={async () => {
                const next = !lockEnabled;
                await AsyncStorage.setItem('app_lock_enabled', next ? 'true' : 'false');
                setLockEnabled(next);
              }}
              activeOpacity={0.7}
            >
              <View style={ss.rowCopy}>
                <Ionicons name="finger-print-outline" size={19} color={C.primary} />
                <Text style={[ss.rowLabel, { color: C.text }]}>biometric lock</Text>
              </View>
              <Toggle value={lockEnabled} onToggle={async () => {
                const next = !lockEnabled;
                await AsyncStorage.setItem('app_lock_enabled', next ? 'true' : 'false');
                setLockEnabled(next);
              }} C={C} />
            </TouchableOpacity>
          </>
        )}

        {/* Cloud sync */}
        <SectionTitle label="Cloud Sync" />
        <Text style={[ss.sectionDesc, { color: C.textSecondary }]}>optional. connect supabase to back up mood entries.</Text>
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
        <TouchableOpacity style={[ss.btn, { backgroundColor: C.primary }]} onPress={handleSave}>
          <Ionicons name="save-outline" size={18} color={C.white} />
          <Text style={[ss.btnText, { color: C.white }]}>save</Text>
        </TouchableOpacity>
        {saved && (
          <TouchableOpacity style={[ss.btn, { backgroundColor: C.success }, syncing && { opacity: 0.5 }]} onPress={handleSync} disabled={syncing}>
            <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
            <Text style={[ss.btnText, { color: '#fff' }]}>{syncing ? 'syncing...' : 'sync now'}</Text>
          </TouchableOpacity>
        )}

        {/* About */}
        <SectionTitle label="About" />
        <View style={[ss.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <TouchableOpacity style={[ss.aboutRow, { borderBottomWidth: 1, borderBottomColor: C.border }]} onPress={() => router.push('/privacy')}>
            <View style={ss.rowCopy}>
              <Ionicons name="shield-checkmark-outline" size={18} color={C.primary} />
              <Text style={[ss.aboutLabel, { color: C.text }]}>privacy policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={C.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={[ss.aboutRow, { borderBottomWidth: 1, borderBottomColor: C.border }]} onPress={handleExportEverything}>
            <View style={ss.rowCopy}>
              <Ionicons name="archive-outline" size={18} color={C.primary} />
              <Text style={[ss.aboutLabel, { color: C.text }]}>export full backup (json)</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={C.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={[ss.aboutRow, { borderBottomWidth: 1, borderBottomColor: C.border }]} onPress={handleExportCSV}>
            <View style={ss.rowCopy}>
              <Ionicons name="grid-outline" size={18} color={C.primary} />
              <Text style={[ss.aboutLabel, { color: C.text }]}>export csv files</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={C.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={[ss.aboutRow, { borderBottomWidth: 1, borderBottomColor: C.border }]} onPress={handleImportBackup}>
            <View style={ss.rowCopy}>
              <Ionicons name="refresh-circle-outline" size={18} color={C.primary} />
              <Text style={[ss.aboutLabel, { color: C.text }]}>restore from backup</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={C.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={[ss.aboutRow, { borderBottomWidth: 1, borderBottomColor: C.border }]} onPress={() => setShowImport(true)}>
            <View style={ss.rowCopy}>
              <Ionicons name="clipboard-outline" size={18} color={C.primary} />
              <Text style={[ss.aboutLabel, { color: C.text }]}>import from copied month</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={C.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={[ss.aboutRow, { borderBottomWidth: 1, borderBottomColor: C.border }]} onPress={() => Linking.openURL(PLAY_STORE_URL).catch(() => Alert.alert('', 'app not on store yet.'))}>
            <View style={ss.rowCopy}>
              <Ionicons name="star-outline" size={18} color={C.primary} />
              <Text style={[ss.aboutLabel, { color: C.text }]}>rate the app</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={C.textSecondary} />
          </TouchableOpacity>
          <View style={ss.aboutRow}>
            <View style={ss.rowCopy}>
              <Ionicons name="sparkles-outline" size={18} color={C.textSecondary} />
              <Text style={[ss.aboutLabel, { color: C.textSecondary }]}>version</Text>
            </View>
            <Text style={{ color: C.textSecondary }}>{APP_VERSION}</Text>
          </View>
        </View>
        </ScrollView>
      </ImageBackground>

      <Modal visible={showImport} animationType="slide" transparent onRequestClose={() => setShowImport(false)}>
        <View style={ss.modalOverlay}>
          <ImageBackground source={paperArt} style={[ss.modalCard, { backgroundColor: C.card, borderColor: C.border }]} imageStyle={ss.modalImage}>
            <View style={[ss.modalIcon, { backgroundColor: C.primaryLight }]}>
              <Ionicons name="journal-outline" size={24} color={C.primary} />
            </View>
            <Text style={[ss.modalTitle, { color: C.text }]}>import journal entries</Text>
            <Text style={[ss.modalDesc, { color: C.textSecondary }]}>
              paste the text you copied with "copy month". existing entries will not be overwritten.
            </Text>
            <TouchableOpacity
              style={[ss.pasteBtn, { borderColor: C.border }]}
              onPress={async () => {
                const text = await Clipboard.getStringAsync();
                if (text) setImportText(text);
              }}
            >
              <Ionicons name="clipboard-outline" size={16} color={C.textSecondary} />
              <Text style={[ss.pasteBtnText, { color: C.textSecondary }]}>paste from clipboard</Text>
            </TouchableOpacity>
            <TextInput
              style={[ss.importInput, { backgroundColor: C.background, borderColor: C.border, color: C.text }]}
              multiline
              placeholder="paste your copied month data here..."
              placeholderTextColor={C.textSecondary}
              value={importText}
              onChangeText={setImportText}
              textAlignVertical="top"
            />
            <View style={ss.modalBtns}>
              <TouchableOpacity style={[ss.modalCancelBtn, { borderColor: C.border }]} onPress={() => { setShowImport(false); setImportText(''); }}>
                <Text style={[ss.modalCancelText, { color: C.textSecondary }]}>cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[ss.modalImportBtn, { backgroundColor: C.accent }, importing && { opacity: 0.5 }]}
                onPress={handleImport}
                disabled={importing}
              >
                <Ionicons name="download-outline" size={17} color="#fff" />
                <Text style={[ss.btnText, { color: '#fff' }]}>{importing ? 'importing...' : 'import'}</Text>
              </TouchableOpacity>
            </View>
          </ImageBackground>
        </View>
      </Modal>
    </>
  );
}

const ss = StyleSheet.create({
  container: { flex: 1 },
  backgroundImage: { resizeMode: 'cover' },
  content: { paddingHorizontal: 20, paddingTop: 54, paddingBottom: 122 },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#5B3B2B',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  heroCard: {
    minHeight: 124,
    borderRadius: 30,
    borderWidth: 1,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#5B3B2B',
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
  },
  heroIcon: {
    width: 62,
    height: 62,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: 'Rounded', fontSize: 30, fontWeight: '900', letterSpacing: 0 },
  heroScript: { fontFamily: 'Story', fontSize: 28, lineHeight: 31, marginTop: 2, letterSpacing: 0 },
  sectionTitle: { fontFamily: 'Rounded', fontSize: 17, fontWeight: '900', letterSpacing: 0, marginTop: 26, marginBottom: 10 },
  sectionDesc: { fontFamily: 'Rounded', fontSize: 12, fontWeight: '800', letterSpacing: 0, marginBottom: 12, marginTop: -3 },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    elevation: 4,
    overflow: 'hidden',
    marginBottom: 8,
    shadowColor: '#5B3B2B',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  themeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15 },
  rowCopy: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  themeLabel: { fontFamily: 'Rounded', fontSize: 15, fontWeight: '900', letterSpacing: 0 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#5B3B2B',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  chipText: { fontFamily: 'Rounded', fontSize: 13, fontWeight: '900', letterSpacing: 0 },
  activeReminders: { fontFamily: 'Rounded', fontSize: 12, fontWeight: '800', letterSpacing: 0, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    elevation: 4,
    paddingHorizontal: 16,
    paddingVertical: 15,
    marginBottom: 8,
    shadowColor: '#5B3B2B',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  rowLabel: { fontFamily: 'Rounded', fontSize: 15, fontWeight: '900', letterSpacing: 0 },
  toggle: { width: 42, height: 26, borderRadius: 13, justifyContent: 'center', position: 'relative' },
  thumb: { position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', top: 3 },
  inputGroup: { marginBottom: 12 },
  input: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: 'Rounded',
    fontSize: 14,
    fontWeight: '800',
    borderWidth: 1,
  },
  btn: {
    minHeight: 52,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    elevation: 4,
    shadowColor: '#5B3B2B',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  btnText: { fontFamily: 'Rounded', fontSize: 15, fontWeight: '900', letterSpacing: 0 },
  aboutRow: { minHeight: 56, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  aboutLabel: { flexShrink: 1, fontFamily: 'Rounded', fontSize: 15, fontWeight: '900', letterSpacing: 0 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(46, 32, 46, 0.42)', justifyContent: 'flex-end', padding: 16 },
  modalCard: {
    borderRadius: 32,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 22,
    paddingBottom: 28,
    elevation: 10,
    shadowColor: '#5B3B2B',
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
  },
  modalImage: { resizeMode: 'cover', opacity: 0.95 },
  modalIcon: { width: 58, height: 58, borderRadius: 22, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 14 },
  modalTitle: { fontFamily: 'Rounded', fontSize: 24, fontWeight: '900', letterSpacing: 0, marginBottom: 8, textAlign: 'center' },
  modalDesc: { fontFamily: 'Rounded', fontSize: 14, fontWeight: '800', lineHeight: 20, marginBottom: 16, textAlign: 'center' },
  pasteBtn: { borderWidth: 1, borderRadius: 18, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginBottom: 12 },
  pasteBtnText: { fontFamily: 'Rounded', fontSize: 14, fontWeight: '900' },
  importInput: { borderWidth: 1, borderRadius: 20, padding: 14, fontFamily: 'Rounded', fontSize: 13, fontWeight: '800', height: 160, marginBottom: 16 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: { flex: 1, borderWidth: 1, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  modalCancelText: { fontFamily: 'Rounded', fontSize: 15, fontWeight: '900' },
  modalImportBtn: { flex: 1, borderRadius: 999, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
});
