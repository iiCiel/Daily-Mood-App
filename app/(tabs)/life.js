import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/context/ThemeContext';
import AestheticBackground from '../../src/components/AestheticBackground';
import MoodFace from '../../src/components/MoodFace';
import HabitIcon from '../../src/components/HabitIcon';
import { getPlannerEntry, getPlanningSummary } from '../../src/db/plannerDatabase';
import { getSleepEntry, calcDuration } from '../../src/db/sleepDatabase';
import { getGoals } from '../../src/db/goalsDatabase';
import { getNotes } from '../../src/db/notesDatabase';
import { getHabits, getCompletionsForDate, toggleCompletion } from '../../src/db/habitDatabase';
import { getSessionsForDay } from '../../src/db/focusDatabase';
import { getEntry, saveEntry } from '../../src/db/database';
import { getCalorieDaySummary, getCalorieGoal } from '../../src/db/calorieDatabase';
import { getLatestWeight } from '../../src/db/weightDatabase';
import { MOODS } from '../../src/constants/theme';

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

const TOOL_ICONS = {
  Planner: '📋',
  Sleep: '🌙',
  Goals: '🎯',
  Notes: '📝',
};

export default function DashboardScreen() {
  const C = useTheme();
  const today = todayStr();
  const hour = new Date().getHours();

  const [planner, setPlanner] = useState(null);
  const [planningSummary, setPlanningSummary] = useState(null);
  const [sleep, setSleep] = useState(null);
  const [goals, setGoals] = useState([]);
  const [notes, setNotes] = useState([]);
  const [habits, setHabits] = useState([]);
  const [completed, setCompleted] = useState(new Set());
  const [sessions, setSessions] = useState([]);
  const [todayMood, setTodayMood] = useState(null);
  const [calorieSummary, setCalorieSummary] = useState(null);
  const [calorieGoal, setCalorieGoal] = useState(2000);
  const [latestWeight, setLatestWeight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useFocusEffect(useCallback(() => {
    load();
  }, []));

  async function load() {
    setLoadError(false);
    try {
    const [p, planSummary, sl, g, n, h, done, focusSessions, moodEntry, cals, cGoal, wt] = await Promise.all([
      getPlannerEntry(today),
      getPlanningSummary(today),
      getSleepEntry(today),
      getGoals(),
      getNotes(),
      getHabits(),
      getCompletionsForDate(today),
      getSessionsForDay(today),
      getEntry(today),
      getCalorieDaySummary(today),
      getCalorieGoal(),
      getLatestWeight(),
    ]);
    setPlanner(p);
    setPlanningSummary(planSummary);
    setSleep(sl);
    setGoals(g);
    setNotes(n);
    setHabits(h);
    setCompleted(done);
    setSessions(focusSessions);
    setTodayMood(moodEntry);
    setCalorieSummary(cals);
    setCalorieGoal(cGoal);
    setLatestWeight(wt);
    } catch (e) {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  async function toggleHabit(id) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleCompletion(id, today);
    setCompleted(await getCompletionsForDate(today));
  }

  async function handleQuickMood(value) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const existing = await getEntry(today);
    await saveEntry(
      today,
      value,
      existing?.note || '',
      existing?.photos?.map((p) => p.uri) || [],
      existing?.tags || [],
      existing?.gratitude || []
    );
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTodayMood(await getEntry(today));
  }

  const completedHabits = habits.filter((h) => completed.has(h.id)).length;
  const focusMinutes = sessions.filter((s) => s.completed).reduce((sum, s) => sum + s.duration, 0);
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const activeGoals = goals.filter(g => !g.completed);
  const sleepDur = sleep ? fmtDuration(calcDuration(sleep.bedtime, sleep.wake_time)) : null;
  const moodObj = todayMood ? MOODS.find((m) => m.value === todayMood.mood) : null;

  if (loading) return (
    <View style={[styles.container, { backgroundColor: C.background, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: C.textSecondary, fontSize: 14 }}>loading...</Text>
    </View>
  );

  if (loadError) return (
    <View style={[styles.container, { backgroundColor: C.background, alignItems: 'center', justifyContent: 'center', gap: 12 }]}>
      <Text style={{ color: C.textSecondary, fontSize: 14 }}>couldn't load your data</Text>
      <TouchableOpacity onPress={load} style={{ backgroundColor: C.card, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}>
        <Text style={{ color: C.text, fontSize: 14 }}>try again</Text>
      </TouchableOpacity>
    </View>
  );
  const completedSessions = sessions.filter((s) => s.completed).length;

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <AestheticBackground />
      <ScrollView
        style={{ flex: 1, backgroundColor: 'transparent' }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

      {/* Header */}
      <View style={styles.todayHeader}>
        <View>
          <Text style={[styles.greeting, { color: C.textSecondary }]}>{greeting}</Text>
          <Text style={[styles.dateLabel, { color: C.text }]}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/settings')} hitSlop={10}>
          <Text style={[styles.settingsBtn, { color: C.textSecondary }]}>⚙</Text>
        </TouchableOpacity>
      </View>

      {/* Hero */}
      <View style={[styles.heroCard, { backgroundColor: C.card }]}>
        <View style={[styles.heroAccent, { backgroundColor: C.primary }]} />
        <View style={[styles.heroAccent2, { backgroundColor: C.teal }]} />
        <View style={styles.heroInner}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroGreeting, { color: C.textSecondary }]}>{greeting}</Text>
            <Text style={[styles.heroTitle, { color: C.text }]}>Ready to find{'\n'}your flow?</Text>
            <Text style={[styles.heroSub, { color: C.textSecondary }]}>
              {habits.length - completedHabits > 0
                ? `${habits.length - completedHabits} habits remaining today`
                : habits.length > 0 ? 'all habits done' : 'start building your routine'}
            </Text>
          </View>
          <View style={[styles.flowBadge, { backgroundColor: C.primaryLight, borderColor: C.primary }]}>
            <Text style={[styles.flowBadgeNum, { color: C.primary }]}>{completedHabits}</Text>
            <Text style={[styles.flowBadgeSlash, { color: C.textSecondary }]}>/{habits.length}</Text>
          </View>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatPill bg={C.mint}    label="mood"   value={moodObj ? moodObj.label : '—'}                                      color={moodObj?.color || C.primary} />
        <StatPill bg={C.lavender} label="habits" value={habits.length ? `${completedHabits}/${habits.length}` : '—'}       color={C.grape} />
        <StatPill bg={C.sand}    label="focus"  value={focusMinutes > 0 ? `${focusMinutes}m` : '—'}                        color={C.primary} />
        <StatPill bg={C.peach}   label="tasks"  value={planningSummary?.dueTasks > 0 ? `${planningSummary.dueTasks} due` : '✓'} color={C.accent} />
      </View>

      {/* Deep Work */}
      <TouchableOpacity
        style={[styles.sessionCard, { backgroundColor: C.primary }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.navigate('/(tabs)/focus');
        }}
        activeOpacity={0.82}
      >
        <View style={styles.sessionGlow} />
        <View style={styles.sessionTop}>
          <View>
            <Text style={styles.sessionKicker}>DEEP WORK</Text>
            <Text style={styles.sessionTitle}>Start a Session</Text>
          </View>
          <View style={styles.sessionChip}>
            <Text style={styles.sessionChipText}>{completedSessions} today</Text>
          </View>
        </View>
        <Text style={styles.sessionSub}>Block distractions and dive into focused work.</Text>
        <View style={styles.sessionBottom}>
          <View>
            <Text style={styles.sessionTime}>25:00</Text>
            <Text style={styles.sessionTiny}>focus time</Text>
          </View>
          <View style={styles.playBtn}>
            <Text style={[styles.playText, { color: C.primary }]}>▶</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Quick Mood */}
      <View style={[styles.card, { backgroundColor: C.card }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: C.text }]}>how are you feeling?</Text>
          {moodObj && <MoodFace color={moodObj.color} moodValue={moodObj.value} size={24} />}
        </View>
        <View style={styles.moodRow}>
          {MOODS.map((mood) => {
            const isSelected = moodObj?.value === mood.value;
            return (
              <TouchableOpacity
                key={mood.value}
                style={[styles.moodItem, { backgroundColor: isSelected ? mood.color + '22' : C.background }, isSelected && { borderColor: mood.color, borderWidth: 1.5 }]}
                onPress={() => handleQuickMood(mood.value)}
                activeOpacity={0.7}
              >
                <MoodFace color={mood.color} moodValue={mood.value} size={32} />
                <Text style={[styles.moodLabel, { color: isSelected ? mood.color : C.textSecondary }]}>{mood.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Habits today */}
      <View style={[styles.card, { backgroundColor: C.card }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: C.text }]}>habits</Text>
          <TouchableOpacity onPress={() => router.navigate('/(tabs)/habits')}>
            <Text style={[styles.linkText, { color: C.primary }]}>all →</Text>
          </TouchableOpacity>
        </View>
        {habits.length === 0 ? (
          <Text style={[styles.emptyText, { color: C.textSecondary }]}>no habits yet — add some in the Habits tab</Text>
        ) : habits.slice(0, 5).map((habit) => {
          const done = completed.has(habit.id);
          return (
            <TouchableOpacity
              key={habit.id}
              style={[styles.habitRow, { backgroundColor: done ? C.primaryLight : C.background }]}
              onPress={() => toggleHabit(habit.id)}
              activeOpacity={0.75}
            >
              <View style={[styles.habitEmoji, { backgroundColor: done ? habit.color : C.card }]}>
                <HabitIcon name={habit.emoji} size={15} color={done ? '#FFFFFF' : habit.color} />
              </View>
              <Text style={[styles.habitTitle, { color: done ? C.textSecondary : C.text }, done && { textDecorationLine: 'line-through', opacity: 0.55 }]} numberOfLines={1}>{habit.title}</Text>
              <View style={[styles.habitCheck, { borderColor: done ? C.primary : C.border, backgroundColor: done ? C.primary : 'transparent' }]}>
                {done && <Text style={styles.checkMark}>✓</Text>}
              </View>
            </TouchableOpacity>
          );
        })}
        {habits.length > 0 && (
          <View style={[styles.progressBar, { backgroundColor: C.background }]}>
            <View style={[styles.progressFill, { width: `${(completedHabits / habits.length) * 100}%`, backgroundColor: completedHabits === habits.length ? C.success : C.primary }]} />
          </View>
        )}
      </View>

      {/* Tool cards */}
      <View style={styles.toolsGrid}>
        <ToolCard C={C} title="Sleep"     sub={sleepDur || 'log sleep'}                                                       icon="🌙"  onPress={() => router.push('/sleep')} />
        <ToolCard C={C} title="Calories"  sub={calorieSummary ? `${calorieSummary.calories}/${calorieGoal} kcal` : 'log food'} icon="🍽"  onPress={() => router.push('/calories')} />
        <ToolCard C={C} title="Weight"    sub={latestWeight ? `${latestWeight.weight} ${latestWeight.unit}` : 'log weight'}    icon="⚖️"  onPress={() => router.push('/weight')} />
        <ToolCard C={C} title="Goals"     sub={`${activeGoals.length} active`}                                                 icon="🎯"  onPress={() => router.push('/goals')} />
        <ToolCard C={C} title="Notes"     sub={notes.length ? `${notes.length} notes` : 'write a note'}                       icon="📝"  onPress={() => router.push('/notes')} />
        <ToolCard C={C} title="Planner"   sub={planningSummary ? `${planningSummary.dueTasks} due today` : 'daily plan'}       icon="📋"  onPress={() => router.push('/planner')} />
      </View>

      {/* Bottom links */}
      <View style={styles.bottomRow}>
        <TouchableOpacity style={[styles.bottomBtn, { backgroundColor: C.card, borderColor: C.border }]} onPress={() => router.push('/insights')} activeOpacity={0.75}>
          <Text style={styles.bottomBtnEmoji}>📊</Text>
          <Text style={[styles.bottomBtnText, { color: C.primary }]}>Insights</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bottomBtn, { backgroundColor: C.card, borderColor: C.border }]}
          onPress={() => router.push('/weekly-review')}
          activeOpacity={0.75}
        >
          <Text style={styles.bottomBtnEmoji}>📅</Text>
          <Text style={[styles.bottomBtnText, { color: C.primary }]}>Weekly review</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
    </View>
  );
}

function ToolCard({ C, title, sub, icon, onPress }) {
  return (
    <TouchableOpacity style={[styles.toolCard, { backgroundColor: C.card, borderWidth: 1, borderColor: C.border }]} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.toolCardTop}>
        <Text style={styles.toolIcon}>{icon}</Text>
        <Text style={[styles.toolArrow, { color: C.border }]}>›</Text>
      </View>
      <Text style={[styles.toolTitle, { color: C.text }]}>{title}</Text>
      <Text style={[styles.toolSub, { color: C.textSecondary }]} numberOfLines={1}>{sub}</Text>
    </TouchableOpacity>
  );
}

function StatPill({ C, bg, label, value, color }) {
  return (
    <View style={[styles.statPill, { backgroundColor: bg }]}>
      <Text style={[styles.statValue, { color: color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: color, opacity: 0.7 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative' },
  content: { padding: 20, paddingTop: 58, paddingBottom: 32 },

  // Today header
  todayHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 },
  greeting: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  dateLabel: { fontSize: 20, fontWeight: '900' },
  settingsBtn: { fontSize: 20, marginTop: 4 },

  // Hero
  heroCard: {
    borderRadius: 26,
    padding: 20,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#1A0A00',
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  heroAccent: {
    position: 'absolute',
    top: -42,
    right: -42,
    width: 164,
    height: 164,
    borderRadius: 82,
    opacity: 0.12,
  },
  heroAccent2: {
    position: 'absolute',
    bottom: -34,
    left: -34,
    width: 124,
    height: 124,
    borderRadius: 62,
    opacity: 0.18,
  },
  heroInner: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroGreeting: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  heroTitle: { fontSize: 26, lineHeight: 31, fontWeight: '900', letterSpacing: 0 },
  heroSub: { marginTop: 8, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  flowBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  flowBadgeNum: { fontSize: 26, fontWeight: '900', letterSpacing: 0 },
  flowBadgeSlash: { fontSize: 14, fontWeight: '800', marginTop: 4 },

  // Stats row
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statPill: { flex: 1, borderRadius: 18, paddingVertical: 14, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 14, fontWeight: '900' },
  statLabel: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },

  // Deep Work
  sessionCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    minHeight: 158,
    overflow: 'hidden',
    elevation: 4,
  },
  sessionGlow: {
    position: 'absolute',
    top: -22,
    right: -22,
    width: 142,
    height: 142,
    borderRadius: 71,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  sessionTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  sessionChip: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sessionChipText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  sessionKicker: { color: 'rgba(255,255,255,0.66)', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  sessionTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', marginTop: 6 },
  sessionSub: { color: 'rgba(255,255,255,0.86)', fontSize: 12, lineHeight: 17, marginTop: 8, maxWidth: 260 },
  sessionBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 18 },
  sessionTime: { color: '#FFFFFF', fontSize: 34, fontWeight: '900', letterSpacing: 0 },
  sessionTiny: { color: 'rgba(255,255,255,0.66)', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginTop: -2 },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  playText: { fontSize: 14, fontWeight: '900', marginLeft: 2 },

  // Cards
  card: { borderRadius: 20, padding: 16, marginBottom: 14, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '900' },
  linkText: { fontSize: 12, fontWeight: '800' },
  emptyText: { fontSize: 13, fontWeight: '600' },

  // Mood
  moodRow: { flexDirection: 'row', gap: 4 },
  moodItem: { flex: 1, alignItems: 'center', borderRadius: 14, paddingVertical: 10, gap: 5, borderWidth: 1, borderColor: 'transparent' },
  moodLabel: { fontSize: 9, fontWeight: '800', textTransform: 'capitalize' },

  // Habits
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 10, marginBottom: 6 },
  habitEmoji: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  habitTitle: { flex: 1, fontSize: 14, fontWeight: '700' },
  habitCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: '#fff', fontSize: 11, fontWeight: '900' },
  progressBar: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 10 },
  progressFill: { height: 4, borderRadius: 2 },

  // Tool cards
  toolsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  toolCard: { width: '47%', borderRadius: 18, padding: 14, minHeight: 86, justifyContent: 'space-between', elevation: 1 },
  toolCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  toolIcon: { fontSize: 20 },
  toolArrow: { fontSize: 18, fontWeight: '300' },
  toolTitle: { fontSize: 14, fontWeight: '900' },
  toolSub: { fontSize: 11, fontWeight: '600', marginTop: 2 },

  // Bottom
  bottomRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  bottomBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 16, paddingVertical: 13, borderWidth: 1 },
  bottomBtnEmoji: { fontSize: 14 },
  bottomBtnText: { fontSize: 12, fontWeight: '900' },
});
