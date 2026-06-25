import React, { useCallback, useState } from 'react';
import { ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { getEntriesForMonth, getMonthStats, getStreak, exportMonthAsText } from '../../src/db/database';
import { MOODS } from '../../src/constants/theme';
import { useTheme } from '../../src/context/ThemeContext';
import GiftPhotoFrame from '../../src/components/GiftPhotoFrame';
import MoodFace from '../../src/components/MoodFace';
import StorybookHeroFade from '../../src/components/StorybookHeroFade';
import { getStoryHeroHeight, STORY_TAB_BOTTOM_PADDING } from '../../src/constants/storybookLayout';

const catArt = require('../../assets/illustrations/storybook-calm-cat.png');
const paperArt = require('../../assets/illustrations/storybook-paper-rich.png');

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function MoodScreen() {
  const C = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState(null);
  const [streak, setStreak] = useState(0);

  useFocusEffect(useCallback(() => {
    load();
  }, [year, month]));

  async function load() {
    const [monthEntries, monthStats, currentStreak] = await Promise.all([
      getEntriesForMonth(year, month),
      getMonthStats(year, month),
      getStreak(),
    ]);
    setEntries(monthEntries);
    setStats(monthStats);
    setStreak(currentStreak);
  }

  async function copyMonth() {
    const text = await exportMonthAsText(year, month);
    if (text) await Clipboard.setStringAsync(text);
  }

  const entryMap = Object.fromEntries(entries.map((entry) => [parseInt(entry.date.split('-')[2], 10), entry]));
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const today = todayStr();
  const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long' });
  const heroHeight = getStoryHeroHeight(screenHeight, { min: 520, max: 570, ratio: 0.57 });

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView style={styles.pageScroll} contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
        <ImageBackground source={catArt} style={[styles.hero, { height: heroHeight }]} imageStyle={styles.heroImage}>
          <StorybookHeroFade />
          <View style={styles.topBar}>
            <TouchableOpacity style={[styles.circleBtn, { backgroundColor: C.white }]} onPress={copyMonth}>
              <Ionicons name="copy-outline" size={16} color={C.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.affirmation}>
            <Text style={[styles.posterText, { color: C.text }]}>CHECK IN{'\n'}WITH{'\n'}YOUR{'\n'}DAY</Text>
          </View>
          <View style={[styles.player, { backgroundColor: C.white }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.playerTitle, { color: C.text }]}>Mood Journal</Text>
              <Text style={[styles.playerSub, { color: C.textSecondary }]}>{stats?.total || 0} reflections this month</Text>
            </View>
            <TouchableOpacity style={[styles.play, { backgroundColor: C.primaryLight }]} onPress={() => router.push({ pathname: '/entry', params: { date: today } })}>
              <Ionicons name="play" size={15} color={C.primary} />
            </TouchableOpacity>
          </View>
        </ImageBackground>

        <ImageBackground source={paperArt} style={[styles.sheet, styles.sheetContent]} imageStyle={styles.sheetImage}>
          <View pointerEvents="none" style={styles.sheetDecor}>
            <View style={[styles.sheetBlobOne, { backgroundColor: C.lavender }]} />
            <View style={[styles.sheetBlobTwo, { backgroundColor: C.peach }]} />
            <Ionicons name="musical-notes-outline" size={24} color={C.primary} style={styles.decorNote} />
          </View>
          <View style={styles.statsRow}>
            <MiniStat C={C} label="Entries" value={stats?.total || 0} />
            <MiniStat C={C} label="Streak" value={`${streak}d`} />
            <MiniStat C={C} label="Avg" value={stats?.avgMood ? stats.avgMood.toFixed(1) : '-'} />
          </View>

          <View style={styles.memoryStrip}>
            <GiftPhotoFrame C={C} compact style={styles.memoryFrame} />
            <GiftPhotoFrame C={C} compact style={styles.memoryFrame} />
          </View>

          <View style={[styles.monthCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={styles.monthHeader}>
              <Text style={[styles.monthTitle, { color: C.text }]}>{monthName}</Text>
              <View style={styles.monthControls}>
                <TouchableOpacity style={[styles.monthBtn, { backgroundColor: C.primaryLight }]} onPress={() => setMonth((m) => (m === 1 ? 12 : m - 1))}>
                  <Ionicons name="chevron-back" size={16} color={C.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.monthBtn, { backgroundColor: C.primaryLight }]} onPress={() => setMonth((m) => (m === 12 ? 1 : m + 1))}>
                  <Ionicons name="chevron-forward" size={16} color={C.primary} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.dayLabels}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <Text key={`${d}${i}`} style={[styles.dayLabel, { color: C.textSecondary }]}>{d}</Text>)}
            </View>
            <View style={styles.grid}>
              {cells.map((day, i) => {
                if (!day) return <View key={`empty-${i}`} style={styles.cell} />;
                const entry = entryMap[day];
                const mood = entry ? MOODS.find((m) => m.value === entry.mood) : null;
                const date = formatDate(year, month, day);
                return (
                  <TouchableOpacity key={date} style={styles.cell} onPress={() => router.push({ pathname: '/entry', params: { date } })}>
                    {mood ? <MoodFace color={mood.color} moodValue={mood.value} size={34} /> : <Text style={[styles.dayNum, { color: date > today ? C.border : C.textSecondary }]}>{day}</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ImageBackground>
      </ScrollView>
    </View>
  );
}

function MiniStat({ C, label, value }) {
  return (
    <View style={[styles.stat, { backgroundColor: C.card, borderColor: C.border }]}>
      <Text style={[styles.statValue, { color: C.primary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: C.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pageScroll: { flex: 1 },
  pageContent: { paddingBottom: 0 },
  hero: { paddingTop: 56, paddingHorizontal: 22, justifyContent: 'space-between' },
  heroImage: { resizeMode: 'cover' },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  smallTime: { fontFamily: 'Rounded', fontSize: 18, fontWeight: '900' },
  circleBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#8792BE', shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  affirmation: { alignItems: 'flex-end', marginTop: 64 },
  posterText: { fontFamily: 'Rounded', fontSize: 30, lineHeight: 38, fontWeight: '900', textAlign: 'right' },
  player: { minHeight: 58, borderRadius: 14, padding: 10, marginBottom: 74, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#7282BF', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  playerTitle: { fontFamily: 'Rounded', fontSize: 13, fontWeight: '900' },
  playerSub: { fontFamily: 'Rounded', fontSize: 10, marginTop: 2 },
  play: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sheet: {
    marginTop: 0,
    minHeight: 560,
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
    paddingBottom: STORY_TAB_BOTTOM_PADDING,
  },
  sheetDecor: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  sheetBlobOne: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    right: -66,
    top: 20,
    opacity: 0.42,
  },
  sheetBlobTwo: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    left: -48,
    top: 158,
    opacity: 0.44,
  },
  decorNote: {
    position: 'absolute',
    right: 42,
    top: 150,
    opacity: 0.22,
    transform: [{ rotate: '13deg' }],
  },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  stat: { flex: 1, borderRadius: 20, borderWidth: 1, padding: 13, alignItems: 'center' },
  statValue: { fontFamily: 'Rounded', fontSize: 20, fontWeight: '900' },
  statLabel: { fontFamily: 'Rounded', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  memoryStrip: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginBottom: 16 },
  memoryFrame: { flex: 1, maxWidth: 178, minHeight: 220, borderRadius: 20 },
  monthCard: { borderRadius: 24, borderWidth: 1, padding: 16 },
  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  monthTitle: { fontFamily: 'Rounded', fontSize: 20, fontWeight: '900' },
  monthControls: { flexDirection: 'row', gap: 8 },
  monthBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayLabels: { flexDirection: 'row', marginBottom: 8 },
  dayLabel: { flex: 1, textAlign: 'center', fontFamily: 'Rounded', fontSize: 10, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.285%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayNum: { fontFamily: 'Rounded', fontSize: 12, fontWeight: '900' },
});
