import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  PanResponder,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, router } from 'expo-router';
import {
  getEntriesForMonth,
  getStreak,
  getMonthStats,
  exportMonthAsText,
  searchEntries,
} from '../../src/db/database';
import { COLORS, MOODS } from '../../src/constants/theme';
import { useTheme } from '../../src/context/ThemeContext';
import MindfulHeader from '../../src/components/MindfulHeader';
import AestheticBackground from '../../src/components/AestheticBackground';
import MoodFace from '../../src/components/MoodFace';
import MoodTrend from '../../src/components/MoodTrend';
import CorrelationInsight from '../../src/components/CorrelationInsight';

const SCREEN_W = Dimensions.get('window').width;
const H_PAD = 24;
const CELL_GAP = 6;
const CELL_SIZE = Math.floor((SCREEN_W - H_PAD * 2 - 28 - CELL_GAP * 6) / 7);

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function formatDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function MoodScreen() {
  const C = useTheme();
  const [entries, setEntries] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [streak, setStreak] = useState(0);
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useFocusEffect(useCallback(() => {
    loadAll();
  }, [year, month]));

  async function loadAll() {
    setLoadError(false);
    setLoading(true);
    try {
      const [ents, s, m] = await Promise.all([
        getEntriesForMonth(year, month),
        getStreak(),
        getMonthStats(year, month),
      ]);
      setEntries(ents);
      setStreak(s);
      setStats(m);
    } catch (e) {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  async function loadEntries() {
    try {
      setEntries(await getEntriesForMonth(year, month));
    } catch (e) { /* handled by loadAll */ }
  }

  async function loadStreakAndStats() {
    try {
      const [s, m] = await Promise.all([getStreak(), getMonthStats(year, month)]);
      setStreak(s);
      setStats(m);
    } catch (e) { /* handled by loadAll */ }
  }

  useEffect(() => {
    if (search.trim().length > 1) searchEntries(search.trim()).then(setSearchResults);
    else setSearchResults([]);
  }, [search]);

  const todayDate = new Date();
  const todayStr = formatDate(todayDate.getFullYear(), todayDate.getMonth() + 1, todayDate.getDate());
  const isCurrentMonth = todayDate.getFullYear() === year && todayDate.getMonth() + 1 === month;
  const todayDay = todayDate.getDate();

  const changeMonthRef = useRef(null);
  function changeMonth(delta) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    else if (m > 12) { m = 1; y += 1; }
    setMonth(m);
    setYear(y);
  }
  changeMonthRef.current = changeMonth;

  const swipeResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderRelease: (_, g) => {
      if (g.dx < -40) changeMonthRef.current(1);
      else if (g.dx > 40) changeMonthRef.current(-1);
    },
  })).current;

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const entryMap = {};
  for (const e of entries) entryMap[parseInt(e.date.split('-')[2], 10)] = e;
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function isFuture(day) {
    if (!day) return false;
    return formatDate(year, month, day) > todayStr;
  }

  async function handleCopyMonth() {
    const text = await exportMonthAsText(year, month);
    if (!text) {
      Alert.alert('Nothing to copy', 'No entries for this month.');
      return;
    }
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', 'All journal entries for this month have been copied.');
  }

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: C.background, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: C.textSecondary, fontSize: 14 }}>loading...</Text>
    </View>
  );

  if (loadError) return (
    <View style={{ flex: 1, backgroundColor: C.background, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <Text style={{ color: C.textSecondary, fontSize: 14 }}>couldn't load journal</Text>
      <TouchableOpacity onPress={loadAll} style={{ backgroundColor: C.card, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}>
        <Text style={{ color: C.text, fontSize: 14 }}>try again</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <AestheticBackground />
      <ScrollView
        style={{ flex: 1, backgroundColor: 'transparent' }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
      <MindfulHeader C={C} title="Mood" onRightPress={handleCopyMonth} rightLabel="📋" />

      <View style={styles.titleBlock}>
        <Text style={[styles.title, { color: C.text }]}>Your Journey</Text>
        <Text style={[styles.subtitle, { color: C.textSecondary }]}>Take a moment to reflect on your emotional landscape.</Text>
      </View>

      <View style={styles.moodHeroRow}>
        <View style={[styles.moodHeroCard, { backgroundColor: C.lavender }]}>
          <Text style={[styles.moodHeroLabel, { color: C.textSecondary }]}>Month Entries</Text>
          <Text style={[styles.moodHeroValue, { color: '#715B86' }]}>{stats?.total || 0}</Text>
          <Text style={[styles.moodHeroSub, { color: C.textSecondary }]}>logged reflections</Text>
        </View>
        <View style={[styles.moodHeroCard, { backgroundColor: C.mint }]}>
          <Text style={[styles.moodHeroLabel, { color: C.textSecondary }]}>Streak</Text>
          <Text style={[styles.moodHeroValue, { color: C.primary }]}>{streak}</Text>
          <Text style={[styles.moodHeroSub, { color: C.textSecondary }]}>days in flow</Text>
        </View>
      </View>

      <View style={[styles.calendarCard, { backgroundColor: C.card }]}>
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => router.push('/year')} activeOpacity={0.7}>
            <Text style={[styles.monthText, { color: C.text }]}>{MONTH_NAMES[month - 1]} {year} ›</Text>
          </TouchableOpacity>
          <View style={styles.navGroup}>
            <TouchableOpacity onPress={() => changeMonth(-1)} style={[styles.navBtn, { backgroundColor: C.background }]}>
              <Text style={[styles.navArrow, { color: C.primary }]}>‹</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => changeMonth(1)} style={[styles.navBtn, { backgroundColor: C.background }]}>
              <Text style={[styles.navArrow, { color: C.primary }]}>›</Text>
            </TouchableOpacity>
          </View>
          {!isCurrentMonth && (
            <TouchableOpacity
              onPress={() => { setMonth(todayDate.getMonth() + 1); setYear(todayDate.getFullYear()); }}
              style={[styles.todayBtn, { backgroundColor: C.primary }]}
            >
              <Text style={styles.todayBtnText}>Today</Text>
            </TouchableOpacity>
          )}
        </View>

        <View {...swipeResponder.panHandlers}>
          <View style={styles.dayHeaders}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <Text key={`${d}-${i}`} style={[styles.dayHeader, { color: C.textSecondary }]}>{d}</Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((day, i) => {
              if (!day) return <View key={`empty-${i}`} style={styles.cell} />;
              const entry = entryMap[day];
              const mood = entry ? MOODS.find((m) => m.value === entry.mood) : null;
              const isToday = isCurrentMonth && day === todayDay;
              const future = isFuture(day);
              const dateStr = formatDate(year, month, day);
              return (
                <TouchableOpacity
                  key={`day-${day}`}
                  style={styles.cell}
                  disabled={future}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push({ pathname: '/entry', params: { date: dateStr } });
                  }}
                  activeOpacity={0.72}
                >
                  {mood ? (
                    <View style={isToday && styles.todayRing}>
                      <MoodFace color={mood.color} moodValue={mood.value} size={CELL_SIZE} />
                    </View>
                  ) : (
                    <View style={[
                      styles.dayBubble,
                      { backgroundColor: future ? 'transparent' : C.background },
                      isToday && { borderColor: C.primary, borderWidth: 2 },
                    ]}>
                      <Text style={[styles.dayNum, { color: future ? C.border : C.textSecondary }]}>
                        {day}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

      </View>



      <View style={[styles.searchBar, { backgroundColor: C.card }]}>
        <TextInput
          style={[styles.searchInput, { color: C.text }]}
          placeholder="Search entries"
          placeholderTextColor={C.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={[styles.clearText, { color: C.textSecondary }]}>x</Text>
          </TouchableOpacity>
        )}
      </View>

      {search.trim().length > 1 && (
        <View style={{ marginBottom: 18 }}>
          {searchResults.length === 0 ? (
            <Text style={[styles.emptyText, { color: C.textSecondary }]}>No results. Try a keyword, tag, or emotion.</Text>
          ) : searchResults.map((entry) => {
            const mood = MOODS.find((m) => m.value === entry.mood);
            const label = new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            return (
              <TouchableOpacity
                key={entry.id}
                style={[styles.searchResult, { backgroundColor: C.card }]}
                onPress={() => router.push({ pathname: '/entry', params: { date: entry.date } })}
                activeOpacity={0.72}
              >
                <View style={[styles.searchMoodDot, { backgroundColor: mood?.color || C.border }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.searchDate, { color: C.textSecondary }]}>{label}</Text>
                  <Text style={[styles.searchNote, { color: C.text }]} numberOfLines={2}>{entry.note || mood?.label || ''}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <MoodTrend />
      <CorrelationInsight />

      <TouchableOpacity
        style={[styles.insightsBtn, { backgroundColor: C.card }]}
        onPress={() => router.push('/insights')}
        activeOpacity={0.75}
      >
        <Text style={[styles.insightsBtnText, { color: C.primary }]}>View full insights</Text>
      </TouchableOpacity>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: H_PAD, paddingTop: 54, paddingBottom: 28 },
  titleBlock: { marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: 0 },
  subtitle: { fontSize: 12, lineHeight: 17, fontWeight: '600', marginTop: 4, maxWidth: 260 },
  moodHeroRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  moodHeroCard: {
    flex: 1,
    borderRadius: 22,
    padding: 16,
    minHeight: 118,
    justifyContent: 'space-between',
  },
  moodHeroLabel: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  moodHeroValue: { fontSize: 34, fontWeight: '900', letterSpacing: 0 },
  moodHeroSub: { fontSize: 11, fontWeight: '800' },
  calendarCard: {
    borderRadius: 22,
    padding: 14,
    marginBottom: 18,
    shadowColor: '#172417',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  monthText: { fontSize: 17, fontWeight: '900' },
  navGroup: { flexDirection: 'row', gap: 8 },
  navBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  navArrow: { fontSize: 20, fontWeight: '900', lineHeight: 22 },
  dayHeaders: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  dayHeader: { width: CELL_SIZE, textAlign: 'center', fontSize: 10, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: CELL_GAP },
  cell: { width: CELL_SIZE, height: CELL_SIZE, alignItems: 'center', justifyContent: 'center' },
  dayBubble: { width: CELL_SIZE, height: CELL_SIZE, borderRadius: CELL_SIZE / 2, alignItems: 'center', justifyContent: 'center', borderColor: 'transparent' },
  dayNum: { fontSize: 11, fontWeight: '900' },
  todayRing: { borderRadius: CELL_SIZE / 2, borderWidth: 2, borderColor: 'rgba(0,0,0,0.25)' },
  entryCard: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#172417',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  entryHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: '900' },
  entryHint: { fontSize: 11, fontWeight: '700', lineHeight: 16, marginTop: 4, maxWidth: 210 },
  entryMark: { width: 42, height: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  entryMarkText: { fontSize: 15, fontWeight: '900' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 8 },
  chipText: { fontSize: 11, fontWeight: '900' },
  noteLabel: { fontSize: 12, fontWeight: '900', marginBottom: 8 },
  noteInput: { minHeight: 96, borderRadius: 16, padding: 14, fontSize: 13, lineHeight: 19 },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  draftText: { fontSize: 12, fontWeight: '800' },
  logBtn: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11 },
  logText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },

  searchBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, elevation: 1, paddingHorizontal: 14, marginBottom: 14 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 12 },
  clearText: { fontSize: 16, fontWeight: '900' },
  emptyText: { textAlign: 'center', fontSize: 12, fontWeight: '700', marginVertical: 10 },
  searchResult: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 16, elevation: 1, padding: 14, marginBottom: 8, gap: 12 },
  searchMoodDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3 },
  searchDate: { fontSize: 11, fontWeight: '800', marginBottom: 2 },
  searchNote: { fontSize: 13, fontWeight: '700' },
  todayBtn: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginLeft: 8 },
  todayBtnText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  insightsBtn: {
    alignItems: 'center',
    borderRadius: 18,
    paddingVertical: 14,
    marginTop: 4,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#172417',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  insightsBtnText: { fontSize: 12, fontWeight: '900' },
});
