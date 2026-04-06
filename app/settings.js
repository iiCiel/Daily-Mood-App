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
import { Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initSupabase, syncEntries } from '../src/lib/supabase';
import { getUnsyncedEntries, markSynced } from '../src/db/database';
import { COLORS } from '../src/constants/theme';

const STORAGE_KEYS = {
  SUPABASE_URL: 'supabase_url',
  SUPABASE_KEY: 'supabase_anon_key',
};

export default function SettingsScreen() {
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings();
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
      Alert.alert('Saved', 'Supabase configuration saved.');
    } catch (e) {
      Alert.alert('Error', 'Failed to save settings.');
    }
  }

  async function handleSync() {
    if (!supabaseUrl || !supabaseKey) {
      Alert.alert('Not configured', 'Please enter your Supabase URL and key first.');
      return;
    }
    setSyncing(true);
    try {
      const result = await syncEntries(getUnsyncedEntries, markSynced);
      if (result.success) {
        Alert.alert('Synced!', `${result.synced} entries synced to the cloud.`);
      } else {
        Alert.alert('Sync failed', result.error);
      }
    } catch (e) {
      Alert.alert('Error', 'Sync failed. Check your connection and config.');
    } finally {
      setSyncing(false);
    }
  }

  async function handleClearConfig() {
    Alert.alert('Clear Config', 'Remove Supabase configuration?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
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
      <Stack.Screen options={{ title: 'Settings' }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cloud Sync</Text>
          <Text style={styles.sectionDescription}>
            Connect to Supabase to sync your mood entries across devices. Your data
            is stored locally first - sync is optional.
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Supabase URL</Text>
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
          <Text style={styles.inputLabel}>Anon Key</Text>
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

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Configuration</Text>
        </TouchableOpacity>

        {saved && (
          <TouchableOpacity
            style={[styles.syncButton, syncing && styles.buttonDisabled]}
            onPress={handleSync}
            disabled={syncing}
          >
            <Text style={styles.syncButtonText}>
              {syncing ? 'Syncing...' : 'Sync Now'}
            </Text>
          </TouchableOpacity>
        )}

        {saved && (
          <TouchableOpacity style={styles.clearButton} onPress={handleClearConfig}>
            <Text style={styles.clearButtonText}>Clear Configuration</Text>
          </TouchableOpacity>
        )}

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>How to set up sync</Text>
          <Text style={styles.infoText}>
            1. Create a free Supabase project at supabase.com{'\n'}
            2. Create an "entries" table with columns: id (text, PK), date (text),
            mood (int4), note (text), created_at (timestamptz), updated_at
            (timestamptz){'\n'}
            3. Copy your project URL and anon key from Settings {'>'} API{'\n'}
            4. Paste them above and hit Save
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
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  syncButton: {
    backgroundColor: COLORS.success,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  syncButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  clearButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.danger,
    marginBottom: 24,
  },
  clearButtonText: {
    color: COLORS.danger,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  infoBox: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 14,
    padding: 18,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 22,
  },
});
