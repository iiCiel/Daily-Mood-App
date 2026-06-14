import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ImageBackground, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/context/ThemeContext';
import { getSessionsForDay, getTotalFocusMinutes, saveSession } from '../../src/db/focusDatabase';
import StorybookHeroFade from '../../src/components/StorybookHeroFade';

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
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_SECONDS);
  const [running, setRunning] = useState(false);
  const [label, setLabel] = useState('');
  const [todaySessions, setTodaySessions] = useState([]);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const intervalRef = useRef(null);
  const startedAtRef = useRef(null);

  useFocusEffect(useCallback(() => {
    loadStats();
  }, []));

  useEffect(() => {
    if (!running) {
      clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          completeSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [running]);

  async function loadStats() {
    const [sessions, total] = await Promise.all([getSessionsForDay(todayStr()), getTotalFocusMinutes()]);
    setTodaySessions(sessions.filter((s) => s.completed));
    setTotalMinutes(total);
  }

  async function completeSession() {
    const mins = Math.round((DEFAULT_SECONDS - secondsLeft) / 60) || 25;
    await saveSession({
      taskId: null,
      label: label.trim() || null,
      duration: mins,
      completed: true,
      date: todayStr(),
      startedAt: startedAtRef.current || new Date().toISOString(),
      endedAt: new Date().toISOString(),
    });
    setRunning(false);
    setSecondsLeft(DEFAULT_SECONDS);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await loadStats();
  }

  function toggleTimer() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!running && secondsLeft === DEFAULT_SECONDS) startedAtRef.current = new Date().toISOString();
    setRunning((r) => !r);
  }

  function resetTimer() {
    setRunning(false);
    setSecondsLeft(DEFAULT_SECONDS);
  }

  const todayMinutes = todaySessions.reduce((sum, session) => sum + session.duration, 0);
  const progress = 1 - secondsLeft / DEFAULT_SECONDS;
  const ringDeg = `${Math.max(10, Math.round(progress * 300))}deg`;

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView style={styles.pageScroll} contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
        <ImageBackground source={focusArt} style={styles.hero} imageStyle={styles.heroImage}>
          <StorybookHeroFade />
          <View style={styles.topBar}>
            <TouchableOpacity style={[styles.circleBtn, { backgroundColor: C.white }]} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={18} color={C.text} />
            </TouchableOpacity>
            <Text style={[styles.topTitle, { color: C.text }]}>Love Story</Text>
            <TouchableOpacity style={[styles.circleBtn, { backgroundColor: C.white }]} onPress={() => router.push('/focus-stats')}>
              <Ionicons name="stats-chart-outline" size={17} color={C.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.clockWrap}>
            <View style={[styles.clockRing, { borderColor: C.primaryLight }]}>
              <View style={[styles.clockArc, { borderTopColor: C.primary, transform: [{ rotate: ringDeg }] }]} />
              <Text style={[styles.timer, { color: C.text }]}>{formatTime(secondsLeft)}</Text>
              <Text style={[styles.subtitle, { color: C.textSecondary }]}>{running ? 'playing focus' : 'press play'}</Text>
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
            <Stat C={C} value={todaySessions.length} label="tracks" />
            <Stat C={C} value={`${Math.floor(totalMinutes / 60)}h`} label="all time" />
          </View>

          <Text style={[styles.sectionTitle, { color: C.text }]}>Recent tracks</Text>
          <View style={styles.trackList}>
            {todaySessions.length === 0 ? (
              <View style={[styles.track, { backgroundColor: C.card, borderColor: C.border }]}>
                <Text style={[styles.trackTitle, { color: C.textSecondary }]}>No focus songs yet today.</Text>
              </View>
            ) : todaySessions.slice(0, 6).map((session) => (
              <View key={session.id} style={[styles.track, { backgroundColor: C.card, borderColor: C.border }]}>
                <Ionicons name="musical-note" size={18} color={C.primary} />
                <Text style={[styles.trackTitle, { color: C.text }]} numberOfLines={1}>{session.task_title || 'Focus track'}</Text>
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
  hero: { height: 560, paddingTop: 56, paddingHorizontal: 22 },
  heroImage: { resizeMode: 'cover' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  circleBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', shadowColor: '#8D94BE', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  topTitle: { fontFamily: 'Rounded', fontSize: 17, fontWeight: '900' },
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
  sheetContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 140 },
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
