import React, { useCallback, useState } from 'react';
import { ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/context/ThemeContext';
import HabitIcon from '../../src/components/HabitIcon';
import MoodFace from '../../src/components/MoodFace';
import { MOODS } from '../../src/constants/theme';
import { getHabits, getCompletionsForDate, toggleCompletion } from '../../src/db/habitDatabase';
import { getSessionsForDay } from '../../src/db/focusDatabase';
import { getEntry, saveEntry } from '../../src/db/database';
import StorybookHeroFade from '../../src/components/StorybookHeroFade';

const catsArt = require('../../assets/illustrations/storybook-cats.png');
const paperArt = require('../../assets/illustrations/storybook-paper-rich.png');

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function clockLabel() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function DashboardScreen() {
  const C = useTheme();
  const today = todayStr();
  const [habits, setHabits] = useState([]);
  const [completed, setCompleted] = useState(new Set());
  const [sessions, setSessions] = useState([]);
  const [todayMood, setTodayMood] = useState(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    load();
  }, []));

  async function load() {
    const [h, done, focusSessions, moodEntry] = await Promise.all([
      getHabits(),
      getCompletionsForDate(today),
      getSessionsForDay(today),
      getEntry(today),
    ]);
    setHabits(h);
    setCompleted(done);
    setSessions(focusSessions);
    setTodayMood(moodEntry);
    setLoading(false);
  }

  async function handleQuickMood(value) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const existing = await getEntry(today);
    await saveEntry(today, value, existing?.note || '', existing?.photos?.map((p) => p.uri) || [], existing?.tags || [], existing?.gratitude || []);
    setTodayMood(await getEntry(today));
  }

  async function toggleHabit(id) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleCompletion(id, today);
    setCompleted(await getCompletionsForDate(today));
  }

  const moodObj = todayMood ? MOODS.find((m) => m.value === todayMood.mood) : null;
  const doneCount = habits.filter((h) => completed.has(h.id)).length;
  const focusMinutes = sessions.filter((s) => s.completed).reduce((sum, s) => sum + s.duration, 0);

  if (loading) {
    return <View style={[styles.loading, { backgroundColor: C.background }]}><Text style={[styles.body, { color: C.textSecondary }]}>loading...</Text></View>;
  }

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView style={styles.pageScroll} contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
        <ImageBackground source={catsArt} style={styles.heroImage} imageStyle={styles.heroImageInner}>
          <StorybookHeroFade />
          <View style={styles.topBar}>
            <Text style={[styles.smallTime, { color: C.text }]}>9:41</Text>
            <TouchableOpacity style={[styles.circleBtn, { backgroundColor: C.white }]} onPress={() => router.push('/(tabs)/settings')}>
              <Ionicons name="close" size={16} color={C.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.heroCopy}>
            <Text style={[styles.time, { color: C.text }]}>{clockLabel()}</Text>
            <Text style={[styles.script, { color: C.text }]}>You can do it beautiful</Text>
          </View>

          <View style={[styles.player, { backgroundColor: C.white }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.playerTitle, { color: C.text }]}>Daily Story</Text>
              <Text style={[styles.playerSub, { color: C.textSecondary }]}>
                {habits.length - doneCount > 0 ? `${habits.length - doneCount} habits left` : 'soft day complete'}
              </Text>
            </View>
            <TouchableOpacity style={[styles.play, { backgroundColor: C.primaryLight }]} onPress={() => router.push('/(tabs)/focus')}>
              <Ionicons name="play" size={16} color={C.primary} />
            </TouchableOpacity>
          </View>
        </ImageBackground>

        <ImageBackground source={paperArt} style={[styles.sheet, styles.sheetContent]} imageStyle={styles.sheetImage}>
          <View pointerEvents="none" style={styles.sheetDecor}>
            <View style={[styles.sheetBlobLarge, { backgroundColor: C.lavender }]} />
            <View style={[styles.sheetBlobSmall, { backgroundColor: C.peach }]} />
            <Ionicons name="musical-note" size={24} color={C.primary} style={styles.decorNoteOne} />
            <Ionicons name="sparkles-outline" size={21} color={C.teal} style={styles.decorNoteTwo} />
          </View>
          <View style={styles.storyRow}>
            <StoryTile C={C} label="Mood" value={moodObj?.label || 'Pick'} tone={moodObj?.color || C.primary} icon="happy-outline" onPress={() => router.push('/(tabs)/mood')} />
            <StoryTile C={C} label="Focus" value={`${focusMinutes || 0}m`} tone={C.teal} icon="musical-notes-outline" onPress={() => router.push('/(tabs)/focus')} />
          </View>

          <Text style={[styles.sectionTitle, { color: C.text }]}>How does today feel?</Text>
          <View style={styles.moodRow}>
            {MOODS.map((mood) => (
              <TouchableOpacity key={mood.value} style={[styles.moodButton, { backgroundColor: C.card, borderColor: todayMood?.mood === mood.value ? mood.color : C.border }]} onPress={() => handleQuickMood(mood.value)}>
                <MoodFace color={mood.color} moodValue={mood.value} size={38} />
                <Text style={[styles.moodLabel, { color: C.textSecondary }]}>{mood.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { color: C.text }]}>Tiny habits</Text>
          <View style={styles.habitStack}>
            {habits.length === 0 ? (
              <TouchableOpacity style={[styles.emptyCard, { backgroundColor: C.card, borderColor: C.border }]} onPress={() => router.push('/(tabs)/habits')}>
                <Text style={[styles.body, { color: C.textSecondary }]}>Add one soft routine for today</Text>
              </TouchableOpacity>
            ) : habits.slice(0, 4).map((habit) => {
              const done = completed.has(habit.id);
              return (
                <TouchableOpacity key={habit.id} style={[styles.habitCard, { backgroundColor: C.card, borderColor: done ? habit.color : C.border }]} onPress={() => toggleHabit(habit.id)}>
                  <View style={[styles.habitIcon, { backgroundColor: done ? habit.color : C.primaryLight }]}>
                    <HabitIcon name={habit.emoji} size={18} color={done ? C.white : habit.color} />
                  </View>
                  <Text style={[styles.habitTitle, { color: C.text }, done && { textDecorationLine: 'line-through', color: C.textSecondary }]}>{habit.title}</Text>
                  <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={done ? habit.color : C.textSecondary} />
                </TouchableOpacity>
              );
            })}
          </View>
        </ImageBackground>
      </ScrollView>
    </View>
  );
}

function StoryTile({ C, label, value, tone, icon, onPress }) {
  return (
    <TouchableOpacity style={[styles.storyTile, { backgroundColor: C.card, borderColor: C.border }]} onPress={onPress} activeOpacity={0.76}>
      <Ionicons name={icon} size={18} color={tone} />
      <Text style={[styles.tileValue, { color: tone }]}>{value}</Text>
      <Text style={[styles.tileLabel, { color: C.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pageScroll: { flex: 1 },
  pageContent: { paddingBottom: 112 },
  heroImage: { height: 560, paddingTop: 56, paddingHorizontal: 24, justifyContent: 'space-between' },
  heroImageInner: { resizeMode: 'cover' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  smallTime: { fontFamily: 'Rounded', fontSize: 12, fontWeight: '900' },
  circleBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  heroCopy: { alignItems: 'center', marginTop: 10 },
  time: { fontFamily: 'Rounded', fontSize: 48, fontWeight: '900' },
  script: { fontFamily: 'Story', fontSize: 40, lineHeight: 44, textAlign: 'center', marginTop: 10, maxWidth: 270 },
  player: { minHeight: 58, borderRadius: 14, padding: 10, marginBottom: 74, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#7282BF', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  playerTitle: { fontFamily: 'Rounded', fontSize: 13, fontWeight: '900' },
  playerSub: { fontFamily: 'Rounded', fontSize: 10, marginTop: 2 },
  play: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sheet: {
    marginTop: 0,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    overflow: 'hidden',
  },
  sheetImage: {
    resizeMode: 'cover',
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 28,
  },
  sheetDecor: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  sheetBlobLarge: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    right: -72,
    top: 36,
    opacity: 0.45,
  },
  sheetBlobSmall: {
    position: 'absolute',
    width: 118,
    height: 118,
    borderRadius: 59,
    left: -42,
    top: 185,
    opacity: 0.5,
  },
  decorNoteOne: {
    position: 'absolute',
    right: 34,
    top: 178,
    opacity: 0.28,
    transform: [{ rotate: '12deg' }],
  },
  decorNoteTwo: {
    position: 'absolute',
    left: 34,
    top: 86,
    opacity: 0.22,
    transform: [{ rotate: '-10deg' }],
  },
  storyRow: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  storyTile: { flex: 1, borderRadius: 20, borderWidth: 1, padding: 13, minHeight: 106, justifyContent: 'space-between', shadowColor: '#7D88B8', shadowOpacity: 0.11, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  tileValue: { fontFamily: 'Rounded', fontSize: 18, fontWeight: '900' },
  tileLabel: { fontFamily: 'Rounded', fontSize: 11, fontWeight: '800' },
  sectionTitle: { fontFamily: 'Rounded', fontSize: 18, fontWeight: '900', marginBottom: 12 },
  moodRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  moodButton: { flex: 1, alignItems: 'center', borderRadius: 18, borderWidth: 1, paddingVertical: 10, gap: 6 },
  moodLabel: { fontFamily: 'Rounded', fontSize: 9, fontWeight: '900' },
  habitStack: { gap: 10 },
  habitCard: { minHeight: 62, borderRadius: 20, borderWidth: 1, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 12 },
  habitIcon: { width: 40, height: 40, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  habitTitle: { flex: 1, fontFamily: 'Rounded', fontSize: 15, fontWeight: '900' },
  emptyCard: { borderRadius: 20, borderWidth: 1, padding: 18 },
  body: { fontFamily: 'Rounded', fontSize: 14, fontWeight: '800' },
});
