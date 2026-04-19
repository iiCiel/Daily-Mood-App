import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/context/ThemeContext';
import MindfulHeader from '../../src/components/MindfulHeader';
import AestheticBackground from '../../src/components/AestheticBackground';
import MoodFace from '../../src/components/MoodFace';
import { getPlannerEntry } from '../../src/db/plannerDatabase';
import { getSleepEntry, calcDuration } from '../../src/db/sleepDatabase';
import { getGoals } from '../../src/db/goalsDatabase';
import { getNotes } from '../../src/db/notesDatabase';
import { getHabits, getCompletionsForDate, toggleCompletion } from '../../src/db/habitDatabase';
import { getSessionsForDay } from '../../src/db/focusDatabase';
import { getEntry, saveEntry } from '../../src/db/database';
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
  const [sleep, setSleep] = useState(null);
  const [goals, setGoals] = useState([]);
  const [notes, setNotes] = useState([]);
  const [habits, setHabits] = useState([]);
  const [completed, setCompleted] = useState(new Set());
  const [sessions, setSessions] = useState([]);
  const [todayMood, setTodayMood] = useState(null);

  useFocusEffect(useCallback(() => {
    load();
  }, []));

  async function load() {
    const [p, sl, g, n, h, done, focusSessions, moodEntry] = await Promise.all([
      getPlannerEntry(today),
      getSleepEntry(today),
      getGoals(),
      getNotes(),
      getHabits(),
      getCompletionsForDate(today),
      getSessionsForDay(today),
      getEntry(today),
    ]);
    setPlanner(p);
    setSleep(sl);
    setGoals(g);
    setNotes(n);
    setHabits(h);
    setCompleted(done);
    setSessions(focusSessions);
    setTodayMood(moodEntry);
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
  const completedSessions = sessions.filter((s) => s.completed).length;

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <AestheticBackground />
      <ScrollView
        style={{ flex: 1, backgroundColor: 'transparent' }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
      <MindfulHeader C={C} title="Dashboard" onRightPress={() => router.push('/(tabs)/settings')} rightLabel="⚙" />

      {/* Hero with decorative accent */}
      <View style={[styles.heroCard, { backgroundColor: C.card }]}>
        <View style={[styles.heroAccent, { backgroundColor: C.primary, opacity: 0.07 }]} />
        <View style={[styles.heroAccent2, { backgroundColor: C.primary, opacity: 0.04 }]} />
        <View style={styles.heroInner}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroGreeting, { color: C.textSecondary }]}>{greeting} 👋</Text>
            <Text style={[styles.heroTitle, { color: C.text }]}>
              Ready to find{'\n'}your flow?
            </Text>
            <Text style={[styles.heroSub, { color: C.textSecondary }]}>
              {habits.length - completedHabits > 0
                ? `${habits.length - completedHabits} habits remaining today`
                : habits.length > 0 ? 'All habits done! 🎉' : 'Start building your routine'}
            </Text>
          </View>
          <View style={[styles.flowBadge, { backgroundColor: C.primaryLight, borderColor: C.primary }]}>
            <Text style={[styles.flowBadgeNum, { color: C.primary }]}>{completedHabits}</Text>
            <Text style={[styles.flowBadgeSlash, { color: C.textSecondary }]}>/{habits.length}</Text>
          </View>
        </View>
      </View>

      {/* Overview stats */}
      <View style={styles.overviewGrid}>
        <View style={[styles.overviewCard, { backgroundColor: C.mint }]}>
          <Text style={styles.overviewEmoji}>⏱</Text>
          <Text style={[styles.overviewValue, { color: C.primary }]}>{focusMinutes}m</Text>
          <Text style={[styles.overviewLabel, { color: C.textSecondary }]}>Focus Time</Text>
          <View style={[styles.overviewBar, { backgroundColor: C.card }]}>
            <View style={[styles.overviewFill, { width: `${Math.min(100, focusMinutes * 2)}%`, backgroundColor: C.primary }]} />
          </View>
        </View>
        <View style={[styles.overviewCard, { backgroundColor: C.lavender }]}>
          <Text style={styles.overviewEmoji}>✦</Text>
          <Text style={[styles.overviewValue, { color: '#715B86' }]}>{habits.length ? `${completedHabits}/${habits.length}` : '0/0'}</Text>
          <Text style={[styles.overviewLabel, { color: C.textSecondary }]}>Habits</Text>
          <View style={[styles.overviewBar, { backgroundColor: C.card }]}>
            <View style={[styles.overviewFill, { width: `${habits.length ? (completedHabits / habits.length) * 100 : 0}%`, backgroundColor: '#715B86' }]} />
          </View>
        </View>
      </View>

      {/* Quick Mood — uses actual MOODS */}
      <View style={[styles.moodCard, { backgroundColor: C.card }]}>
        <View style={styles.moodCardHeader}>
          <View>
            <Text style={[styles.cardTitle, { color: C.text }]}>How are you feeling?</Text>
            <Text style={[styles.cardHint, { color: C.textSecondary }]}>
              {moodObj ? `You're feeling ${moodObj.label} today` : 'Tap to log your mood'}
            </Text>
          </View>
          {moodObj && (
            <View style={[styles.currentMoodBadge, { backgroundColor: moodObj.color + '20' }]}>
              <MoodFace color={moodObj.color} moodValue={moodObj.value} size={28} />
            </View>
          )}
        </View>
        <View style={styles.moodRow}>
          {MOODS.map((mood) => {
            const isSelected = moodObj?.value === mood.value;
            return (
              <TouchableOpacity
                key={mood.value}
                style={[
                  styles.moodItem,
                  { backgroundColor: isSelected ? mood.color + '20' : C.background },
                  isSelected && { borderColor: mood.color, borderWidth: 2 },
                ]}
                onPress={() => handleQuickMood(mood.value)}
                activeOpacity={0.7}
              >
                <MoodFace color={mood.color} moodValue={mood.value} size={34} />
                <Text style={[styles.moodItemLabel, { color: isSelected ? mood.color : C.textSecondary }]}>
                  {mood.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Deep Work — uses router.navigate */}
      <TouchableOpacity
        style={[styles.sessionCard, { backgroundColor: C.primary }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.navigate('/(tabs)/focus');
        }}
        activeOpacity={0.82}
      >
        <View style={[styles.sessionGlow, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />
        <View style={styles.sessionTop}>
          <View>
            <Text style={styles.sessionKicker}>DEEP WORK</Text>
            <Text style={styles.sessionTitle}>Start a Session</Text>
          </View>
          <View style={styles.sessionChip}>
            <Text style={styles.sessionChipText}>{completedSessions} today</Text>
          </View>
        </View>
        <Text style={styles.sessionSub}>Block distractions and dive into focused deep work.</Text>
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

      {/* Today's Flow */}
      <View style={[styles.flowCard, { backgroundColor: C.card }]}>
        <View style={styles.rowBetween}>
          <Text style={[styles.cardTitle, { color: C.text }]}>Today's Flow</Text>
          <TouchableOpacity onPress={() => router.navigate('/(tabs)/habits')}>
            <Text style={[styles.linkText, { color: C.primary }]}>View all →</Text>
          </TouchableOpacity>
        </View>
        {habits.length === 0 ? (
          <View style={styles.emptyFlowState}>
            <Text style={styles.emptyFlowEmoji}>🌱</Text>
            <Text style={[styles.empty, { color: C.textSecondary }]}>Add habits to shape your daily rhythm.</Text>
          </View>
        ) : habits.slice(0, 4).map((habit) => {
          const done = completed.has(habit.id);
          return (
            <TouchableOpacity
              key={habit.id}
              style={[styles.flowItem, { backgroundColor: done ? C.primaryLight : C.background }]}
              onPress={() => toggleHabit(habit.id)}
              activeOpacity={0.75}
            >
              <View style={[styles.flowEmoji, { backgroundColor: done ? habit.color : C.card }]}>
                <Text style={{ fontSize: 16 }}>{habit.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[
                  styles.flowTitle, { color: C.text },
                  done && { textDecorationLine: 'line-through', opacity: 0.5 }
                ]} numberOfLines={1}>{habit.title}</Text>
              </View>
              <View style={[styles.check, { borderColor: done ? C.primary : C.border, backgroundColor: done ? C.primary : 'transparent' }]}>
                {done && <Text style={styles.checkMark}>✓</Text>}
              </View>
            </TouchableOpacity>
          );
        })}
        {habits.length > 0 && (
          <View style={[styles.flowProgressBar, { backgroundColor: C.background }]}>
            <View style={[styles.flowProgressFill, {
              width: `${habits.length ? (completedHabits / habits.length) * 100 : 0}%`,
              backgroundColor: completedHabits === habits.length ? '#6CC97C' : C.primary,
            }]} />
          </View>
        )}
      </View>

      {/* Tool cards */}
      <View style={styles.toolsGrid}>
        <ToolCard C={C} title="Planner" sub={planner?.intention || 'Set intention'} icon="📋" onPress={() => router.push('/planner')} />
        <ToolCard C={C} title="Sleep" sub={sleepDur || 'Log sleep'} icon="🌙" onPress={() => router.push('/sleep')} />
        <ToolCard C={C} title="Goals" sub={`${activeGoals.length} active`} icon="🎯" onPress={() => router.push('/goals')} />
        <ToolCard C={C} title="Notes" sub={notes[0]?.title || `${notes.length} notes`} icon="📝" onPress={() => router.push('/notes')} />
      </View>

      {/* Bottom links */}
      <View style={styles.bottomRow}>
        <TouchableOpacity
          style={[styles.bottomBtn, { backgroundColor: C.card, borderWidth: 1, borderColor: C.border }]}
          onPress={() => router.push('/insights')}
          activeOpacity={0.75}
        >
          <Text style={styles.bottomBtnEmoji}>📊</Text>
          <Text style={[styles.bottomBtnText, { color: C.primary }]}>Insights</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bottomBtn, { backgroundColor: C.card, borderWidth: 1, borderColor: C.border }]}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 54, paddingBottom: 28 },

  // Hero
  heroCard: {
    borderRadius: 26,
    padding: 20,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#172417',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  heroAccent: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  heroAccent2: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  heroInner: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroGreeting: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  heroTitle: {
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  heroSub: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
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
  flowBadgeSlash: { fontSize: 14, fontWeight: '700', marginTop: 4 },

  // Overview stats
  overviewGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  overviewCard: {
    flex: 1,
    borderRadius: 22,
    padding: 16,
    minHeight: 120,
    justifyContent: 'space-between',
  },
  overviewEmoji: { fontSize: 20, marginBottom: 4 },
  overviewValue: { fontSize: 26, fontWeight: '900', letterSpacing: 0 },
  overviewLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginTop: 2 },
  overviewBar: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 10 },
  overviewFill: { height: 6, borderRadius: 3 },

  // Mood card
  moodCard: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#172417',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  moodCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  currentMoodBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 17, fontWeight: '900', letterSpacing: 0 },
  cardHint: { fontSize: 11, marginTop: 4, fontWeight: '600' },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  moodItem: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  moodItemLabel: { fontSize: 9, fontWeight: '800', textTransform: 'capitalize' },

  // Session card
  sessionCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    minHeight: 160,
    overflow: 'hidden',
  },
  sessionGlow: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  sessionTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  sessionChip: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sessionChipText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  sessionKicker: { color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  sessionTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', marginTop: 6 },
  sessionSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, lineHeight: 17, marginTop: 8, maxWidth: 260 },
  sessionBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 18 },
  sessionTime: { color: '#FFFFFF', fontSize: 34, fontWeight: '900', letterSpacing: -1 },
  sessionTiny: { color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginTop: -2 },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  playText: { fontSize: 14, fontWeight: '900', marginLeft: 2 },

  // Flow card
  flowCard: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#172417',
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  linkText: { fontSize: 11, fontWeight: '900' },
  emptyFlowState: { alignItems: 'center', paddingVertical: 16, gap: 6 },
  emptyFlowEmoji: { fontSize: 28 },
  flowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: 16,
    padding: 12,
    marginTop: 8,
  },
  flowEmoji: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  flowTitle: { fontSize: 13, fontWeight: '800' },
  flowProgressBar: { height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 14 },
  flowProgressFill: { height: 5, borderRadius: 3 },
  empty: { fontSize: 12, lineHeight: 18 },

  // Tool cards
  toolsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  toolCard: {
    width: '47%',
    borderRadius: 18,
    padding: 15,
    minHeight: 90,
    justifyContent: 'space-between',
  },
  toolCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  toolIcon: { fontSize: 22 },
  toolArrow: { fontSize: 20, fontWeight: '300' },
  toolTitle: { fontSize: 14, fontWeight: '900' },
  toolSub: { fontSize: 11, fontWeight: '600', marginTop: 3 },

  // Bottom
  bottomRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  bottomBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 18,
    paddingVertical: 14,
  },
  bottomBtnEmoji: { fontSize: 14 },
  bottomBtnText: { fontSize: 12, fontWeight: '900' },
});
