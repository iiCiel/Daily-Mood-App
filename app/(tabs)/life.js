import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { getPlannerEntry } from '../../src/db/plannerDatabase';
import { getSleepEntry, calcDuration } from '../../src/db/sleepDatabase';
import { getGoals } from '../../src/db/goalsDatabase';
import { getNotes } from '../../src/db/notesDatabase';
import { COLORS } from '../../src/constants/theme';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmtDuration(mins) {
  if (!mins) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m > 0 ? m + 'm' : ''}`.trim() : `${m}m`;
}

export default function LifeScreen() {
  const C = useTheme();
  const today = todayStr();
  const hour = new Date().getHours();

  const [planner, setPlanner] = useState(null);
  const [sleep, setSleep] = useState(null);
  const [goals, setGoals] = useState([]);
  const [notes, setNotes] = useState([]);

  useFocusEffect(useCallback(() => {
    load();
  }, []));

  async function load() {
    const [p, sl, g, n] = await Promise.all([
      getPlannerEntry(today),
      getSleepEntry(today),
      getGoals(),
      getNotes(),
    ]);
    setPlanner(p);
    setSleep(sl);
    setGoals(g);
    setNotes(n);
  }

  const activeGoals = goals.filter(g => !g.completed);
  const sleepDur = sleep ? fmtDuration(calcDuration(sleep.bedtime, sleep.wake_time)) : null;
  const greeting = hour < 12 ? 'good morning' : hour < 17 ? 'good afternoon' : 'good evening';
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: C.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topBar}>
        <View>
          <Text style={[styles.greeting, { color: C.textSecondary }]}>{greeting}</Text>
          <Text style={[styles.dateLabel, { color: C.text }]}>{dateLabel}</Text>
        </View>
        <TouchableOpacity
          style={[styles.reviewBtn, { backgroundColor: C.card }]}
          onPress={() => router.push('/weekly-review')}
          activeOpacity={0.7}
        >
          <Text style={[styles.reviewBtnText, { color: C.textSecondary }]}>weekly review</Text>
        </TouchableOpacity>
      </View>

      {/* Daily Planner card */}
      <TouchableOpacity
        style={[styles.card, styles.plannerCard, { backgroundColor: C.card }]}
        onPress={() => router.push('/planner')}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>📋</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: C.text }]}>daily planner</Text>
            {planner?.intention
              ? <Text style={[styles.cardSub, { color: C.textSecondary }]} numberOfLines={1}>{planner.intention}</Text>
              : <Text style={[styles.cardSub, { color: C.textSecondary }]}>
                  {hour < 12 ? 'set your intention for today →' : 'no intention set'}
                </Text>
            }
          </View>
          <Text style={[styles.chevron, { color: C.border }]}>›</Text>
        </View>
        {planner?.priorities?.length > 0 && (
          <View style={styles.priorityPreview}>
            {planner.priorities.slice(0, 3).map((p, i) => (
              <View key={i} style={[styles.priorityItem, { borderColor: C.border }]}>
                <View style={[styles.priorityDot, { backgroundColor: C.text }]} />
                <Text style={[styles.priorityText, { color: C.textSecondary }]} numberOfLines={1}>{p}</Text>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>

      {/* Sleep card */}
      <TouchableOpacity
        style={[styles.card, { backgroundColor: C.card }]}
        onPress={() => router.push('/sleep')}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>🌙</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: C.text }]}>sleep</Text>
            {sleep
              ? <Text style={[styles.cardSub, { color: C.textSecondary }]}>
                  {sleepDur ? sleepDur : ''}
                  {sleep.quality ? `  ·  quality ${sleep.quality}/5` : ''}
                  {!sleepDur && !sleep.quality ? 'logged' : ''}
                </Text>
              : <Text style={[styles.cardSub, { color: C.textSecondary }]}>log last night's sleep →</Text>
            }
          </View>
          <Text style={[styles.chevron, { color: C.border }]}>›</Text>
        </View>
      </TouchableOpacity>

      {/* Goals card */}
      <TouchableOpacity
        style={[styles.card, { backgroundColor: C.card }]}
        onPress={() => router.push('/goals')}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>🎯</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: C.text }]}>goals</Text>
            {activeGoals.length > 0
              ? <Text style={[styles.cardSub, { color: C.textSecondary }]}>
                  {activeGoals.length} active goal{activeGoals.length !== 1 ? 's' : ''}
                  {goals.filter(g => g.completed).length > 0 ? `  ·  ${goals.filter(g => g.completed).length} completed` : ''}
                </Text>
              : <Text style={[styles.cardSub, { color: C.textSecondary }]}>set your first goal →</Text>
            }
          </View>
          <Text style={[styles.chevron, { color: C.border }]}>›</Text>
        </View>
        {activeGoals.slice(0, 2).map(g => {
          const hasProg = g.target_value != null && g.target_value > 0;
          const pct = hasProg ? Math.min(100, Math.round((g.current_value / g.target_value) * 100)) : null;
          return (
            <View key={g.id} style={styles.goalPreview}>
              <Text style={[styles.goalPreviewTitle, { color: C.textSecondary }]} numberOfLines={1}>{g.title}</Text>
              {pct != null && (
                <View style={[styles.miniTrack, { backgroundColor: C.border }]}>
                  <View style={[styles.miniFill, { width: `${pct}%`, backgroundColor: pct >= 100 ? '#6CC97C' : C.text }]} />
                </View>
              )}
            </View>
          );
        })}
      </TouchableOpacity>

      {/* Notes card */}
      <TouchableOpacity
        style={[styles.card, { backgroundColor: C.card }]}
        onPress={() => router.push('/notes')}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>📝</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: C.text }]}>notes</Text>
            {notes.length > 0
              ? <Text style={[styles.cardSub, { color: C.textSecondary }]} numberOfLines={1}>
                  {notes[0].title || notes[0].body?.slice(0, 40) || 'untitled'}
                </Text>
              : <Text style={[styles.cardSub, { color: C.textSecondary }]}>capture anything →</Text>
            }
          </View>
          {notes.length > 0 && <Text style={[styles.notesCount, { color: C.textSecondary, backgroundColor: C.border }]}>{notes.length}</Text>}
          <Text style={[styles.chevron, { color: C.border }]}>›</Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 60, paddingBottom: 50 },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 28,
  },
  greeting: { fontSize: 13, letterSpacing: 0.3, marginBottom: 2 },
  dateLabel: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  reviewBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, elevation: 1 },
  reviewBtnText: { fontSize: 12, letterSpacing: 0.2 },
  card: { borderRadius: 20, elevation: 2, padding: 18, marginBottom: 14, gap: 10 },
  plannerCard: {},
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIcon: { fontSize: 22, width: 32, textAlign: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', letterSpacing: 0.1 },
  cardSub: { fontSize: 13, letterSpacing: 0.1, marginTop: 2 },
  chevron: { fontSize: 20, paddingLeft: 4 },
  priorityPreview: { gap: 6, paddingLeft: 44 },
  priorityItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priorityDot: { width: 5, height: 5, borderRadius: 3 },
  priorityText: { fontSize: 13, flex: 1 },
  goalPreview: { paddingLeft: 44, gap: 4 },
  goalPreviewTitle: { fontSize: 13 },
  miniTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  miniFill: { height: 4, borderRadius: 2 },
  notesCount: {
    fontSize: 11, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 10, overflow: 'hidden', marginRight: 4,
  },
});
