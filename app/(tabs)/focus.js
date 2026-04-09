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
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/context/ThemeContext';
import { COLORS } from '../../src/constants/theme';
import AestheticBackground from '../../src/components/AestheticBackground';
import {
  getTasks, createTask, toggleTask, deleteTask,
  saveSession, getSessionsForDay, getTotalFocusMinutes,
  setTaskPomodoros, getTaskPomodoroCount,
} from '../../src/db/focusDatabase';

const { width: SCREEN_W } = Dimensions.get('window');

const DEFAULT_DURATIONS = { focus: 25, short: 5, long: 15 };
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
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskTarget, setNewTaskTarget] = useState('1');
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [taskCounts, setTaskCounts] = useState({});

  // Stats
  const [todaySessions, setTodaySessions] = useState([]);
  const [totalMinutes, setTotalMinutes] = useState(0);

  const intervalRef = useRef(null);
  const sessionStartRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const bgTimeRef = useRef(null);
  const runningRef = useRef(false);

  runningRef.current = running;

  useFocusEffect(useCallback(() => {
    loadTasks();
    loadStats();
  }, []));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appStateRef.current === 'active' && next.match(/inactive|background/)) {
        bgTimeRef.current = Date.now();
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
    const t = await getTasks();
    setTasks(t);
    // Load completed pomodoro counts for each task
    const counts = {};
    for (const task of t) {
      counts[task.id] = await getTaskPomodoroCount(task.id);
    }
    setTaskCounts(counts);
  }

  async function loadStats() {
    const [sessions, total] = await Promise.all([
      getSessionsForDay(todayStr()),
      getTotalFocusMinutes(),
    ]);
    setTodaySessions(sessions);
    setTotalMinutes(total);
  }

  async function handleTimerComplete() {
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
  }

  function pauseTimer() {
    setRunning(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function resetTimer() {
    setRunning(false);
    setSecondsLeft(durations[mode] * 60);
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

  async function addTask() {
    const text = newTaskText.trim();
    if (!text) return;
    const target = Math.max(1, parseInt(newTaskTarget) || 1);
    await createTask(text, target);
    setNewTaskText('');
    setNewTaskTarget('1');
    loadTasks();
  }

  async function handleToggleTask(id) {
    await toggleTask(id);
    loadTasks();
  }

  async function handleDeleteTask(id) {
    if (selectedTask?.id === id) setSelectedTask(null);
    await deleteTask(id);
    loadTasks();
  }

  const totalSecs = durations[mode] * 60;
  const progress = secondsLeft === totalSecs ? 0 : 1 - secondsLeft / totalSecs;

  const todayMins = todaySessions.filter(s => s.completed).reduce((sum, s) => sum + s.duration, 0);
  const todayCount = todaySessions.filter(s => s.completed).length;

  const RING = 220;
  const STROKE = 10;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: C.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <AestheticBackground />
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: C.text }]}>focus</Text>
        <TouchableOpacity
          style={[styles.headerBtn, { backgroundColor: C.card, borderColor: C.border }]}
          onPress={() => router.push('/focus-stats')}
        >
          <Text style={[styles.headerBtnText, { color: C.textSecondary }]}>stats</Text>
        </TouchableOpacity>
      </View>

      {/* Mode selector */}
      <View style={[styles.modeRow, { backgroundColor: C.card, borderColor: C.border }]}>
        {Object.keys(DEFAULT_DURATIONS).map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.modeBtn, mode === m && { backgroundColor: C.text }]}
            onPress={() => switchMode(m)}
            activeOpacity={0.7}
          >
            <Text style={[styles.modeBtnText, { color: mode === m ? C.white : C.textSecondary }]}>
              {MODE_LABELS[m]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Timer */}
      <View style={styles.timerWrap}>
        <View style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}>
          <ProgressRing
            progress={progress}
            size={RING}
            strokeWidth={STROKE}
            color={C.text}
            bgColor={C.border}
          />
          {/* Center */}
          <View style={styles.ringCenter}>
            <TouchableOpacity onPress={running ? undefined : openEditDuration} activeOpacity={0.7}>
              <Text style={[styles.timerText, { color: C.text }]}>{formatTime(secondsLeft)}</Text>
            </TouchableOpacity>
            <Text style={[styles.timerMode, { color: C.textSecondary }]}>
              {MODE_LABELS[mode]} · {durations[mode]}m
            </Text>
            {selectedTask && (
              <Text style={[styles.timerTask, { color: C.textSecondary }]} numberOfLines={1}>
                {selectedTask.title}
              </Text>
            )}
            <Text style={[styles.sessionDots, { color: C.textSecondary }]}>
              {sessionCount > 0 ? '◉ '.repeat(sessionCount).trim() : '○ ○ ○ ○'}
            </Text>
          </View>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.sideBtn, { borderColor: C.border }]}
          onPress={resetTimer}
          activeOpacity={0.7}
        >
          <Text style={[styles.sideBtnText, { color: C.textSecondary }]}>reset</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.mainBtn, { backgroundColor: C.text }]}
          onPress={running ? pauseTimer : startTimer}
          activeOpacity={0.8}
        >
          <Text style={[styles.mainBtnText, { color: C.white }]}>
            {running ? 'pause' : secondsLeft === totalSecs ? 'start' : 'resume'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sideBtn, { borderColor: C.border }]}
          onPress={() => setShowTaskPicker(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.sideBtnText, { color: C.textSecondary }]}>task</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.statVal, { color: C.text }]}>{todayCount}</Text>
          <Text style={[styles.statLbl, { color: C.textSecondary }]}>today</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.statVal, { color: C.text }]}>{todayMins}m</Text>
          <Text style={[styles.statLbl, { color: C.textSecondary }]}>focused</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.statVal, { color: C.text }]}>{Math.floor(totalMinutes / 60)}h</Text>
          <Text style={[styles.statLbl, { color: C.textSecondary }]}>all time</Text>
        </View>
      </View>

      {/* Tasks */}
      <View style={styles.taskSection}>
        <Text style={[styles.sectionLabel, { color: C.textSecondary }]}>tasks</Text>

        {/* Add task */}
        <View style={[styles.addRow, { backgroundColor: C.card, borderColor: C.border }]}>
          <TextInput
            style={[styles.taskInput, { color: C.text, flex: 1 }]}
            placeholder="add a task..."
            placeholderTextColor={C.textSecondary}
            value={newTaskText}
            onChangeText={setNewTaskText}
            onSubmitEditing={addTask}
            returnKeyType="done"
          />
          <View style={[styles.pomodoroTarget, { borderColor: C.border }]}>
            <Text style={[styles.pomodoroTargetIcon, { color: C.textSecondary }]}>◉</Text>
            <TextInput
              style={[styles.pomodoroTargetInput, { color: C.text }]}
              value={newTaskTarget}
              onChangeText={setNewTaskTarget}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
          <TouchableOpacity onPress={addTask} style={styles.addBtn}>
            <Text style={[styles.addBtnText, { color: C.text }]}>+</Text>
          </TouchableOpacity>
        </View>

        {tasks.map((task) => {
          const done = taskCounts[task.id] || 0;
          const target = task.target_pomodoros || 1;
          const isSelected = selectedTask?.id === task.id;
          return (
            <TouchableOpacity
              key={task.id}
              style={[
                styles.taskRow,
                { backgroundColor: C.card, borderColor: isSelected ? C.text : C.border },
              ]}
              onPress={() => setSelectedTask(isSelected ? null : task)}
              onLongPress={() => Alert.alert('delete task', `"${task.title}"?`, [
                { text: 'cancel', style: 'cancel' },
                { text: 'delete', style: 'destructive', onPress: () => handleDeleteTask(task.id) },
              ])}
              activeOpacity={0.7}
            >
              <TouchableOpacity onPress={() => handleToggleTask(task.id)} style={styles.checkbox}>
                <View style={[
                  styles.checkCircle,
                  { borderColor: task.completed ? C.success : C.border },
                  task.completed && { backgroundColor: C.success },
                ]}>
                  {task.completed && <Text style={styles.checkMark}>✓</Text>}
                </View>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={[
                  styles.taskTitle,
                  { color: task.completed ? C.textSecondary : C.text },
                  task.completed && { textDecorationLine: 'line-through', opacity: 0.6 },
                ]} numberOfLines={1}>
                  {task.title}
                </Text>
                {/* Pomodoro progress */}
                <View style={styles.pomodoroRow}>
                  {Array.from({ length: target }).map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.pomodoroDot,
                        { backgroundColor: i < done ? C.text : C.border },
                      ]}
                    />
                  ))}
                  <Text style={[styles.pomodoroCount, { color: C.textSecondary }]}>
                    {done}/{target}
                  </Text>
                </View>
              </View>
              {isSelected && <Text style={[styles.taskActive, { color: C.text }]}>◉</Text>}
            </TouchableOpacity>
          );
        })}

        {tasks.length === 0 && (
          <Text style={[styles.emptyText, { color: C.textSecondary }]}>no tasks yet</Text>
        )}
      </View>

      {/* Task picker modal */}
      <Modal visible={showTaskPicker} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowTaskPicker(false)} activeOpacity={1}>
          <View style={[styles.modalSheet, { backgroundColor: C.card }]}>
            <Text style={[styles.modalTitle, { color: C.text }]}>select task</Text>
            <TouchableOpacity
              style={[styles.modalTask, { borderColor: !selectedTask ? C.text : C.border }]}
              onPress={() => { setSelectedTask(null); setShowTaskPicker(false); }}
            >
              <Text style={[styles.modalTaskText, { color: C.textSecondary }]}>no task</Text>
            </TouchableOpacity>
            {tasks.filter(t => !t.completed).map((task) => (
              <TouchableOpacity
                key={task.id}
                style={[styles.modalTask, { borderColor: selectedTask?.id === task.id ? C.text : C.border }]}
                onPress={() => { setSelectedTask(task); setShowTaskPicker(false); }}
              >
                <Text style={[styles.modalTaskText, { color: C.text }]} numberOfLines={1}>{task.title}</Text>
                <Text style={[styles.modalTaskCount, { color: C.textSecondary }]}>
                  {taskCounts[task.id] || 0}/{task.target_pomodoros} ◉
                </Text>
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
            <TouchableOpacity style={[styles.durationSaveBtn, { backgroundColor: C.text }]} onPress={saveDuration}>
              <Text style={[styles.durationSaveText, { color: C.white }]}>set</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 60, paddingBottom: 50 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 24,
  },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  headerBtn: {
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 999, borderWidth: 1,
  },
  headerBtnText: { fontSize: 13, letterSpacing: 0.3 },
  modeRow: {
    flexDirection: 'row', borderRadius: 16,
    padding: 4, borderWidth: 1, marginBottom: 28, gap: 4,
  },
  modeBtn: { flex: 1, paddingVertical: 9, borderRadius: 12, alignItems: 'center' },
  modeBtnText: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  timerWrap: { alignItems: 'center', marginBottom: 28 },
  ringCenter: { alignItems: 'center', gap: 6 },
  timerText: { fontSize: 52, fontWeight: '700', letterSpacing: -2, lineHeight: 60 },
  timerMode: { fontSize: 12, letterSpacing: 0.5 },
  timerTask: { fontSize: 13, letterSpacing: 0.2, maxWidth: 160, textAlign: 'center' },
  sessionDots: { fontSize: 13, letterSpacing: 6 },
  controls: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 12, marginBottom: 28,
  },
  mainBtn: { paddingHorizontal: 44, paddingVertical: 16, borderRadius: 999 },
  mainBtnText: { fontSize: 16, fontWeight: '600', letterSpacing: 0.8 },
  sideBtn: { paddingHorizontal: 20, paddingVertical: 16, borderRadius: 999, borderWidth: 1 },
  sideBtnText: { fontSize: 14, letterSpacing: 0.3 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  statCard: {
    flex: 1, borderRadius: 16, paddingVertical: 14,
    alignItems: 'center', gap: 4, borderWidth: 1,
  },
  statVal: { fontSize: 20, fontWeight: '700', letterSpacing: -0.5 },
  statLbl: { fontSize: 11, letterSpacing: 0.3 },
  taskSection: { gap: 8 },
  sectionLabel: { fontSize: 13, letterSpacing: 0.5, marginBottom: 4 },
  addRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 4,
  },
  taskInput: { fontSize: 15, paddingVertical: 10 },
  pomodoroTarget: {
    flexDirection: 'row', alignItems: 'center',
    borderLeftWidth: 1, paddingLeft: 10, gap: 4,
  },
  pomodoroTargetIcon: { fontSize: 12 },
  pomodoroTargetInput: { fontSize: 15, width: 28, textAlign: 'center' },
  addBtn: { padding: 8 },
  addBtnText: { fontSize: 22, fontWeight: '300' },
  taskRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1.5,
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
  durationInput: { fontSize: 36, fontWeight: '700', flex: 1, letterSpacing: -1 },
  durationUnit: { fontSize: 16, letterSpacing: 0.3 },
  durationSaveBtn: {
    borderRadius: 999, paddingVertical: 15, alignItems: 'center',
  },
  durationSaveText: { fontSize: 15, fontWeight: '600', letterSpacing: 0.8 },
});
