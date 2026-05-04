import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  AppState,
  Dimensions,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../src/context/ThemeContext';
import { COLORS } from '../../src/constants/theme';
import MindfulHeader from '../../src/components/MindfulHeader';
import AestheticBackground from '../../src/components/AestheticBackground';
import { showTimerNotification, cancelTimerNotification } from '../../src/notifications';
import {
  saveSession, getSessionsForDay, getTotalFocusMinutes, getTaskPomodoroCount,
} from '../../src/db/focusDatabase';
import { getPlanningTasks, togglePlanningTask } from '../../src/db/plannerDatabase';

const { width: SCREEN_W } = Dimensions.get('window');

const FOCUS_ORANGE = '#D9713E';
const FOCUS_ORANGE_LIGHT = 'rgba(217, 113, 62, 0.10)';

const DEFAULT_DURATIONS = { focus: 25, short: 5, long: 15 };
const TIMER_KEY = 'focus_timer_state';
const MODE_LABELS = { focus: 'focus', short: 'short break', long: 'long break' };

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Proper arc ring using pure RN views (two half-circles clipped)
function ProgressRing({ progress, size, strokeWidth, color, bgColor }) {
  const R = (size - strokeWidth) / 2;
  const deg = progress * 360;

  // We use two rotating half-discs to draw the arc
  const firstHalfDeg = Math.min(deg, 180);
  const secondHalfDeg = Math.max(0, deg - 180);

  return (
    <View style={{ width: size, height: size, position: 'absolute' }}>
      {/* BG ring */}
      <View style={{
        position: 'absolute', width: size, height: size,
        borderRadius: size / 2, borderWidth: strokeWidth, borderColor: bgColor,
      }} />

      {/* Left half clip */}
      <View style={{
        position: 'absolute', width: size / 2, height: size,
        left: 0, overflow: 'hidden',
      }}>
        <View style={{
          position: 'absolute', width: size, height: size,
          borderRadius: size / 2, borderWidth: strokeWidth,
          borderColor: firstHalfDeg > 0 ? color : 'transparent',
          transform: [{ rotate: `${firstHalfDeg - 180}deg` }],
          left: 0,
        }} />
      </View>

      {/* Right half clip */}
      <View style={{
        position: 'absolute', width: size / 2, height: size,
        right: 0, overflow: 'hidden',
      }}>
        <View style={{
          position: 'absolute', width: size, height: size,
          borderRadius: size / 2, borderWidth: strokeWidth,
          borderColor: deg > 0 ? color : 'transparent',
          transform: [{ rotate: `${secondHalfDeg}deg` }],
          right: 0,
        }} />
      </View>
    </View>
  );
}

export default function FocusScreen() {
  const C = useTheme();

  // Timer
  const [mode, setMode] = useState('focus');
  const [durations, setDurations] = useState({ ...DEFAULT_DURATIONS });
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_DURATIONS.focus * 60);
  const [running, setRunning] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);

  // Duration editing
  const [editingDuration, setEditingDuration] = useState(false);
  const [draftDuration, setDraftDuration] = useState('');

  // Tasks
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [taskCounts, setTaskCounts] = useState({});

  // Stats
  const [todaySessions, setTodaySessions] = useState([]);
  const [totalMinutes, setTotalMinutes] = useState(0);

  // Breathing
  const [breathingOpen, setBreathingOpen] = useState(false);
  const [breathPattern, setBreathPattern] = useState('box');
  const [breathPhase, setBreathPhase] = useState(null); // null = idle, 'inhale'|'hold'|'exhale'|'hold2'
  const [breathCount, setBreathCount] = useState(0);
  const [breathCycle, setBreathCycle] = useState(0);
  const breathIntervalRef = useRef(null);

  const intervalRef = useRef(null);
  const sessionStartRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const bgTimeRef = useRef(null);
  const runningRef = useRef(false);
  // Refs for reading current state from AppState handler (avoids stale closures)
  const secondsLeftRef = useRef(DEFAULT_DURATIONS.focus * 60);
  const modeRef = useRef('focus');
  const durationsRef = useRef({ ...DEFAULT_DURATIONS });
  const sessionCountRef = useRef(0);
  const selectedTaskRef = useRef(null);

  runningRef.current = running;
  secondsLeftRef.current = secondsLeft;
  modeRef.current = mode;
  durationsRef.current = durations;
  sessionCountRef.current = sessionCount;
  selectedTaskRef.current = selectedTask;

  useFocusEffect(useCallback(() => {
    loadTasks();
    loadStats();
  }, []));

  // Restore timer state if app was killed while timer was running
  useEffect(() => {
    restoreTimerState();
  }, []);

  async function restoreTimerState() {
    try {
      const raw = await AsyncStorage.getItem(TIMER_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      const newMode = saved.mode || 'focus';
      const newDurations = saved.durations || { ...DEFAULT_DURATIONS };
      setMode(newMode);
      setDurations(newDurations);
      setSessionCount(saved.sessionCount || 0);
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
    } catch {}
  }

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appStateRef.current === 'active' && next.match(/inactive|background/)) {
        bgTimeRef.current = Date.now();
        // Persist timer state so it survives full app kill
        AsyncStorage.setItem(TIMER_KEY, JSON.stringify({
          secondsLeft: secondsLeftRef.current,
          running: runningRef.current,
          mode: modeRef.current,
          durations: durationsRef.current,
          sessionCount: sessionCountRef.current,
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

  async function loadTasks() {
    try {
      const t = await getPlanningTasks({ includeCompleted: false });
      setTasks(t);
      const countEntries = await Promise.all(
        t.map(async (task) => [task.id, await getTaskPomodoroCount(task.id)])
      );
      setTaskCounts(Object.fromEntries(countEntries));
    } catch (e) { /* non-critical, timer still works */ }
  }

  async function loadStats() {
    try {
      const [sessions, total] = await Promise.all([
        getSessionsForDay(todayStr()),
        getTotalFocusMinutes(),
      ]);
      setTodaySessions(sessions);
      setTotalMinutes(total);
    } catch (e) { /* non-critical, timer still works */ }
  }

  async function handleTimerComplete() {
    cancelTimerNotification().catch(() => {});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const isFocus = mode === 'focus';
    if (isFocus) {
      await saveSession({
        taskId: selectedTask?.id || null,
        duration: durations[mode],
        completed: true,
        date: todayStr(),
        startedAt: sessionStartRef.current,
        endedAt: new Date().toISOString(),
      });
      setSessionCount((c) => c + 1);
      await loadTasks();
      await loadStats();
    }
    setRunning(false);
    Alert.alert(
      isFocus ? 'session complete 🎉' : 'break over',
      isFocus
        ? `great work${selectedTask ? ` on "${selectedTask.title}"` : ''}! take a break.`
        : 'ready to focus again?'
    );
  }

  function startTimer() {
    sessionStartRef.current = new Date().toISOString();
    setRunning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    showTimerNotification(secondsLeftRef.current, selectedTaskRef.current?.title).catch(() => {});
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

  function switchMode(m) {
    setRunning(false);
    setMode(m);
    setSecondsLeft(durations[m] * 60);
  }

  function openEditDuration() {
    setDraftDuration(String(durations[mode]));
    setEditingDuration(true);
  }

  function saveDuration() {
    const mins = parseInt(draftDuration);
    if (!mins || mins < 1 || mins > 240) {
      Alert.alert('invalid', 'enter a number between 1 and 240.');
      return;
    }
    const updated = { ...durations, [mode]: mins };
    setDurations(updated);
    setSecondsLeft(mins * 60);
    setEditingDuration(false);
  }

  function addTask() {
    router.push('/tasks');
  }

  async function handleToggleTask(id) {
    await togglePlanningTask(id);
    if (selectedTask?.id === id) setSelectedTask(null);
    loadTasks();
  }

  // ── Breathing ─────────────────────────────────────────
  const BREATH_PATTERNS = {
    box:   { label: 'box breathing',  phases: ['inhale','hold','exhale','hold2'], durations: [4,4,4,4], phaseLabels: ['inhale','hold','exhale','hold'] },
    '478': { label: '4-7-8',          phases: ['inhale','hold','exhale'],         durations: [4,7,8],   phaseLabels: ['inhale','hold','exhale'] },
    calm:  { label: 'calm',           phases: ['inhale','exhale'],                durations: [5,6],     phaseLabels: ['inhale','exhale'] },
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
        if (phaseIdx === 0) setBreathCycle(c => c + 1);
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
  const progress = secondsLeft === totalSecs ? 0 : 1 - secondsLeft / totalSecs;

  const todayMins = todaySessions.filter(s => s.completed).reduce((sum, s) => sum + s.duration, 0);
  const todayCount = todaySessions.filter(s => s.completed).length;

  const RING = 220;
  const STROKE = 10;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <AestheticBackground />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── TIMER HERO: dark background, animated blobs visible ── */}
        <View style={styles.timerHero}>
          <AestheticBackground dark={true} />

          <MindfulHeader C={{ ...C, text: '#fff', textSecondary: 'rgba(255,255,255,0.6)', background: 'transparent' }} title="Focus" onRightPress={() => router.push('/focus-stats')} rightLabel="📊" />

          {/* Mode selector */}
          <View style={styles.modeRow}>
            {Object.keys(DEFAULT_DURATIONS).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.modeBtn, mode === m && { backgroundColor: FOCUS_ORANGE }]}
                onPress={() => switchMode(m)}
                activeOpacity={0.7}
              >
                <Text style={[styles.modeBtnText, { color: mode === m ? '#fff' : 'rgba(255,255,255,0.55)' }]}>
                  {MODE_LABELS[m]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Timer ring */}
          <View style={styles.timerWrap}>
            <View style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: RING / 2 }}>
              <ProgressRing
                progress={progress}
                size={RING}
                strokeWidth={STROKE}
                color={FOCUS_ORANGE}
                bgColor="rgba(255,255,255,0.18)"
              />
              <View style={styles.ringCenter}>
                <TouchableOpacity onPress={running ? undefined : openEditDuration} activeOpacity={0.7}>
                  <Text style={[styles.timerText, { color: '#FFFFFF' }]}>{formatTime(secondsLeft)}</Text>
                </TouchableOpacity>
                <Text style={[styles.timerMode, { color: 'rgba(255,255,255,0.6)' }]}>
                  {MODE_LABELS[mode]} · {durations[mode]}m
                </Text>
                {selectedTask && (
                  <Text style={[styles.timerTask, { color: 'rgba(255,255,255,0.7)' }]} numberOfLines={1}>
                    {selectedTask.title}
                  </Text>
                )}
                {sessionCount > 0 && (
                  <Text style={[styles.sessionDots, { color: 'rgba(255,255,255,0.5)' }]}>
                    {'◉ '.repeat(Math.min(sessionCount, 8)).trim()}{sessionCount > 8 ? ` +${sessionCount - 8}` : ''}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            <TouchableOpacity style={[styles.sideBtn, { backgroundColor: 'rgba(255,255,255,0.13)' }]} onPress={resetTimer} activeOpacity={0.7}>
              <Text style={[styles.sideBtnText, { color: 'rgba(255,255,255,0.7)' }]}>reset</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.mainBtn, { backgroundColor: FOCUS_ORANGE }]} onPress={running ? pauseTimer : startTimer} activeOpacity={0.8}>
              <Text style={[styles.mainBtnText, { color: '#fff' }]}>
                {running ? 'pause' : secondsLeft === totalSecs ? 'start' : 'resume'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sideBtn, { backgroundColor: 'rgba(255,255,255,0.13)' }]} onPress={() => setShowTaskPicker(true)} activeOpacity={0.7}>
              <Text style={[styles.sideBtnText, { color: 'rgba(255,255,255,0.7)' }]}>task</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── stats / tasks / breathing ── */}
        <View style={styles.bottomContent}>
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: C.card }]}>
            <Text style={[styles.statVal, { color: C.text }]}>{todayCount}</Text>
            <Text style={[styles.statLbl, { color: C.textSecondary }]}>today</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: C.card }]}>
            <Text style={[styles.statVal, { color: C.text }]}>{todayMins}m</Text>
            <Text style={[styles.statLbl, { color: C.textSecondary }]}>focused</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: C.card }]}>
            <Text style={[styles.statVal, { color: C.text }]}>{Math.floor(totalMinutes / 60)}h</Text>
            <Text style={[styles.statLbl, { color: C.textSecondary }]}>all time</Text>
          </View>
        </View>

        {/* Tasks */}
        <View style={styles.taskSection}>
          <View style={styles.taskSectionHeader}>
            <Text style={[styles.sectionLabel, { color: C.textSecondary }]}>tasks</Text>
            <TouchableOpacity onPress={() => router.push('/tasks')}>
              <Text style={[styles.viewAllLink, { color: C.primary }]}>view all →</Text>
            </TouchableOpacity>
          </View>
          {tasks.slice(0, 3).map((task) => {
            const done = taskCounts[task.id] || 0;
            const target = task.target_pomodoros || 1;
            const isSelected = selectedTask?.id === task.id;
            return (
              <TouchableOpacity
                key={task.id}
                style={[styles.taskRow, { backgroundColor: C.card, borderColor: isSelected ? FOCUS_ORANGE : C.border }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedTask(isSelected ? null : task); }}
                activeOpacity={0.7}
              >
                <TouchableOpacity onPress={() => handleToggleTask(task.id)} style={styles.checkbox} hitSlop={8}>
                  <View style={[styles.checkCircle, { borderColor: C.border }]} />
                </TouchableOpacity>
                <Text style={[styles.taskTitle, { color: C.text, flex: 1 }]} numberOfLines={1}>{task.title}</Text>
                <View style={styles.pomodoroRow}>
                  {Array.from({ length: Math.min(target, 4) }).map((_, i) => (
                    <View key={i} style={[styles.pomodoroDot, { backgroundColor: i < done ? FOCUS_ORANGE : C.border }]} />
                  ))}
                </View>
                {isSelected && <Text style={[styles.taskActive, { color: FOCUS_ORANGE }]}>◉</Text>}
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={[styles.addRow, { backgroundColor: C.card, borderColor: C.border }]} onPress={() => router.push('/tasks')} activeOpacity={0.75}>
            <Text style={[styles.addRowText, { color: C.textSecondary }]}>
              {tasks.length === 0 ? '+ add tasks' : tasks.length > 3 ? `+${tasks.length - 3} more tasks` : '+ add task'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Breathing */}
        <TouchableOpacity style={[styles.breathCard, { backgroundColor: C.card }]} onPress={() => { if (breathPhase) stopBreathing(); setBreathingOpen(o => !o); }} activeOpacity={0.7}>
          <View style={styles.breathHeader}>
            <Text style={[styles.breathTitle, { color: C.text }]}>breathing</Text>
            <Text style={[styles.breathChevron, { color: C.border }]}>{breathingOpen ? '↑' : '↓'}</Text>
          </View>
        </TouchableOpacity>

        {breathingOpen && (
          <View style={[styles.breathPanel, { backgroundColor: C.card }]}>
            <View style={styles.breathPatterns}>
              {Object.entries(BREATH_PATTERNS).map(([key, pat]) => (
                <TouchableOpacity key={key} style={[styles.breathPatBtn, { backgroundColor: breathPattern === key ? C.text : C.background, borderColor: C.border }]} onPress={() => { stopBreathing(); setBreathPattern(key); }}>
                  <Text style={[styles.breathPatText, { color: breathPattern === key ? C.background : C.textSecondary }]}>{pat.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {breathPhase ? (
              <View style={styles.breathActive}>
                <Text style={[styles.breathPhaseText, { color: C.text }]}>{breathPhase}</Text>
                <Text style={[styles.breathCountText, { color: C.textSecondary }]}>{breathCount}</Text>
                <Text style={[styles.breathCycleText, { color: C.textSecondary }]}>cycle {breathCycle}</Text>
                <TouchableOpacity style={[styles.breathBtn, { borderColor: C.border }]} onPress={stopBreathing}>
                  <Text style={[styles.breathBtnText, { color: C.textSecondary }]}>stop</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.breathActive}>
                <Text style={[styles.breathHint, { color: C.textSecondary }]}>
                  {BREATH_PATTERNS[breathPattern].phaseLabels.map((l, i) => `${l} ${BREATH_PATTERNS[breathPattern].durations[i]}s`).join('  ·  ')}
                </Text>
                <TouchableOpacity style={[styles.breathBtn, { backgroundColor: C.text }]} onPress={startBreathing}>
                  <Text style={[styles.breathBtnText, { color: C.background }]}>start</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        </View>
      </ScrollView>

      {/* Task picker modal */}
      <Modal visible={showTaskPicker} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowTaskPicker(false)} activeOpacity={1}>
          <View style={[styles.modalSheet, { backgroundColor: C.card }]}>
            <Text style={[styles.modalTitle, { color: C.text }]}>select task</Text>
            <TouchableOpacity style={[styles.modalTask, { borderColor: !selectedTask ? C.text : C.border }]} onPress={() => { setSelectedTask(null); setShowTaskPicker(false); }}>
              <Text style={[styles.modalTaskText, { color: C.textSecondary }]}>no task</Text>
            </TouchableOpacity>
            {tasks.filter(t => !t.completed).map((task) => (
              <TouchableOpacity key={task.id} style={[styles.modalTask, { borderColor: selectedTask?.id === task.id ? C.text : C.border }]} onPress={() => { setSelectedTask(task); setShowTaskPicker(false); }}>
                <Text style={[styles.modalTaskText, { color: C.text }]} numberOfLines={1}>{task.title}</Text>
                <Text style={[styles.modalTaskCount, { color: C.textSecondary }]}>{taskCounts[task.id] || 0}/{task.target_pomodoros} ◉</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Duration edit modal */}
      <Modal visible={editingDuration} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setEditingDuration(false)} activeOpacity={1}>
          <View style={[styles.durationSheet, { backgroundColor: C.card }]}>
            <Text style={[styles.modalTitle, { color: C.text }]}>set {MODE_LABELS[mode]} duration</Text>
            <View style={[styles.durationInputRow, { borderColor: C.border }]}>
              <TextInput style={[styles.durationInput, { color: C.text }]} value={draftDuration} onChangeText={setDraftDuration} keyboardType="number-pad" autoFocus maxLength={3} />
              <Text style={[styles.durationUnit, { color: C.textSecondary }]}>minutes</Text>
            </View>
            <TouchableOpacity style={[styles.durationSaveBtn, { backgroundColor: FOCUS_ORANGE }]} onPress={saveDuration}>
              <Text style={[styles.durationSaveText, { color: '#fff' }]}>set</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1, backgroundColor: 'transparent' },
  scrollContent: { flexGrow: 1 },
  timerHero: {
    position: 'relative',
    minHeight: 520,
    paddingHorizontal: 24,
    paddingTop: 54,
    paddingBottom: 26,
    backgroundColor: 'rgba(21,17,15,0.94)',
    overflow: 'hidden',
  },
  bottomContent: {
    padding: 24,
    paddingTop: 22,
    paddingBottom: 36,
  },
  content: { padding: 24, paddingTop: 54, paddingBottom: 28 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  title: { fontSize: 25, fontWeight: '900', letterSpacing: 0 },
  headerBtn: {
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 999, elevation: 1,
  },
  headerBtnText: { fontSize: 12, letterSpacing: 0, fontWeight: '800' },
  focusHero: {
    borderRadius: 26,
    padding: 20,
    minHeight: 136,
    marginBottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  focusHeroKicker: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  focusHeroTitle: {
    color: '#FFFFFF',
    fontSize: 39,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 8,
  },
  focusHeroSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '800',
  },
  focusHeroStack: {
    gap: 10,
    alignItems: 'flex-end',
  },
  focusHeroPill: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 72,
    alignItems: 'center',
  },
  focusHeroPillText: { fontSize: 12, fontWeight: '900' },
  modeRow: {
    flexDirection: 'row', borderRadius: 22,
    padding: 5, elevation: 2, marginBottom: 22, gap: 5,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: 17, alignItems: 'center' },
  modeBtnText: { fontSize: 12, fontWeight: '800', letterSpacing: 0 },
  timerWrap: {
    width: 280,
    height: 280,
    borderRadius: 140,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  ringCenter: { alignItems: 'center', gap: 6 },
  timerText: { fontSize: 47, fontWeight: '900', letterSpacing: 0, lineHeight: 56 },
  timerMode: { fontSize: 11, letterSpacing: 0.5, fontWeight: '900', textTransform: 'uppercase' },
  timerTask: { fontSize: 12, letterSpacing: 0, maxWidth: 160, textAlign: 'center', fontWeight: '700' },
  sessionDots: { fontSize: 13, letterSpacing: 6 },
  controls: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 12, marginBottom: 28,
  },
  mainBtn: { paddingHorizontal: 44, paddingVertical: 16, borderRadius: 999 },
  mainBtnText: { fontSize: 15, fontWeight: '900', letterSpacing: 0 },
  sideBtn: { paddingHorizontal: 19, paddingVertical: 16, borderRadius: 999, elevation: 1 },
  sideBtnText: { fontSize: 13, letterSpacing: 0, fontWeight: '800' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  statCard: {
    flex: 1, borderRadius: 20, paddingVertical: 14,
    alignItems: 'center', gap: 4, elevation: 2,
  },
  statVal: { fontSize: 20, fontWeight: '700', letterSpacing: 0 },
  statLbl: { fontSize: 11, letterSpacing: 0.3 },
  taskSection: { gap: 8 },
  taskSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sectionLabel: { fontSize: 13, letterSpacing: 0, fontWeight: '900' },
  viewAllLink: { fontSize: 12, fontWeight: '800' },
  addRow: {
    borderRadius: 18, elevation: 1, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 14,
    alignItems: 'center',
  },
  addRowText: { fontSize: 14, fontWeight: '700' },
  taskRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 18, borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 12, gap: 12,
  },
  checkbox: { padding: 2 },
  checkCircle: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  taskTitle: { fontSize: 15, letterSpacing: 0.1, marginBottom: 4 },
  pomodoroRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pomodoroDot: { width: 8, height: 8, borderRadius: 4 },
  pomodoroCount: { fontSize: 11, marginLeft: 2 },
  taskActive: { fontSize: 14 },
  emptyText: { fontSize: 13, textAlign: 'center', letterSpacing: 0.3, marginTop: 8 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, gap: 10,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8, letterSpacing: 0.2 },
  modalTask: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 18,
    borderRadius: 14, borderWidth: 1.5,
  },
  modalTaskText: { fontSize: 15, letterSpacing: 0.1, flex: 1 },
  modalTaskCount: { fontSize: 13, letterSpacing: 0.2 },
  durationSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 28, paddingBottom: 44, gap: 16,
  },
  durationInputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 18, paddingVertical: 4,
  },
  durationInput: { fontSize: 36, fontWeight: '700', flex: 1, letterSpacing: 0 },
  durationUnit: { fontSize: 16, letterSpacing: 0.3 },
  durationSaveBtn: {
    borderRadius: 999, paddingVertical: 15, alignItems: 'center',
  },
  durationSaveText: { fontSize: 15, fontWeight: '600', letterSpacing: 0.8 },
  breathCard: {
    borderRadius: 20, elevation: 2,
    paddingHorizontal: 16, paddingVertical: 14, marginTop: 16,
  },
  breathHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  breathTitle: { fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },
  breathChevron: { fontSize: 14 },
  breathPanel: {
    borderRadius: 16, elevation: 1,
    borderTopLeftRadius: 0, borderTopRightRadius: 0,
    padding: 16, gap: 14, marginTop: 2,
  },
  breathPatterns: { flexDirection: 'row', gap: 8 },
  breathPatBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  breathPatText: { fontSize: 11, letterSpacing: 0.2 },
  breathActive: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  breathPhaseText: { fontSize: 26, fontWeight: '700', letterSpacing: 0 },
  breathCountText: { fontSize: 48, fontWeight: '800', letterSpacing: 0 },
  breathCycleText: { fontSize: 12, letterSpacing: 0.3 },
  breathHint: { fontSize: 12, letterSpacing: 0.2, textAlign: 'center' },
  breathBtn: { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 999, borderWidth: 1, marginTop: 4 },
  breathBtnText: { fontSize: 14, fontWeight: '600', letterSpacing: 0.5 },
});
