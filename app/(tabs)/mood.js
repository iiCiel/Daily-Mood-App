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
import { useFocusEffect, router } from 'expo-router';
import { getEntriesForMonth, getStreak, getMonthStats, exportMonthAsText, searchEntries } from '../../src/db/database';
import { COLORS, MOODS } from '../../src/constants/theme';
import { useTheme } from '../../src/context/ThemeContext';
import MoodFace from '../../src/components/MoodFace';
import AestheticBackground from '../../src/components/AestheticBackground';
import MoodTrend from '../../src/components/MoodTrend';
import CorrelationInsight from '../../src/components/CorrelationInsight';

const SCREEN_W = Dimensions.get('window').width;
const H_PAD = 24;
const CELL_GAP = 8;
const CELL_SIZE = Math.floor((SCREEN_W - H_PAD * 2 - CELL_GAP * 6) / 7);

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function formatDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function CalendarScreen() {
  const COLORS = useTheme();
  const [entries, setEntries] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [streak, setStreak] = useState(0);
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, [year, month])
  );

  useFocusEffect(
    useCallback(() => {
      loadStreakAndStats();
    }, [year, month])
  );

  async function loadEntries() {
    try {
      const data = await getEntriesForMonth(year, month);
      setEntries(data);
    } catch (e) {
      console.error(e);
    }
  }

  async function loadStreakAndStats() {
    try {
      const [s, m] = await Promise.all([getStreak(), getMonthStats(year, month)]);
      setStreak(s);
      setStats(m);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    if (search.trim().length > 1) {
      searchEntries(search.trim()).then(setSearchResults);
    } else {
      setSearchResults([]);
    }
  }, [search]);

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

  async function handleCopyMonth() {
    const text = await exportMonthAsText(year, month);
    if (!text) {
      Alert.alert('nothing to copy', 'no entries for this month.');
      return;
    }
    await Clipboard.setStringAsync(text);
    Alert.alert('copied!', 'all journal entries for this month have been copied. paste them into any AI chat.');
  }

  const swipeResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -40) changeMonthRef.current(1);
        else if (g.dx > 40) changeMonthRef.current(-1);
      },
    })
  ).current;

  const todayDate = new Date();
  const todayStr = formatDate(
    todayDate.getFullYear(),
    todayDate.getMonth() + 1,
    todayDate.getDate()
  );
  const isCurrentMonth =
    todayDate.getFullYear() === year && todayDate.getMonth() + 1 === month;
  const todayDay = todayDate.getDate();

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();

  const entryMap = {};
  for (const e of entries) {
    const day = parseInt(e.date.split('-')[2], 10);
    entryMap[day] = e;
  }

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // Disable future days
  function isFuture(day) {
    if (!day) return false;
    const cellDate = formatDate(year, month, day);
    return cellDate > todayStr;
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: COLORS.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <AestheticBackground />
      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={[styles.appName, { color: COLORS.text }]}>mood</Text>
        <View style={styles.topBtns}>
          <TouchableOpacity style={[styles.settingsBtn, { backgroundColor: COLORS.card, borderColor: COLORS.border }]} onPress={handleCopyMonth}>
            <Text style={[styles.settingsBtnText, { color: COLORS.textSecondary }]}>copy month</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.settingsBtn, { backgroundColor: COLORS.card, borderColor: COLORS.border }]} onPress={() => router.push('/insights')}>
            <Text style={[styles.settingsBtnText, { color: COLORS.textSecondary }]}>insights</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.settingsBtn, { backgroundColor: COLORS.card, borderColor: COLORS.border }]} onPress={() => router.push('/year')}>
            <Text style={[styles.settingsBtnText, { color: COLORS.textSecondary }]}>year</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.settingsBtn, { backgroundColor: COLORS.card, borderColor: COLORS.border }]} onPress={() => router.push('/(tabs)/settings')}>
            <Text style={[styles.settingsBtnText, { color: COLORS.textSecondary }]}>settings</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Streak + Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
          <Text style={[styles.statValue, { color: COLORS.text }]}>{streak}</Text>
          <Text style={[styles.statLabel, { color: COLORS.textSecondary }]}>day streak 🔥</Text>
        </View>
        {stats ? (
          <>
            <View style={[styles.statCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
              <Text style={[styles.statValue, { color: COLORS.text }]}>{stats.total}</Text>
              <Text style={[styles.statLabel, { color: COLORS.textSecondary }]}>entries</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
              <MoodFace
                color={MOODS.find((m) => m.value === stats.topMood)?.color || COLORS.border}
                moodValue={stats.topMood}
                size={32}
              />
              <Text style={[styles.statLabel, { color: COLORS.textSecondary }]}>top mood</Text>
            </View>
          </>
        ) : (
          <View style={[styles.statCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
            <Text style={[styles.statValue, { color: COLORS.text }]}>—</Text>
            <Text style={[styles.statLabel, { color: COLORS.textSecondary }]}>no entries yet</Text>
          </View>
        )}
      </View>

      <MoodTrend />
      <CorrelationInsight />

      {/* Search */}
      <View style={[styles.searchBar, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
        <Text style={{ color: COLORS.textSecondary, fontSize: 15, marginRight: 8 }}>🔍</Text>
        <TextInput
          style={[styles.searchInput, { color: COLORS.text }]}
          placeholder="search entries..."
          placeholderTextColor={COLORS.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={{ color: COLORS.textSecondary, fontSize: 15 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {search.trim().length > 1 ? (
        <View style={{ marginBottom: 24 }}>
          {searchResults.length === 0 ? (
            <Text style={[styles.emptyText, { color: COLORS.textSecondary }]}>no results</Text>
          ) : searchResults.map(entry => {
            const mood = MOODS.find(m => m.value === entry.mood);
            const dateObj = new Date(entry.date + 'T00:00:00');
            const label = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            return (
              <TouchableOpacity
                key={entry.id}
                style={[styles.searchResult, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}
                onPress={() => router.push({ pathname: '/entry', params: { date: entry.date } })}
                activeOpacity={0.7}
              >
                <View style={[styles.searchMoodDot, { backgroundColor: mood?.color || COLORS.border }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[{ color: COLORS.textSecondary, fontSize: 11, marginBottom: 2 }]}>{label}</Text>
                  <Text style={[{ color: COLORS.text, fontSize: 14 }]} numberOfLines={2}>{entry.note || mood?.label || ''}</Text>
                  {entry.tags?.length > 0 && (
                    <Text style={[{ color: COLORS.textSecondary, fontSize: 11, marginTop: 3 }]}>{entry.tags.join(' · ')}</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {/* Month nav */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.navBtn}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <View style={styles.monthLabel}>
          <Text style={[styles.yearText, { color: COLORS.textSecondary }]}>{year}</Text>
          <Text style={[styles.monthText, { color: COLORS.text }]}>{MONTH_NAMES[month - 1].toUpperCase()}</Text>
        </View>
        <TouchableOpacity onPress={() => changeMonth(1)} style={styles.navBtn}>
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Swipeable calendar area */}
      <View {...swipeResponder.panHandlers}>
        {/* Day headers */}
        <View style={styles.dayHeaders}>
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
            <Text key={d} style={styles.dayHeader}>{d}</Text>
          ))}
        </View>

        {/* Grid */}
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
              onPress={() => router.push({ pathname: '/entry', params: { date: dateStr } })}
              activeOpacity={0.7}
            >
              {mood ? (
                <View style={[styles.faceWrap, isToday && styles.todayRing]}>
                  <MoodFace color={mood.color} moodValue={mood.value} size={CELL_SIZE} />
                </View>
              ) : (
                <View style={[styles.emptyDay, isToday && styles.todayEmpty, future && styles.futureDay]}>
                  <Text style={[styles.dayNum, isToday && styles.todayNum, future && styles.futureNum]}>
                    {day}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
        </View>
      </View>{/* end swipe wrapper */}

      {entries.length === 0 && (
        <Text style={[styles.emptyText, { color: COLORS.textSecondary }]}>tap any day to add an entry</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: H_PAD,
    paddingTop: 60,
    paddingBottom: 50,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  topBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  appName: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  settingsBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  settingsBtnText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    letterSpacing: 0.3,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    letterSpacing: 0.3,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  navBtn: {
    padding: 8,
  },
  navArrow: {
    fontSize: 30,
    color: COLORS.textSecondary,
    lineHeight: 32,
  },
  monthLabel: {
    alignItems: 'center',
  },
  yearText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
    fontStyle: 'italic',
  },
  monthText: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 3,
  },
  dayHeaders: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  dayHeader: {
    width: CELL_SIZE,
    textAlign: 'center',
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CELL_GAP,
    marginBottom: 24,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceWrap: {
    borderRadius: CELL_SIZE / 2,
  },
  todayRing: {
    borderWidth: 2.5,
    borderColor: COLORS.text,
  },
  emptyDay: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: CELL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  todayEmpty: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  futureDay: {
    borderColor: 'transparent',
  },
  dayNum: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  todayNum: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  futureNum: {
    color: COLORS.border,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 13,
    color: COLORS.textSecondary,
    letterSpacing: 0.3,
    marginTop: 16,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 4,
    marginBottom: 20,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 10 },
  searchResult: {
    flexDirection: 'row', alignItems: 'flex-start',
    borderRadius: 14, borderWidth: 1,
    padding: 14, marginBottom: 8, gap: 12,
  },
  searchMoodDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3 },
});
