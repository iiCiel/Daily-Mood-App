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
const PRODUCTIVITY_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const PRAYERS = [
  { key: 'fajr', label: 'fajr' },
  { key: 'dhuhr', label: 'dhuhr' },
  { key: 'asr', label: 'asr' },
  { key: 'maghrib', label: 'maghrib' },
  { key: 'isha', label: 'isha' },
];
import { getEntry, saveEntry, deleteEntry, getStreak } from '../src/db/database';
import { checkStreakMilestone } from '../src/notifications';
import { COLORS, MOODS } from '../src/constants/theme';
import { useTheme } from '../src/context/ThemeContext';
import MoodFace from '../src/components/MoodFace';
import MoodPicker from '../src/components/MoodPicker';
import PhotoGrid from '../src/components/PhotoGrid';

export default function EntryScreen() {
  const C = useTheme();
  const { date } = useLocalSearchParams();
  const [mood, setMood] = useState(null);
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState([]);
  const [hasExisting, setHasExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [promptIndex, setPromptIndex] = useState(() => Math.floor(Math.random() * PROMPTS.length));
  const [tags, setTags] = useState([]);
  const [gratitude, setGratitude] = useState(['', '', '']);
  const [productivity, setProductivity] = useState(null);
  const [prayers, setPrayers] = useState({});

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
        const g = data.gratitude || [];
        setGratitude([g[0] || '', g[1] || '', g[2] || '']);
        setProductivity(data.productivity || null);
        setPrayers(data.prayers || {});
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
      const filteredGratitude = gratitude.filter(g => g.trim());
      await saveEntry(date, mood, note, photos, tags, filteredGratitude, productivity, prayers);
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
        style={[styles.flex, { backgroundColor: C.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={[styles.flex, { backgroundColor: C.background }]}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Text style={[styles.backText, { color: C.text }]}>←</Text>
            </TouchableOpacity>
            {hasExisting && (
              <TouchableOpacity onPress={handleDelete}>
                <Text style={[styles.deleteText, { color: C.danger }]}>delete</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Date */}
          <View style={[styles.dateBlock, selectedMood && { backgroundColor: selectedMood.color + '15', borderRadius: 20, padding: 16, marginHorizontal: -8 }]}>
            {selectedMood && (
              <MoodFace color={selectedMood.color} moodValue={selectedMood.value} size={56} />
            )}
            <View>
              <Text style={[styles.weekday, { color: C.textSecondary }]}>{isToday ? 'today' : weekday.toLowerCase()}</Text>
              <Text style={[styles.monthDay, { color: C.text }]}>{monthDay}</Text>
              {!isToday && <Text style={[styles.year, { color: C.textSecondary }]}>{yearStr}</Text>}
            </View>
          </View>

          <MoodPicker selected={mood} onSelect={setMood} />

          {/* Productivity */}
          <View style={styles.tagSection}>
            <Text style={[styles.tagLabel, { color: C.textSecondary }]}>how productive were you?</Text>
            <View style={styles.productivityRow}>
              {PRODUCTIVITY_LEVELS.map((level) => {
                const sel = productivity === level;
                return (
                  <TouchableOpacity
                    key={level}
                    style={[styles.productivityPill, {
                      backgroundColor: sel ? C.accent : C.card,
                      borderColor: sel ? C.accent : C.border,
                    }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setProductivity(prev => prev === level ? null : level);
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.productivityText, { color: sel ? C.white : C.text }]}>{level}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Daily Prayers */}
          <View style={styles.tagSection}>
            <Text style={[styles.tagLabel, { color: C.textSecondary }]}>prayers</Text>
            <View style={styles.prayerRow}>
              {PRAYERS.map(({ key, label }) => {
                const sel = !!prayers[key];
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.tagChip, {
                      backgroundColor: sel ? C.text : C.card,
                      borderColor: sel ? C.text : C.border,
                    }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setPrayers(prev => ({ ...prev, [key]: !prev[key] }));
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.tagChipText, { color: sel ? C.white : C.textSecondary }]}>
                      {sel ? '✓ ' : ''}{label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Note */}
          <View style={styles.noteSection}>
            <View style={styles.promptRow}>
              <Text style={[styles.prompt, { color: C.textSecondary }]}>{PROMPTS[promptIndex]}</Text>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setPromptIndex((i) => (i + 1) % PROMPTS.length);
                }}
                style={styles.shuffleBtn}
              >
                <Text style={[styles.shuffleText, { color: C.border }]}>↻</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.noteInput, { backgroundColor: C.card, color: C.text }]}
              placeholder="write something..."
              placeholderTextColor={C.textSecondary}
              multiline
              value={note}
              onChangeText={setNote}
              textAlignVertical="top"
            />
            {note.length > 0 && (
              <Text style={[styles.charCount, { color: C.textSecondary }]}>{note.length} characters</Text>
            )}
          </View>

          <PhotoGrid photos={photos} onPhotosChange={setPhotos} />

          {/* Tags */}
          <View style={styles.tagSection}>
            <Text style={[styles.tagLabel, { color: C.textSecondary }]}>tags</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagScroll}>
              {ENTRY_TAGS.map(tag => {
                const sel = tags.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.tagChip, {
                      backgroundColor: sel ? C.text : C.card,
                      borderColor: sel ? C.text : C.border,
                    }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
                    }}
                  >
                    <Text style={[styles.tagChipText, { color: sel ? C.white : C.textSecondary }]}>{tag}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Gratitude */}
          <View style={styles.tagSection}>
            <Text style={[styles.tagLabel, { color: C.textSecondary }]}>grateful for</Text>
            {[0, 1, 2].map(i => (
              <View key={i} style={styles.gratitudeRow}>
                <Text style={[styles.gratitudeNum, { color: C.textSecondary }]}>{i + 1}.</Text>
                <TextInput
                  style={[styles.gratitudeInput, { backgroundColor: C.card, borderColor: C.border, color: C.text, flex: 1 }]}
                  placeholder={i === 0 ? 'something you appreciated today...' : i === 1 ? 'a person, moment, or thing...' : 'anything at all...'}
                  placeholderTextColor={C.textSecondary}
                  value={gratitude[i]}
                  onChangeText={val => { const g = [...gratitude]; g[i] = val; setGratitude(g); }}
                  returnKeyType={i < 2 ? 'next' : 'done'}
                />
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: C.accent }, saving && styles.saveBtnDisabled]}
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
  flex: { flex: 1 },
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
  },
  deleteText: {
    fontSize: 13,
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
    letterSpacing: 0.3,
  },
  monthDay: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  year: {
    fontSize: 13,
    marginTop: 1,
  },
  noteSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
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
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    minHeight: 110,
    lineHeight: 22,
    elevation: 1,
  },
  saveBtn: {
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  tagSection: { marginBottom: 16 },
  tagLabel: { fontSize: 12, letterSpacing: 0.5, marginBottom: 10 },
  charCount: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
    marginTop: 6,
  },
  gratitudeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  gratitudeNum: {
    fontSize: 14,
    fontWeight: '800',
    width: 20,
  },
  gratitudeInput: {
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14,
  },
  tagScroll: { flexDirection: 'row' },
  tagChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999, borderWidth: 1,
    marginRight: 8,
  },
  tagChipText: { fontSize: 13, letterSpacing: 0.2 },
  prayerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
  },
  productivityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
  },
  productivityPill: {
    flexBasis: '17%',
    flexGrow: 1,
    marginRight: '2%',
    marginBottom: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  productivityText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
