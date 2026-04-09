import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Dimensions,
} from 'react-native';
import { useFocusEffect, router, Stack } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { MOODS } from '../src/constants/theme';
import { getEntriesForYear } from '../src/db/database';
import AestheticBackground from '../src/components/AestheticBackground';

const SCREEN_W = Dimensions.get('window').width;
const H_PAD = 24;
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Dot size: fit 7 cols with gaps
const DOT_GAP = 3;
const DOT_SIZE = Math.floor((SCREEN_W - H_PAD * 2 - 36 - DOT_GAP * 6) / 7); // 36 for month label

export default function YearInPixels() {
  const C = useTheme();
  const [year, setYear] = useState(new Date().getFullYear());
  const [moodMap, setMoodMap] = useState({});

  useFocusEffect(useCallback(() => {
    getEntriesForYear(year).then(setMoodMap);
  }, [year]));

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();

  function getMoodColor(dateStr) {
    const mood = moodMap[dateStr];
    if (!mood) return null;
    return MOODS.find((m) => m.value === mood)?.color || C.border;
  }

  // Build months
  const months = Array.from({ length: 12 }, (_, mi) => {
    const daysInMonth = new Date(year, mi + 1, 0).getDate();
    const firstDay = new Date(year, mi, 1).getDay();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${String(mi+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      cells.push(ds);
    }
    return { month: mi, cells };
  });

  const filledCount = Object.keys(moodMap).filter(d => d.startsWith(String(year))).length;
  const totalDays = year === new Date().getFullYear()
    ? Math.floor((new Date() - new Date(year, 0, 1)) / 86400000) + 1
    : 365;
  const pct = Math.round((filledCount / totalDays) * 100);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={[styles.container, { backgroundColor: C.background }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <AestheticBackground />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={[styles.backText, { color: C.text }]}>←</Text>
          </TouchableOpacity>
          <View style={styles.yearNav}>
            <TouchableOpacity onPress={() => setYear(y => y - 1)} style={styles.navBtn}>
              <Text style={[styles.navArrow, { color: C.textSecondary }]}>‹</Text>
            </TouchableOpacity>
            <Text style={[styles.yearText, { color: C.text }]}>{year}</Text>
            <TouchableOpacity
              onPress={() => setYear(y => y + 1)}
              style={styles.navBtn}
              disabled={year >= new Date().getFullYear()}
            >
              <Text style={[styles.navArrow, { color: year >= new Date().getFullYear() ? C.border : C.textSecondary }]}>›</Text>
            </TouchableOpacity>
          </View>
          <View style={{ width: 32 }} />
        </View>

        <Text style={[styles.title, { color: C.text }]}>year in pixels</Text>
        <Text style={[styles.subtitle, { color: C.textSecondary }]}>
          {filledCount} of {totalDays} days logged · {pct}%
        </Text>

        {/* Legend */}
        <View style={styles.legend}>
          {MOODS.slice().reverse().map((m) => (
            <View key={m.value} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: m.color }]} />
              <Text style={[styles.legendText, { color: C.textSecondary }]}>{m.label}</Text>
            </View>
          ))}
        </View>

        {/* Grid */}
        {months.map(({ month, cells }) => (
          <View key={month} style={styles.monthBlock}>
            <Text style={[styles.monthLabel, { color: C.textSecondary }]}>{MONTH_NAMES[month]}</Text>
            <View style={styles.dotGrid}>
              {cells.map((dateStr, i) => {
                if (!dateStr) return <View key={`e-${i}`} style={[styles.dot, { backgroundColor: 'transparent' }]} />;
                const color = getMoodColor(dateStr);
                const isToday = dateStr === todayStr;
                const isFuture = dateStr > todayStr;
                return (
                  <TouchableOpacity
                    key={dateStr}
                    onPress={() => !isFuture && router.push({ pathname: '/entry', params: { date: dateStr } })}
                    disabled={isFuture}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.dot,
                      { backgroundColor: color || (isFuture ? 'transparent' : C.border) },
                      isToday && { borderWidth: 1.5, borderColor: C.text },
                      isFuture && { opacity: 0 },
                    ]} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: H_PAD, paddingTop: 60, paddingBottom: 50 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  backBtn: { padding: 4, width: 32 },
  backText: { fontSize: 24 },
  yearNav: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  navBtn: { padding: 4 },
  navArrow: { fontSize: 26, lineHeight: 28 },
  yearText: { fontSize: 18, fontWeight: '700', letterSpacing: -0.5 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontSize: 13, letterSpacing: 0.3, marginBottom: 16 },
  legend: { flexDirection: 'row', gap: 12, marginBottom: 24, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, letterSpacing: 0.2 },
  monthBlock: { marginBottom: 16 },
  monthLabel: { fontSize: 11, letterSpacing: 0.5, marginBottom: 6, fontWeight: '600' },
  dotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: DOT_GAP },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2 },
});
