import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ImageBackground, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/context/ThemeContext';
import { getSessionsForDay, getTotalFocusMinutes, saveSession } from '../../src/db/focusDatabase';
import { cancelTimerNotification, showTimerNotification } from '../../src/notifications';
import StorybookHeroFade from '../../src/components/StorybookHeroFade';
import { getStoryHeroHeight, STORY_TAB_BOTTOM_PADDING } from '../../src/constants/storybookLayout';

const focusArt = require('../../assets/illustrations/storybook-focus.png');
const paperArt = require('../../assets/illustrations/storybook-paper-rich.png');
const DEFAULT_SECONDS = 25 * 60;

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function FocusScreen() {
  const C = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_SECONDS);
  const [running, setRunning] = useState(false);
  const [label, setLabel] = useState('');
  const [todaySessions, setTodaySessions] = useState([]);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const intervalRef = useRef(null);
  const startedAtRef = useRef(null);
  const targetEndRef = useRef(null);
  const secondsLeftRef = useRef(DEFAULT_SECONDS);
  const labelRef = useRef('');
  const completingRef = useRef(false);

  useFocusEffect(useCallback(() => {
    loadStats();
  }, []));

  useEffect(() => {
    secondsLeftRef.current = secondsLeft;
  }, [secondsLeft]);

  useEffect(() => {
    labelRef.current = label;
  }, [label]);

  useEffect(() => {
    if (!running) {
      clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      const remaining = getRemainingSeconds();
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(intervalRef.current);
        completeSession({ finished: true });
      }
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [running]);

  async function loadStats() {
    const [sessions, total] = await Promise.all([getSessionsForDay(todayStr()), getTotalFocusMinutes()]);
    setTodaySessions(sessions.filter((s) => s.completed));
    setTotalMinutes(total);
  }

  function getRemainingSeconds() {
    if (!targetEndRef.current) return secondsLeftRef.current;
    return Math.max(0, Math.ceil((targetEndRef.current - Date.now()) / 1000));
  }

  function getElapsedSeconds() {
    if (!targetEndRef.current) return DEFAULT_SECONDS - secondsLeftRef.current;
    return Math.min(DEFAULT_SECONDS, Math.max(0, DEFAULT_SECONDS - getRemainingSeconds()));
  }

  async function completeSession({ finished = false } = {}) {
    if (completingRef.current) return;
    completingRef.current = true;
    const elapsedSeconds = finished ? DEFAULT_SECONDS : getElapsedSeconds();
    await cancelTimerNotification();
    if (elapsedSeconds <= 0) {
      resetTimerState();
      return;
    }
    const mins = finished ? Math.round(DEFAULT_SECONDS / 60) : Math.max(1, Math.round(elapsedSeconds / 60));
    await saveSession({
      taskId: null,
      label: labelRef.current.trim() || null,
      duration: mins,
      completed: true,
      date: todayStr(),
      startedAt: startedAtRef.current || new Date().toISOString(),
      endedAt: new Date().toISOString(),
    });
    resetTimerState();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await loadStats();
  }

  async function toggleTimer() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (running) {
      const remaining = getRemainingSeconds();
      secondsLeftRef.current = remaining;
      setSecondsLeft(remaining);
      setRunning(false);
      targetEndRef.current = null;
      await cancelTimerNotification();
      return;
    }
    if (secondsLeftRef.current <= 0) secondsLeftRef.current = DEFAULT_SECONDS;
    if (secondsLeftRef.current === DEFAULT_SECONDS || !startedAtRef.current) {
      startedAtRef.current = new Date().toISOString();
    }
    targetEndRef.current = Date.now() + secondsLeftRef.current * 1000;
    completingRef.current = false;
    setRunning(true);
    await showTimerNotification(secondsLeftRef.current, labelRef.current.trim() || null);
  }

  function resetTimerState() {
    setRunning(false);
    clearInterval(intervalRef.current);
    targetEndRef.current = null;
    startedAtRef.current = null;
    secondsLeftRef.current = DEFAULT_SECONDS;
    setSecondsLeft(DEFAULT_SECONDS);
    completingRef.current = false;
  }

  async function resetTimer() {
    await cancelTimerNotification();
    resetTimerState();
  }

  const todayMinutes = todaySessions.reduce((sum, session) => sum + session.duration, 0);
  const progress = 1 - secondsLeft / DEFAULT_SECONDS;
  const ringDeg = `${Math.max(10, Math.round(progress * 300))}deg`;
  const heroHeight = getStoryHeroHeight(screenHeight, { min: 500, max: 560, ratio: 0.56 });

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView style={styles.pageScroll} contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
        <ImageBackground source={focusArt} style={[styles.hero, { height: heroHeight }]} imageStyle={styles.heroImage}>
          <StorybookHeroFade />
          <View style={styles.topBar}>
            <TouchableOpacity style={[styles.statsChip, { backgroundColor: C.white }]} onPress={() => router.push('/focus-stats')}>
              <Ionicons name="stats-chart-outline" size={16} color={C.primary} />
              <Text style={[styles.statsChipText, { color: C.text }]}>Stats</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.clockWrap}>
            <View style={[styles.clockRing, { borderColor: C.primaryLight }]}>
              <View style={[styles.clockArc, { borderTopColor: C.primary, transform: [{ rotate: ringDeg }] }]} />
              <Text style={[styles.timer, { color: C.text }]}>{formatTime(secondsLeft)}</Text>
              <Text style={[styles.subtitle, { color: C.textSecondary }]}>{running ? 'focusing' : 'press play'}</Text>
              <View style={styles.transport}>
                <TouchableOpacity onPress={resetTimer}>
                  <Ionicons name="play-skip-back" size={16} color={C.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.play, { backgroundColor: C.primaryLight }]} onPress={toggleTimer}>
                  <Ionicons name={running ? 'pause' : 'play'} size={17} color={C.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={completeSession}>
                  <Ionicons name="play-skip-forward" size={16} color={C.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ImageBackground>

        <ImageBackground source={paperArt} style={[styles.sheet, styles.sheetContent]} imageStyle={styles.sheetImage}>
          <View style={[styles.player, { backgroundColor: C.card, borderColor: C.border }]}>
            <Ionicons name="headset-outline" size={20} color={C.primary} />
            <TextInput
              style={[styles.input, { color: C.text }]}
              value={label}
              onChangeText={setLabel}
              placeholder="What are you focusing on?"
              placeholderTextColor={C.textSecondary}
            />
          </View>

          <View style={styles.statsRow}>
            <Stat C={C} value={`${todayMinutes}m`} label="today" />
            <Stat C={C} value={todaySessions.length} label="sessions" />
            <Stat C={C} value={`${Math.floor(totalMinutes / 60)}h`} label="all time" />
          </View>

          <Text style={[styles.sectionTitle, { color: C.text }]}>Recent sessions</Text>
          <View style={styles.trackList}>
            {todaySessions.length === 0 ? (
              <View style={[styles.track, { backgroundColor: C.card, borderColor: C.border }]}>
                <Text style={[styles.trackTitle, { color: C.textSecondary }]}>No focus sessions yet today.</Text>
              </View>
            ) : todaySessions.slice(0, 6).map((session) => (
              <View key={session.id} style={[styles.track, { backgroundColor: C.card, borderColor: C.border }]}>
                <Ionicons name="timer-outline" size={18} color={C.primary} />
                <Text style={[styles.trackTitle, { color: C.text }]} numberOfLines={1}>{session.task_title || session.label || 'Focus session'}</Text>
                <Text style={[styles.trackMeta, { color: C.textSecondary }]}>{session.duration}m</Text>
              </View>
            ))}
          </View>
        </ImageBackground>
      </ScrollView>
    </View>
  );
}

function Stat({ C, value, label }) {
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
  hero: { paddingTop: 56, paddingHorizontal: 22 },
  heroImage: { resizeMode: 'cover' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  circleBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', shadowColor: '#8D94BE', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  statsChip: {
    minHeight: 36,
    borderRadius: 18,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#8D94BE',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  statsChipText: { fontFamily: 'Rounded', fontSize: 12, fontWeight: '900' },
  clockWrap: { alignItems: 'center', marginTop: 54 },
  clockRing: { width: 210, height: 210, borderRadius: 105, borderWidth: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.56)' },
  clockArc: { position: 'absolute', width: 210, height: 210, borderRadius: 105, borderWidth: 14, borderColor: 'transparent' },
  timer: { fontFamily: 'Rounded', fontSize: 42, fontWeight: '900' },
  subtitle: { fontFamily: 'Rounded', fontSize: 11, fontWeight: '900', marginTop: 2 },
  transport: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 },
  play: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  sheet: {
    marginTop: 0,
    minHeight: 520,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    overflow: 'hidden',
  },
  sheetImage: { resizeMode: 'cover', borderTopLeftRadius: 34, borderTopRightRadius: 34 },
  sheetContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: STORY_TAB_BOTTOM_PADDING },
  player: { minHeight: 58, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  input: { flex: 1, fontFamily: 'Rounded', fontSize: 14, fontWeight: '800' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  stat: { flex: 1, borderWidth: 1, borderRadius: 20, padding: 14, alignItems: 'center' },
  statValue: { fontFamily: 'Rounded', fontSize: 20, fontWeight: '900' },
  statLabel: { fontFamily: 'Rounded', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  sectionTitle: { fontFamily: 'Rounded', fontSize: 18, fontWeight: '900', marginBottom: 10 },
  trackList: { gap: 10 },
  track: { minHeight: 58, borderRadius: 18, borderWidth: 1, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  trackTitle: { flex: 1, fontFamily: 'Rounded', fontSize: 14, fontWeight: '900' },
  trackMeta: { fontFamily: 'Rounded', fontSize: 12, fontWeight: '900' },
});
