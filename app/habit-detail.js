import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, router, Stack } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import AestheticBackground from '../src/components/AestheticBackground';
import {
  getHabits, getHabitHistory, getHabitStreak,
  getCompletionRate, toggleCompletion, getCompletionsForDate,
} from '../src/db/habitDatabase';

const SCREEN_W = Dimensions.get('window').width;
const H_PAD = 24;
const DOT_GAP = 4;
const DOT_SIZE = Math.floor((SCREEN_W - H_PAD * 2 - DOT_GAP * 29) / 30);

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export default function HabitDetail() {
  const C = useTheme();
  const { id } = useLocalSearchParams();
  const habitId = parseInt(id);

  const [habit, setHabit] = useState(null);
  const [history, setHistory] = useState([]);
  const [streak, setStreak] = useState(0);
  const [rate30, setRate30] = useState(0);
  const [rate7, setRate7] = useState(0);
  const [todayDone, setTodayDone] = useState(false);

  useFocusEffect(useCallback(() => {
    load();
  }, [habitId]));

  async function load() {
    const habits = await getHabits();
    const h = habits.find(x => x.id === habitId);
    if (!h) { router.back(); return; }
    setHabit(h);

    const [hist, s, r30, r7, todayCompleted] = await Promise.all([
      getHabitHistory(habitId, 30),
      getHabitStreak(habitId),
      getCompletionRate(habitId, 30),
      getCompletionRate(habitId, 7),
      getCompletionsForDate(todayStr()),
    ]);
    setHistory(hist);
    setStreak(s);
    setRate30(r30);
    setRate7(r7);
    setTodayDone(todayCompleted.has(habitId));
  }

  async function handleToggleToday() {
    await toggleCompletion(habitId, todayStr());
    load();
  }

  if (!habit) return null;

  const totalDone = history.filter(d => d.done).length;

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
        </View>

        {/* Habit title */}
        <View style={styles.titleRow}>
          <View style={[styles.emojiCircle, { backgroundColor: habit.color }]}>
            <Text style={styles.emoji}>{habit.emoji}</Text>
          </View>
          <Text style={[styles.habitName, { color: C.text }]}>{habit.title}</Text>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[styles.statVal, { color: C.text }]}>🔥 {streak}</Text>
            <Text style={[styles.statLbl, { color: C.textSecondary }]}>streak</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[styles.statVal, { color: C.text }]}>{rate7}%</Text>
            <Text style={[styles.statLbl, { color: C.textSecondary }]}>this week</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[styles.statVal, { color: C.text }]}>{rate30}%</Text>
            <Text style={[styles.statLbl, { color: C.textSecondary }]}>30 days</Text>
          </View>
        </View>

        {/* Today's check-in */}
        <TouchableOpacity
          style={[
            styles.todayBtn,
            {
              backgroundColor: todayDone ? habit.color : C.card,
              borderColor: todayDone ? habit.color : C.border,
            }
          ]}
          onPress={handleToggleToday}
          activeOpacity={0.7}
        >
          <Text style={[styles.todayBtnText, { color: todayDone ? '#fff' : C.text }]}>
            {todayDone ? '✓  done today' : 'mark as done today'}
          </Text>
        </TouchableOpacity>

        {/* 30-day history grid */}
        <Text style={[styles.sectionLabel, { color: C.textSecondary }]}>last 30 days</Text>
        <View style={[styles.histCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={styles.dotGrid}>
            {history.map(({ date, done }) => {
              const isToday = date === todayStr();
              return (
                <View
                  key={date}
                  style={[
                    styles.dot,
                    { backgroundColor: done ? habit.color : C.border },
                    isToday && { borderWidth: 1.5, borderColor: C.text },
                  ]}
                />
              );
            })}
          </View>
          <Text style={[styles.histCaption, { color: C.textSecondary }]}>
            {totalDone} out of 30 days completed
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: H_PAD, paddingTop: 60, paddingBottom: 50 },
  header: { marginBottom: 20 },
  backBtn: { padding: 4, alignSelf: 'flex-start' },
  backText: { fontSize: 24 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
  emojiCircle: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  emoji: { fontSize: 26 },
  habitName: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, flex: 1 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, borderRadius: 14, borderWidth: 1,
    paddingVertical: 14, alignItems: 'center', gap: 4,
  },
  statVal: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  statLbl: { fontSize: 11, letterSpacing: 0.3 },
  todayBtn: {
    borderRadius: 999, borderWidth: 1.5,
    paddingVertical: 16, alignItems: 'center',
    marginBottom: 28,
  },
  todayBtnText: { fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
  sectionLabel: { fontSize: 12, letterSpacing: 0.5, marginBottom: 10 },
  histCard: {
    borderRadius: 16, borderWidth: 1,
    padding: 16, gap: 12,
  },
  dotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: DOT_GAP },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2 },
  histCaption: { fontSize: 12, letterSpacing: 0.3 },
});
