import React, { useEffect, useState } from 'react';
import {
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { getEntry, saveEntry, deleteEntry, getStreak } from '../src/db/database';
import { checkStreakMilestone } from '../src/notifications';
import { MOODS } from '../src/constants/theme';
import { useTheme } from '../src/context/ThemeContext';
import MoodFace from '../src/components/MoodFace';
import PhotoGrid from '../src/components/PhotoGrid';

const paperArt = require('../assets/illustrations/storybook-paper-rich.png');
const deleteCardArt = require('../assets/illustrations/dialogs/delete-habit-card.png');

const PROMPTS = [
  'What made today feel this way?',
  'What stood out today?',
  'What are you grateful for right now?',
  'What drained your energy today?',
  'What would make tomorrow better?',
  'What are you looking forward to?',
  "What's been on your mind lately?",
  'Did anything surprise you today?',
  'What did you do for yourself today?',
  "What's one small win from today?",
  'Who or what made you smile today?',
  "What's something you want to let go of?",
  'How did your body feel today?',
  'What are you proud of today?',
  'What challenged you today?',
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

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    loadEntry();
  }, [date]);

  async function loadEntry() {
    if (!date) return;
    try {
      const data = await getEntry(date);
      if (!data) {
        setMood(null);
        setNote('');
        setPhotos([]);
        setTags([]);
        setGratitude(['', '', '']);
        setProductivity(null);
        setPrayers({});
        setHasExisting(false);
        return;
      }

      setMood(data.mood);
      setNote(data.note || '');
      setPhotos(data.photos?.map((p) => p.uri) || []);
      setTags(data.tags || []);
      const g = data.gratitude || [];
      setGratitude([g[0] || '', g[1] || '', g[2] || '']);
      setProductivity(data.productivity || null);
      setPrayers(data.prayers || {});
      setHasExisting(true);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleSave() {
    if (!mood) {
      Alert.alert('Pick a mood', 'How were you feeling?');
      return;
    }

    setSaving(true);
    try {
      const filteredGratitude = gratitude.filter((g) => g.trim());
      await saveEntry(date, mood, note, photos, tags, filteredGratitude, productivity, prayers);
      setHasExisting(true);
      try {
        const streak = await getStreak();
        await checkStreakMilestone(streak);
      } catch {}
      router.back();
    } catch (e) {
      Alert.alert('Error', 'Failed to save. Please try again.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    await deleteEntry(date);
    setShowDelete(false);
    router.back();
  }

  const dateObj = new Date(`${date}T00:00:00`);
  const isToday = date === todayStr();
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
        <ImageBackground source={paperArt} style={styles.background} imageStyle={styles.backgroundImage}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={[styles.iconButton, { backgroundColor: C.card, borderColor: C.border }]}>
                <Ionicons name="chevron-back" size={19} color={C.text} />
              </TouchableOpacity>
              {hasExisting && (
                <TouchableOpacity onPress={() => setShowDelete(true)} style={[styles.iconButton, { backgroundColor: C.primaryLight, borderColor: 'transparent' }]}>
                  <Ionicons name="trash-outline" size={18} color={C.primary} />
                </TouchableOpacity>
              )}
            </View>

            <View style={[styles.heroCard, { backgroundColor: C.card, borderColor: C.border }]}>
              <View style={styles.dateBlock}>
                <View style={[styles.moodPreview, { backgroundColor: selectedMood ? `${selectedMood.color}24` : C.primaryLight }]}>
                  {selectedMood ? (
                    <MoodFace color={selectedMood.color} moodValue={selectedMood.value} size={72} />
                  ) : (
                    <Ionicons name="sparkles-outline" size={28} color={C.primary} />
                  )}
                </View>
                <View style={styles.dateCopy}>
                  <Text style={[styles.weekday, { color: C.textSecondary }]}>{isToday ? 'Today' : weekday}</Text>
                  <Text style={[styles.monthDay, { color: C.text }]}>{monthDay}</Text>
                  {!isToday && <Text style={[styles.year, { color: C.textSecondary }]}>{yearStr}</Text>}
                </View>
              </View>
              <Text style={[styles.scriptTitle, { color: C.text }]}>write your little story</Text>
            </View>

            <SectionCard C={C} title="How did it feel?">
              <View style={styles.moodRow}>
                {MOODS.map((item) => {
                  const selected = mood === item.value;
                  return (
                    <TouchableOpacity
                      key={item.value}
                      style={[styles.moodOption, { borderColor: selected ? item.color : C.border, backgroundColor: selected ? `${item.color}22` : 'rgba(255,255,255,0.68)' }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setMood(item.value);
                      }}
                      activeOpacity={0.78}
                    >
                      <MoodFace color={item.color} moodValue={item.value} size={48} />
                      <Text style={[styles.moodLabel, { color: selected ? C.text : C.textSecondary }]}>{item.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </SectionCard>

            <SectionCard C={C} title="Journal">
              <View style={styles.promptRow}>
                <Text style={[styles.prompt, { color: C.textSecondary }]}>{PROMPTS[promptIndex]}</Text>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setPromptIndex((i) => (i + 1) % PROMPTS.length);
                  }}
                  style={[styles.shuffleBtn, { backgroundColor: C.primaryLight }]}
                >
                  <Ionicons name="shuffle-outline" size={18} color={C.primary} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.noteInput, { backgroundColor: 'rgba(255,255,255,0.78)', borderColor: C.border, color: C.text }]}
                placeholder="write something..."
                placeholderTextColor={C.textSecondary}
                multiline
                value={note}
                onChangeText={setNote}
                textAlignVertical="top"
              />
              {note.length > 0 && <Text style={[styles.charCount, { color: C.textSecondary }]}>{note.length} characters</Text>}
            </SectionCard>

            <SectionCard C={C} title="How productive were you?">
              <View style={styles.productivityRow}>
                {PRODUCTIVITY_LEVELS.map((level) => {
                  const selected = productivity === level;
                  return (
                    <TouchableOpacity
                      key={level}
                      style={[styles.productivityPill, { backgroundColor: selected ? C.accent : 'rgba(255,255,255,0.68)', borderColor: selected ? C.accent : C.border }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setProductivity((prev) => (prev === level ? null : level));
                      }}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.productivityText, { color: selected ? C.white : C.text }]}>{level}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </SectionCard>

            <SectionCard C={C} title="Prayers">
              <View style={styles.wrapRow}>
                {PRAYERS.map(({ key, label }) => {
                  const selected = !!prayers[key];
                  return (
                    <Chip
                      key={key}
                      C={C}
                      selected={selected}
                      label={`${selected ? '✓ ' : ''}${label}`}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setPrayers((prev) => ({ ...prev, [key]: !prev[key] }));
                      }}
                    />
                  );
                })}
              </View>
            </SectionCard>

            <SectionCard C={C} title="Photos">
              <PhotoGrid photos={photos} onPhotosChange={setPhotos} showLabel={false} />
            </SectionCard>

            <SectionCard C={C} title="Tags">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagScroll}>
                {ENTRY_TAGS.map((tag) => (
                  <Chip
                    key={tag}
                    C={C}
                    selected={tags.includes(tag)}
                    label={tag}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
                    }}
                  />
                ))}
              </ScrollView>
            </SectionCard>

            <SectionCard C={C} title="Grateful For">
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.gratitudeRow}>
                  <Text style={[styles.gratitudeNum, { color: C.textSecondary }]}>{i + 1}.</Text>
                  <TextInput
                    style={[styles.gratitudeInput, { backgroundColor: 'rgba(255,255,255,0.78)', borderColor: C.border, color: C.text, flex: 1 }]}
                    placeholder={i === 0 ? 'something you appreciated today...' : i === 1 ? 'a person, moment, or thing...' : 'anything at all...'}
                    placeholderTextColor={C.textSecondary}
                    value={gratitude[i]}
                    onChangeText={(val) => {
                      const next = [...gratitude];
                      next[i] = val;
                      setGratitude(next);
                    }}
                    returnKeyType={i < 2 ? 'next' : 'done'}
                  />
                </View>
              ))}
            </SectionCard>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: C.accent }, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              <Text style={styles.saveBtnText}>{saving ? 'saving...' : hasExisting ? 'update entry' : 'save entry'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </ImageBackground>
      </KeyboardAvoidingView>

      <Modal visible={showDelete} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.confirmOverlay}>
          <TouchableOpacity style={styles.confirmBackdrop} onPress={() => setShowDelete(false)} />
          <ImageBackground source={deleteCardArt} style={styles.confirmCard} imageStyle={styles.confirmCardImage}>
            <Text style={[styles.confirmTitle, { color: C.text }]}>Delete entry?</Text>
            <Text style={[styles.confirmBody, { color: C.textSecondary }]}>{monthDay}</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={[styles.confirmButton, styles.cancelButton, { backgroundColor: C.white, borderColor: C.border }]} onPress={() => setShowDelete(false)}>
                <Text style={[styles.cancelText, { color: C.textSecondary }]}>Keep</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmButton, { backgroundColor: C.primary }]} onPress={handleDelete}>
                <Text style={styles.deleteActionText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </ImageBackground>
        </View>
      </Modal>
    </>
  );
}

function SectionCard({ C, title, children }) {
  return (
    <View style={[styles.sectionCard, { backgroundColor: 'rgba(255,253,251,0.84)', borderColor: C.border }]}>
      <Text style={[styles.sectionTitle, { color: C.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function Chip({ C, selected, label, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.tagChip, { backgroundColor: selected ? C.text : 'rgba(255,255,255,0.7)', borderColor: selected ? C.text : C.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.tagChipText, { color: selected ? C.white : C.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  background: { flex: 1 },
  backgroundImage: { resizeMode: 'cover' },
  content: { paddingHorizontal: 20, paddingTop: 54, paddingBottom: 36 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8A6A86',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 30,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#8A6A86',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  dateBlock: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  moodPreview: { width: 86, height: 86, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  dateCopy: { flex: 1 },
  weekday: { fontFamily: 'Rounded', fontSize: 13, fontWeight: '900' },
  monthDay: { fontFamily: 'Rounded', fontSize: 28, fontWeight: '900' },
  year: { fontFamily: 'Rounded', fontSize: 13, fontWeight: '800', marginTop: 1 },
  scriptTitle: { fontFamily: 'Story', fontSize: 31, textAlign: 'center', marginTop: 12 },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#8A6A86',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  sectionTitle: { fontFamily: 'Rounded', fontSize: 16, fontWeight: '900', marginBottom: 12 },
  moodRow: { flexDirection: 'row', gap: 7 },
  moodOption: { flex: 1, alignItems: 'center', borderWidth: 1, borderRadius: 18, paddingVertical: 9, minHeight: 86 },
  moodLabel: { fontFamily: 'Rounded', fontSize: 10, fontWeight: '900', marginTop: 3 },
  promptRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  prompt: { fontFamily: 'Rounded', fontSize: 13, fontWeight: '800', flex: 1 },
  shuffleBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  noteInput: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    fontFamily: 'Rounded',
    fontWeight: '800',
    fontSize: 15,
    minHeight: 132,
    lineHeight: 22,
  },
  charCount: { fontFamily: 'Rounded', fontSize: 11, fontWeight: '800', textAlign: 'right', marginTop: 6 },
  productivityRow: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 },
  productivityPill: {
    flexBasis: '17%',
    flexGrow: 1,
    marginRight: '2%',
    marginBottom: 8,
    paddingVertical: 12,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
  },
  productivityText: { fontFamily: 'Rounded', fontSize: 16, fontWeight: '900' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 },
  tagScroll: { flexDirection: 'row' },
  tagChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, marginRight: 8 },
  tagChipText: { fontFamily: 'Rounded', fontSize: 13, fontWeight: '900' },
  gratitudeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  gratitudeNum: { fontFamily: 'Rounded', fontSize: 14, fontWeight: '800', width: 20 },
  gratitudeInput: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: 'Rounded',
    fontWeight: '800',
    fontSize: 14,
  },
  saveBtn: {
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#A5664E',
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#FFFFFF', fontFamily: 'Rounded', fontSize: 15, fontWeight: '900' },
  confirmOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(39,42,75,0.28)', padding: 22 },
  confirmBackdrop: { ...StyleSheet.absoluteFillObject },
  confirmCard: { width: '88%', maxWidth: 320, minHeight: 250, paddingHorizontal: 24, paddingTop: 46, paddingBottom: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  confirmCardImage: { resizeMode: 'stretch', borderRadius: 30 },
  confirmTitle: { fontFamily: 'Rounded', fontSize: 24, fontWeight: '900', textAlign: 'center' },
  confirmBody: { fontFamily: 'Rounded', fontSize: 15, fontWeight: '800', textAlign: 'center', marginTop: 8, minHeight: 34 },
  confirmActions: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 20 },
  confirmButton: { flex: 1, borderRadius: 18, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  cancelButton: { borderWidth: 1 },
  cancelText: { fontFamily: 'Rounded', fontWeight: '900', fontSize: 14 },
  deleteActionText: { color: '#FFFFFF', fontFamily: 'Rounded', fontWeight: '900', fontSize: 14 },
});
