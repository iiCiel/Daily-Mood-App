import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/context/ThemeContext';
import AestheticBackground from '../../src/components/AestheticBackground';
import MindfulHeader from '../../src/components/MindfulHeader';
import { cancelTimerNotification, showTimerNotification } from '../../src/notifications';
import {
  getRecentFocusLabels,
  getSessionsForDay,
  getTotalFocusMinutes,
  saveSession,
} from '../../src/db/focusDatabase';

const DEFAULT_DURATIONS = { focus: 25, short: 5, long: 15 };
const TIMER_KEY = 'focus_timer_state';
const MODE_LABELS = { focus: 'Focus', short: 'Short break', long: 'Long break' };
const MODE_ICONS = { focus: 'radio-button-on-outline', short: 'cafe-outline', long: 'walk-outline' };

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatSessionTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function FocusScreen() {
  const C = useTheme();

  const [mode, setMode] = useState('focus');
  const [durations, setDurations] = useState({ ...DEFAULT_DURATIONS });
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_DURATIONS.focus * 60);
  const [running, setRunning] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);

  const [editingDuration, setEditingDuration] = useState(false);
  const [draftDuration, setDraftDuration] = useState('');

  const [focusLabel, setFocusLabel] = useState('');
  const [recentLabels, setRecentLabels] = useState([]);
  const [labelInputFocused, setLabelInputFocused] = useState(false);

  const [todaySessions, setTodaySessions] = useState([]);
  const [totalMinutes, setTotalMinutes] = useState(0);

  const [breathingOpen, setBreathingOpen] = useState(false);
  const [breathPattern, setBreathPattern] = useState('box');
  const [breathPhase, setBreathPhase] = useState(null);
  const [breathCount, setBreathCount] = useState(0);
  const [breathCycle, setBreathCycle] = useState(0);

  const intervalRef = useRef(null);
  const sessionStartRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const bgTimeRef = useRef(null);
  const runningRef = useRef(false);
  const secondsLeftRef = useRef(DEFAULT_DURATIONS.focus * 60);
  const modeRef = useRef('focus');
  const durationsRef = useRef({ ...DEFAULT_DURATIONS });
  const sessionCountRef = useRef(0);
  const focusLabelRef = useRef('');
  const breathIntervalRef = useRef(null);

  runningRef.current = running;
  secondsLeftRef.current = secondsLeft;
  modeRef.current = mode;
  durationsRef.current = durations;
  sessionCountRef.current = sessionCount;
  focusLabelRef.current = focusLabel;

  useFocusEffect(useCallback(() => {
    loadStats();
  }, []));

  useEffect(() => {
    restoreTimerState();
  }, []);

  useEffect(() => () => {
    clearInterval(breathIntervalRef.current);
    clearInterval(intervalRef.current);
  }, []);

  async function restoreTimerState() {
    try {
      const raw = await AsyncStorage.getItem(TIMER_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        const newMode = saved.mode || 'focus';
        const newDurations = saved.durations || { ...DEFAULT_DURATIONS };
        setMode(newMode);
        setDurations(newDurations);
        setSessionCount(saved.sessionCount || 0);
        if (saved.focusLabel) setFocusLabel(saved.focusLabel);
        if (saved.running && saved.savedAt) {
          const elapsed = Math.floor((Date.now() - saved.savedAt) / 1000);
          const remaining = Math.max(0, (saved.secondsLeft || 0) - elapsed);
          if (remaining > 0) {
            setSecondsLeft(remaining);
            setRunning(true);
          } else {
            setSecondsLeft(newDurations[newMode] * 60);
          }
        } else {
          setSecondsLeft(saved.secondsLeft != null ? saved.secondsLeft : newDurations[newMode] * 60);
        }
      }
    } catch {}
    try {
      const labels = await getRecentFocusLabels(8);
      setRecentLabels(labels);
    } catch {}
  }

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appStateRef.current === 'active' && next.match(/inactive|background/)) {
        bgTimeRef.current = Date.now();
        AsyncStorage.setItem(TIMER_KEY, JSON.stringify({
          secondsLeft: secondsLeftRef.current,
          running: runningRef.current,
          mode: modeRef.current,
          durations: durationsRef.current,
          sessionCount: sessionCountRef.current,
          focusLabel: focusLabelRef.current,
          savedAt: Date.now(),
        })).catch(() => {});
      } else if (next === 'active' && bgTimeRef.current && runningRef.current) {
        const elapsed = Math.floor((Date.now() - bgTimeRef.current) / 1000);
        setSecondsLeft((s) => Math.max(0, s - elapsed));
        bgTimeRef.current = null;
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(intervalRef.current);
            handleTimerComplete();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  async function loadStats() {
    try {
      const [sessions, total, labels] = await Promise.all([
        getSessionsForDay(todayStr()),
        getTotalFocusMinutes(),
        getRecentFocusLabels(8),
      ]);
      setTodaySessions(sessions);
      setTotalMinutes(total);
      setRecentLabels(labels);
    } catch {}
  }

  async function handleTimerComplete() {
    cancelTimerNotification().catch(() => {});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const isFocus = mode === 'focus';
    if (isFocus) {
      const label = focusLabelRef.current.trim();
      await saveSession({
        taskId: null,
        label: label || null,
        duration: durations[mode],
        completed: true,
        date: todayStr(),
        startedAt: sessionStartRef.current,
        endedAt: new Date().toISOString(),
      });
      setSessionCount((c) => c + 1);
      await loadStats();
    }
    setRunning(false);
    Alert.alert(
      isFocus ? 'Session complete' : 'Break over',
      isFocus
        ? `Nice work${focusLabelRef.current.trim() ? ` on "${focusLabelRef.current.trim()}"` : ''}. Take a real break.`
        : 'Ready to focus again?'
    );
  }

  function startTimer() {
    sessionStartRef.current = new Date().toISOString();
    setRunning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    showTimerNotification(secondsLeftRef.current, focusLabelRef.current.trim() || null).catch(() => {});
  }

  function pauseTimer() {
    setRunning(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    cancelTimerNotification().catch(() => {});
  }

  function resetTimer() {
    setRunning(false);
    setSecondsLeft(durations[mode] * 60);
    cancelTimerNotification().catch(() => {});
  }

  function switchMode(nextMode) {
    setRunning(false);
    setMode(nextMode);
    setSecondsLeft(durations[nextMode] * 60);
  }

  function openEditDuration() {
    setDraftDuration(String(durations[mode]));
    setEditingDuration(true);
  }

  function saveDuration() {
    const mins = parseInt(draftDuration, 10);
    if (!mins || mins < 1 || mins > 240) {
      Alert.alert('Invalid duration', 'Enter a number between 1 and 240.');
      return;
    }
    const updated = { ...durations, [mode]: mins };
    setDurations(updated);
    setSecondsLeft(mins * 60);
    setEditingDuration(false);
  }

  const BREATH_PATTERNS = {
    box:   { label: 'Box',   phases: ['inhale','hold','exhale','hold2'], durations: [4,4,4,4], phaseLabels: ['Inhale','Hold','Exhale','Hold'] },
    calm:  { label: 'Calm',  phases: ['inhale','exhale'],                durations: [5,6],     phaseLabels: ['Inhale','Exhale'] },
    reset: { label: 'Reset', phases: ['inhale','hold','exhale'],         durations: [4,2,6],   phaseLabels: ['Inhale','Hold','Exhale'] },
  };

  function startBreathing() {
    const pattern = BREATH_PATTERNS[breathPattern];
    let phaseIdx = 0;
    let secs = pattern.durations[0];
    setBreathPhase(pattern.phaseLabels[0]);
    setBreathCount(secs);
    setBreathCycle(1);
    clearInterval(breathIntervalRef.current);
    breathIntervalRef.current = setInterval(() => {
      secs -= 1;
      if (secs <= 0) {
        phaseIdx = (phaseIdx + 1) % pattern.phases.length;
        secs = pattern.durations[phaseIdx];
        setBreathPhase(pattern.phaseLabels[phaseIdx]);
        if (phaseIdx === 0) setBreathCycle((c) => c + 1);
      }
      setBreathCount(secs);
    }, 1000);
  }

  function stopBreathing() {
    clearInterval(breathIntervalRef.current);
    setBreathPhase(null);
    setBreathCount(0);
    setBreathCycle(0);
  }

  const totalSecs = durations[mode] * 60;
  const progress = totalSecs ? Math.max(0, Math.min(1, 1 - secondsLeft / totalSecs)) : 0;
  const progressPct = `${Math.round(progress * 100)}%`;
  const todayCompleteSessions = todaySessions.filter((s) => s.completed);
  const todayMins = todayCompleteSessions.reduce((sum, s) => sum + s.duration, 0);
  const todayCount = todayCompleteSessions.length;
  const allHours = Math.floor(totalMinutes / 60);

  // Group today's sessions by label for the breakdown
  const labelBreakdown = todayCompleteSessions.reduce((acc, s) => {
    const key = s.task_title || 'Unlabeled';
    acc[key] = (acc[key] || 0) + s.duration;
    return acc;
  }, {});
  const breakdownEntries = Object.entries(labelBreakdown).sort((a, b) => b[1] - a[1]);

  // Filter suggestion chips — exclude whatever is already typed
  const suggestions = recentLabels.filter(
    (l) => !focusLabel || l.toLowerCase() !== focusLabel.toLowerCase()
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.container, { backgroundColor: C.background }]}>
        <AestheticBackground />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <MindfulHeader
            C={C}
            eyebrow="focus studio"
            title="Deep Work"
            rightIcon="stats-chart-outline"
            onRightPress={() => router.push('/focus-stats')}
          />

          {/* ── Timer panel ─────────────────────────────── */}
          <View style={[styles.timerPanel, { backgroundColor: '#0B1020' }]}>
            <AestheticBackground dark />
            <View style={styles.timerPanelInner}>
              <View style={styles.modeRow}>
                {Object.keys(DEFAULT_DURATIONS).map((key) => {
                  const active = mode === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.modeBtn, active && { backgroundColor: '#FFFFFF' }]}
                      onPress={() => switchMode(key)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name={MODE_ICONS[key]} size={15} color={active ? '#0B1020' : 'rgba(255,255,255,0.70)'} />
                      <Text style={[styles.modeText, { color: active ? '#0B1020' : 'rgba(255,255,255,0.70)' }]}>
                        {MODE_LABELS[key]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.timerMain}>
                <Text style={styles.timerKicker}>{running ? 'running' : progress > 0 ? 'paused' : 'ready'}</Text>
                <TouchableOpacity onPress={running ? undefined : openEditDuration} activeOpacity={0.8}>
                  <Text style={styles.timerText}>{formatTime(secondsLeft)}</Text>
                </TouchableOpacity>
                <Text style={styles.timerSub}>
                  {durations[mode]} minute {MODE_LABELS[mode].toLowerCase()}
                </Text>
              </View>

              <View style={styles.progressWrap}>
                <View style={styles.progressTrackDark}>
                  <View style={[styles.progressFillDark, { width: progressPct }]} />
                </View>
                <Text style={styles.progressLabel}>{progressPct}</Text>
              </View>

              {/* Label input */}
              <View style={styles.labelInputWrap}>
                <Ionicons name="pencil-outline" size={15} color="rgba(255,255,255,0.65)" />
                <TextInput
                  style={styles.labelInput}
                  value={focusLabel}
                  onChangeText={setFocusLabel}
                  onFocus={() => setLabelInputFocused(true)}
                  onBlur={() => setLabelInputFocused(false)}
                  placeholder="What are you focusing on?"
                  placeholderTextColor="rgba(255,255,255,0.38)"
                  returnKeyType="done"
                  maxLength={60}
                />
                {!!focusLabel && (
                  <TouchableOpacity onPress={() => setFocusLabel('')} hitSlop={10}>
                    <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.45)" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Suggestion chips */}
              {suggestions.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  {suggestions.map((label) => (
                    <TouchableOpacity
                      key={label}
                      style={styles.chip}
                      onPress={() => {
                        setFocusLabel(label);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.chipText}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <View style={styles.controls}>
                <TouchableOpacity style={styles.secondaryControl} onPress={resetTimer} activeOpacity={0.75}>
                  <Ionicons name="refresh-outline" size={19} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryControl} onPress={running ? pauseTimer : startTimer} activeOpacity={0.82}>
                  <Ionicons name={running ? 'pause' : 'play'} size={24} color="#0B1020" />
                  <Text style={styles.primaryControlText}>
                    {running ? 'Pause' : secondsLeft === totalSecs ? 'Start' : 'Resume'}
                  </Text>
                </TouchableOpacity>
                <View style={styles.secondaryControl} />
              </View>
            </View>
          </View>

          {/* ── Stats ───────────────────────────────────── */}
          <View style={styles.statsGrid}>
            <FocusStat C={C} label="Today" value={`${todayMins}m`} icon="today-outline" color={C.primary} />
            <FocusStat C={C} label="Sessions" value={todayCount} icon="layers-outline" color={C.accent} />
            <FocusStat C={C} label="All time" value={`${allHours}h`} icon="infinite-outline" color={C.teal || C.success} />
          </View>

          {/* ── Today breakdown by label ─────────────────── */}
          {breakdownEntries.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={[styles.sectionTitle, { color: C.text }]}>Today's focus</Text>
                  <Text style={[styles.sectionSub, { color: C.textSecondary }]}>Where your time went.</Text>
                </View>
              </View>
              <View style={[styles.breakdownCard, { backgroundColor: C.card, borderColor: C.border }]}>
                {breakdownEntries.map(([label, mins], idx) => {
                  const pct = todayMins > 0 ? mins / todayMins : 0;
                  return (
                    <View key={label} style={[styles.breakdownRow, idx > 0 && { borderTopWidth: 1, borderTopColor: C.border }]}>
                      <Text style={[styles.breakdownLabel, { color: C.text }]} numberOfLines={1}>{label}</Text>
                      <View style={styles.breakdownBarWrap}>
                        <View style={[styles.breakdownBarTrack, { backgroundColor: `${C.primary}20` }]}>
                          <View style={[styles.breakdownBarFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: C.primary }]} />
                        </View>
                      </View>
                      <Text style={[styles.breakdownMins, { color: C.textSecondary }]}>{mins}m</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {/* ── Breathing ───────────────────────────────── */}
          <BreathingPanel
            C={C}
            open={breathingOpen}
            setOpen={setBreathingOpen}
            patterns={BREATH_PATTERNS}
            breathPattern={breathPattern}
            setBreathPattern={setBreathPattern}
            breathPhase={breathPhase}
            breathCount={breathCount}
            breathCycle={breathCycle}
            startBreathing={startBreathing}
            stopBreathing={stopBreathing}
          />

          {/* ── Today log ───────────────────────────────── */}
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: C.text }]}>Today log</Text>
              <Text style={[styles.sectionSub, { color: C.textSecondary }]}>Completed focus blocks.</Text>
            </View>
          </View>
          <View style={styles.sessionList}>
            {todayCompleteSessions.length === 0 ? (
              <View style={[styles.emptyLog, { backgroundColor: C.card, borderColor: C.border }]}>
                <Ionicons name="moon-outline" size={19} color={C.textSecondary} />
                <Text style={[styles.emptyLogText, { color: C.textSecondary }]}>No focus blocks yet today.</Text>
              </View>
            ) : (
              todayCompleteSessions.slice(0, 8).map((session) => (
                <SessionRow key={session.id} C={C} session={session} />
              ))
            )}
          </View>
        </ScrollView>

        {/* ── Duration editor ─────────────────────────── */}
        <Modal visible={editingDuration} transparent animationType="fade" onRequestClose={() => setEditingDuration(false)}>
          <TouchableOpacity style={styles.durationOverlay} onPress={() => setEditingDuration(false)} activeOpacity={1}>
            <View style={[styles.durationSheet, { backgroundColor: C.card }]}>
              <Text style={[styles.durationTitle, { color: C.text }]}>Set {MODE_LABELS[mode].toLowerCase()}</Text>
              <View style={[styles.durationInputRow, { borderColor: C.border, backgroundColor: C.background }]}>
                <TextInput
                  style={[styles.durationInput, { color: C.text }]}
                  value={draftDuration}
                  onChangeText={setDraftDuration}
                  keyboardType="number-pad"
                  autoFocus
                  maxLength={3}
                />
                <Text style={[styles.durationUnit, { color: C.textSecondary }]}>minutes</Text>
              </View>
              <TouchableOpacity style={[styles.durationSave, { backgroundColor: C.text }]} onPress={saveDuration}>
                <Text style={[styles.durationSaveText, { color: C.background }]}>Set duration</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

function FocusStat({ C, label, value, icon, color }) {
  return (
    <View style={[styles.statCard, { backgroundColor: C.card, borderColor: C.border }]}>
      <View style={[styles.statIcon, { backgroundColor: `${color}16` }]}>
        <Ionicons name={icon} size={17} color={color} />
      </View>
      <Text style={[styles.statValue, { color: C.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: C.textSecondary }]}>{label}</Text>
    </View>
  );
}

function BreathingPanel({ C, open, setOpen, patterns, breathPattern, setBreathPattern, breathPhase, breathCount, breathCycle, startBreathing, stopBreathing }) {
  const pattern = patterns[breathPattern];
  return (
    <View style={[styles.breathPanel, { backgroundColor: C.card, borderColor: C.border }]}>
      <TouchableOpacity style={styles.breathHeader} onPress={() => setOpen(!open)} activeOpacity={0.75}>
        <View>
          <Text style={[styles.sectionTitle, { color: C.text }]}>Reset room</Text>
          <Text style={[styles.sectionSub, { color: C.textSecondary }]}>Breathing patterns between sessions.</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={C.textSecondary} />
      </TouchableOpacity>
      {open && (
        <View style={styles.breathBody}>
          <View style={styles.breathPatterns}>
            {Object.entries(patterns).map(([key, value]) => {
              const active = breathPattern === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.breathPatternBtn, { backgroundColor: active ? C.text : C.background, borderColor: C.border }]}
                  onPress={() => { stopBreathing(); setBreathPattern(key); }}
                >
                  <Text style={[styles.breathPatternText, { color: active ? C.background : C.textSecondary }]}>{value.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={[styles.breathStage, { backgroundColor: C.background, borderColor: C.border }]}>
            {breathPhase ? (
              <>
                <Text style={[styles.breathPhase, { color: C.text }]}>{breathPhase}</Text>
                <Text style={[styles.breathCount, { color: C.primary }]}>{breathCount}</Text>
                <Text style={[styles.breathCycle, { color: C.textSecondary }]}>cycle {breathCycle}</Text>
                <TouchableOpacity style={[styles.breathAction, { backgroundColor: C.text }]} onPress={stopBreathing}>
                  <Text style={[styles.breathActionText, { color: C.background }]}>Stop</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={[styles.breathHint, { color: C.textSecondary }]}>
                  {pattern.phaseLabels.map((label, i) => `${label} ${pattern.durations[i]}s`).join(' / ')}
                </Text>
                <TouchableOpacity style={[styles.breathAction, { backgroundColor: C.text }]} onPress={startBreathing}>
                  <Text style={[styles.breathActionText, { color: C.background }]}>Start breathing</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

function SessionRow({ C, session }) {
  return (
    <View style={[styles.sessionRow, { backgroundColor: C.card, borderColor: C.border }]}>
      <View style={[styles.sessionIcon, { backgroundColor: `${C.primary}18` }]}>
        <Ionicons name="timer-outline" size={17} color={C.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.sessionTitle, { color: C.text }]} numberOfLines={1}>
          {session.task_title || 'Focus block'}
        </Text>
        <Text style={[styles.sessionMeta, { color: C.textSecondary }]}>
          {session.duration}m · {formatSessionTime(session.started_at)}
        </Text>
      </View>
      <Ionicons name="checkmark-circle" size={20} color={C.success} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 20, paddingTop: 54, paddingBottom: 42 },

  timerPanel: { borderRadius: 24, overflow: 'hidden', marginBottom: 14, shadowColor: '#0B1020', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 16 }, elevation: 8 },
  timerPanelInner: { padding: 18, gap: 14 },
  modeRow: { flexDirection: 'row', gap: 7 },
  modeBtn: { flex: 1, minHeight: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5, backgroundColor: 'rgba(255,255,255,0.10)' },
  modeText: { fontSize: 11, fontWeight: '900' },
  timerMain: { alignItems: 'center', paddingVertical: 10 },
  timerKicker: { color: 'rgba(255,255,255,0.58)', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  timerText: { color: '#FFFFFF', fontSize: 64, lineHeight: 72, fontWeight: '900', marginTop: 4 },
  timerSub: { color: 'rgba(255,255,255,0.68)', fontSize: 13, fontWeight: '800' },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressTrackDark: { flex: 1, height: 9, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  progressFillDark: { height: 9, borderRadius: 999, backgroundColor: '#FFFFFF' },
  progressLabel: { color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: '900', width: 44, textAlign: 'right' },

  labelInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 15, paddingHorizontal: 13, paddingVertical: 11 },
  labelInput: { flex: 1, color: '#FFFFFF', fontSize: 14, fontWeight: '800' },

  chips: { gap: 7, paddingVertical: 2 },
  chip: { backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 20, paddingHorizontal: 13, paddingVertical: 7 },
  chipText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },

  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  secondaryControl: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  primaryControl: { minWidth: 142, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, backgroundColor: '#FFFFFF' },
  primaryControlText: { color: '#0B1020', fontSize: 15, fontWeight: '900' },

  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: { flex: 1, borderRadius: 17, borderWidth: 1, padding: 12, minHeight: 104 },
  statIcon: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: 22, fontWeight: '900' },
  statLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginTop: 2 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '900' },
  sectionSub: { fontSize: 12, fontWeight: '700', marginTop: 2 },

  breakdownCard: { borderRadius: 18, borderWidth: 1, marginBottom: 20, overflow: 'hidden' },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  breakdownLabel: { fontSize: 13, fontWeight: '800', width: 100 },
  breakdownBarWrap: { flex: 1 },
  breakdownBarTrack: { height: 7, borderRadius: 999, overflow: 'hidden' },
  breakdownBarFill: { height: 7, borderRadius: 999 },
  breakdownMins: { fontSize: 12, fontWeight: '900', width: 32, textAlign: 'right' },

  breathPanel: { borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 20 },
  breathHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  breathBody: { gap: 12, marginTop: 14 },
  breathPatterns: { flexDirection: 'row', gap: 8 },
  breathPatternBtn: { flex: 1, borderRadius: 13, borderWidth: 1, paddingVertical: 9, alignItems: 'center' },
  breathPatternText: { fontSize: 12, fontWeight: '900' },
  breathStage: { borderWidth: 1, borderRadius: 16, minHeight: 132, alignItems: 'center', justifyContent: 'center', padding: 16 },
  breathPhase: { fontSize: 24, fontWeight: '900' },
  breathCount: { fontSize: 48, fontWeight: '900', marginTop: 2 },
  breathCycle: { fontSize: 12, fontWeight: '800', marginBottom: 12 },
  breathHint: { fontSize: 13, lineHeight: 20, fontWeight: '800', textAlign: 'center', marginBottom: 14 },
  breathAction: { borderRadius: 14, paddingHorizontal: 18, paddingVertical: 11 },
  breathActionText: { fontSize: 13, fontWeight: '900' },

  sessionList: { gap: 8 },
  emptyLog: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, borderWidth: 1, padding: 16 },
  emptyLogText: { fontSize: 13, fontWeight: '800' },
  sessionRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, padding: 12, gap: 12 },
  sessionIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sessionTitle: { fontSize: 14, fontWeight: '900' },
  sessionMeta: { fontSize: 12, fontWeight: '700', marginTop: 2 },

  durationOverlay: { flex: 1, backgroundColor: 'rgba(11,16,32,0.48)', justifyContent: 'flex-end' },
  durationSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 34, gap: 14 },
  durationTitle: { fontSize: 20, fontWeight: '900' },
  durationInputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 17, paddingHorizontal: 14 },
  durationInput: { flex: 1, fontSize: 38, fontWeight: '900', paddingVertical: 8 },
  durationUnit: { fontSize: 14, fontWeight: '800' },
  durationSave: { borderRadius: 16, alignItems: 'center', paddingVertical: 15 },
  durationSaveText: { fontSize: 15, fontWeight: '900' },
});
