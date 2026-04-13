import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';

const PROMPTS = [
  "what made today feel this way?",
  "what's one thing that stood out today?",
  "what are you grateful for right now?",
  "what drained your energy today?",
  "what would make tomorrow better?",
  "what are you looking forward to?",
  "what's been on your mind lately?",
  "did anything surprise you today?",
  "what did you do for yourself today?",
  "what's one small win from today?",
  "who or what made you smile today?",
  "what's something you'd like to let go of?",
  "how did your body feel today?",
  "what are you proud of today?",
  "what challenged you today?",
];
const ENTRY_TAGS = ['work', 'health', 'social', 'family', 'sleep', 'exercise', 'food', 'learning', 'creative', 'travel'];
import { getEntry, saveEntry, deleteEntry, getStreak } from '../src/db/database';
import { checkStreakMilestone } from '../src/notifications';
import { COLORS, MOODS } from '../src/constants/theme';
import { useTheme } from '../src/context/ThemeContext';
import MoodFace from '../src/components/MoodFace';
import MoodPicker from '../src/components/MoodPicker';
import PhotoGrid from '../src/components/PhotoGrid';

export default function EntryScreen() {
  const COLORS = useTheme();
  const { date } = useLocalSearchParams();
  const [mood, setMood] = useState(null);
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState([]);
  const [hasExisting, setHasExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [promptIndex, setPromptIndex] = useState(() => Math.floor(Math.random() * PROMPTS.length));
  const [tags, setTags] = useState([]);

  useEffect(() => {
    loadEntry();
  }, [date]);

  async function loadEntry() {
    if (!date) return;
    try {
      const data = await getEntry(date);
      if (data) {
        setMood(data.mood);
        setNote(data.note || '');
        setPhotos(data.photos?.map((p) => p.uri) || []);
        setTags(data.tags || []);
        setHasExisting(true);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleSave() {
    if (!mood) {
      Alert.alert('pick a mood', 'how were you feeling?');
      return;
    }
    setSaving(true);
    try {
      await saveEntry(date, mood, note, photos, tags);
      setHasExisting(true);
      try {
        const streak = await getStreak();
        await checkStreakMilestone(streak);
      } catch (e) {
        // don't block navigation if streak/notification fails
      }
      router.back();
    } catch (e) {
      Alert.alert('error', 'failed to save. please try again.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    Alert.alert('delete entry', 'are you sure?', [
      { text: 'cancel', style: 'cancel' },
      {
        text: 'delete',
        style: 'destructive',
        onPress: async () => {
          await deleteEntry(date);
          router.back();
        },
      },
    ]);
  }

  // Format the date nicely
  const dateObj = new Date(date + 'T00:00:00');
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const isToday = date === todayStr;

  const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const monthDay = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const yearStr = dateObj.getFullYear();

  const selectedMood = mood ? MOODS.find((m) => m.value === mood) : null;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={[styles.flex, { backgroundColor: COLORS.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={[styles.flex, { backgroundColor: COLORS.background }]}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Text style={[styles.backText, { color: COLORS.text }]}>←</Text>
            </TouchableOpacity>
            {hasExisting && (
              <TouchableOpacity onPress={handleDelete}>
                <Text style={[styles.deleteText, { color: COLORS.danger }]}>delete</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Date */}
          <View style={styles.dateBlock}>
            {selectedMood && (
              <MoodFace color={selectedMood.color} moodValue={selectedMood.value} size={56} />
            )}
            <View>
              <Text style={[styles.weekday, { color: COLORS.textSecondary }]}>{isToday ? 'today' : weekday.toLowerCase()}</Text>
              <Text style={[styles.monthDay, { color: COLORS.text }]}>{monthDay}</Text>
              {!isToday && <Text style={[styles.year, { color: COLORS.textSecondary }]}>{yearStr}</Text>}
            </View>
          </View>

          <MoodPicker selected={mood} onSelect={setMood} />

          {/* Note */}
          <View style={styles.noteSection}>
            <View style={styles.promptRow}>
              <Text style={[styles.prompt, { color: COLORS.textSecondary }]}>{PROMPTS[promptIndex]}</Text>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setPromptIndex((i) => (i + 1) % PROMPTS.length);
                }}
                style={styles.shuffleBtn}
              >
                <Text style={[styles.shuffleText, { color: COLORS.border }]}>↻</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.noteInput, { backgroundColor: COLORS.card, borderColor: COLORS.border, color: COLORS.text }]}
              placeholder="write something..."
              placeholderTextColor={COLORS.textSecondary}
              multiline
              value={note}
              onChangeText={setNote}
              textAlignVertical="top"
            />
          </View>

          <PhotoGrid photos={photos} onPhotosChange={setPhotos} />

          {/* Tags */}
          <View style={styles.tagSection}>
            <Text style={[styles.tagLabel, { color: COLORS.textSecondary }]}>tags</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagScroll}>
              {ENTRY_TAGS.map(tag => {
                const sel = tags.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.tagChip, {
                      backgroundColor: sel ? COLORS.text : COLORS.card,
                      borderColor: sel ? COLORS.text : COLORS.border,
                    }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
                    }}
                  >
                    <Text style={[styles.tagChipText, { color: sel ? COLORS.white : COLORS.textSecondary }]}>{tag}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: COLORS.text }, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            <Text style={styles.saveBtnText}>
              {saving ? 'saving...' : hasExisting ? 'update' : 'save'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  content: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  backBtn: {
    padding: 4,
  },
  backText: {
    fontSize: 24,
    color: COLORS.text,
  },
  deleteText: {
    fontSize: 13,
    color: COLORS.danger,
    letterSpacing: 0.3,
  },
  dateBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 32,
  },
  weekday: {
    fontSize: 13,
    color: COLORS.textSecondary,
    letterSpacing: 0.3,
  },
  monthDay: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  year: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  noteSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  promptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  prompt: {
    fontSize: 13,
    letterSpacing: 0.3,
    flex: 1,
    fontStyle: 'italic',
  },
  shuffleBtn: {
    padding: 4,
    marginLeft: 8,
  },
  shuffleText: {
    fontSize: 18,
  },
  noteInput: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    color: COLORS.text,
    minHeight: 110,
    lineHeight: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  saveBtn: {
    backgroundColor: COLORS.text,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  tagSection: { marginBottom: 16 },
  tagLabel: { fontSize: 12, letterSpacing: 0.5, marginBottom: 10 },
  tagScroll: { flexDirection: 'row' },
  tagChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999, borderWidth: 1,
    marginRight: 8,
  },
  tagChipText: { fontSize: 13, letterSpacing: 0.2 },
});
