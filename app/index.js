import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import MoodPicker from '../src/components/MoodPicker';
import PhotoGrid from '../src/components/PhotoGrid';
import { saveEntry, getEntry } from '../src/db/database';
import { COLORS } from '../src/constants/theme';

function getTodayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function TodayScreen() {
  const [mood, setMood] = useState(null);
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);
  const today = getTodayDate();

  useFocusEffect(
    useCallback(() => {
      loadToday();
    }, [])
  );

  async function loadToday() {
    try {
      const entry = await getEntry(today);
      if (entry) {
        setMood(entry.mood);
        setNote(entry.note || '');
        setPhotos(entry.photos?.map((p) => p.uri) || []);
        setHasExisting(true);
      } else {
        setMood(null);
        setNote('');
        setPhotos([]);
        setHasExisting(false);
      }
    } catch (e) {
      console.error('Failed to load today:', e);
    }
  }

  async function handleSave() {
    if (!mood) {
      Alert.alert('Pick a mood', 'How are you feeling today?');
      return;
    }
    setSaving(true);
    try {
      await saveEntry(today, mood, note, photos);
      setHasExisting(true);
      Alert.alert('Saved!', 'Your mood entry has been saved.');
    } catch (e) {
      Alert.alert('Error', 'Failed to save. Please try again.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  const dateDisplay = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Today</Text>
            <Text style={styles.date}>{dateDisplay}</Text>
          </View>
          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => router.push('/history')}
          >
            <Text style={styles.historyText}>History</Text>
          </TouchableOpacity>
        </View>

        <MoodPicker selected={mood} onSelect={setMood} />

        <View style={styles.noteSection}>
          <Text style={styles.label}>What happened today?</Text>
          <TextInput
            style={styles.noteInput}
            placeholder="Write about your day..."
            placeholderTextColor={COLORS.textSecondary}
            multiline
            value={note}
            onChangeText={setNote}
            textAlignVertical="top"
          />
        </View>

        <PhotoGrid photos={photos} onPhotosChange={setPhotos} />

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          <Text style={styles.saveText}>
            {saving ? 'Saving...' : hasExisting ? 'Update Entry' : 'Save Entry'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingsLink}
          onPress={() => router.push('/settings')}
        >
          <Text style={styles.settingsText}>Settings</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
    marginTop: 8,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
  },
  date: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  historyButton: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  historyText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  noteSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  noteInput: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
    minHeight: 120,
    lineHeight: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '700',
  },
  settingsLink: {
    alignItems: 'center',
    marginTop: 20,
  },
  settingsText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
});
