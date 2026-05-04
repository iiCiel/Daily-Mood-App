import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Modal, Alert, Dimensions, KeyboardAvoidingView, Platform,
  PanResponder, Animated,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/context/ThemeContext';
import MindfulHeader from '../../src/components/MindfulHeader';
import AestheticBackground from '../../src/components/AestheticBackground';
import {
  getHabits, createHabit, updateHabit, archiveHabit,
  toggleCompletion, getCompletionsForDate,
  getHabitStreak, getCompletionsForMonth,
} from '../../src/db/habitDatabase';

const COLOR_OPTIONS = [
  '#6CC97C', '#C5A8E8', '#F9C74F', '#F4A56A', '#89B4D4',
  '#F28B82', '#AECBFA', '#E6C9A8', '#FF9AA2', '#B5EAD7',
  '#FFD93D', '#6BCB77', '#4D96FF', '#FF6B6B',
];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function buildCalendarDays(year, month) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function HabitCalendar({ calYear, calMonth, habits, monthCompletions, C, onPrev, onNext, todayDate, onDayPress }) {
  const n = new Date();
  const isCurrentMonth = calYear === n.getFullYear() && calMonth === n.getMonth() + 1;
  const monthLabel = new Date(calYear, calMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const calDays = buildCalendarDays(calYear, calMonth);
  const total = habits.length;

  return (
    <View style={[styles.calCard, { backgroundColor: C.card }]}>
      <View style={styles.calHeader}>
        <TouchableOpacity onPress={onPrev} style={styles.calNavBtn}>
          <Text style={[styles.calNav, { color: C.text }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.calTitle, { color: C.text }]}>{monthLabel}</Text>
        <TouchableOpacity onPress={onNext} style={styles.calNavBtn} disabled={isCurrentMonth}>
          <Text style={[styles.calNav, { color: isCurrentMonth ? C.border : C.text }]}>›</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.calDayLabels}>
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <Text key={i} style={[styles.calDayLabel, { color: C.textSecondary }]}>{d}</Text>
        ))}
      </View>
      <View style={styles.calGrid}>
        {calDays.map((day, i) => {
          if (!day) return <View key={`e${i}`} style={styles.calCell} />;
          const dateStr = `${calYear}-${String(calMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const isToday = dateStr === todayDate;
          const isFuture = dateStr > todayDate;
          const count = monthCompletions[dateStr] || 0;
          const dotColor = isFuture || count === 0 ? 'transparent'
            : count >= total ? '#6CC97C'
            : '#F9C74F';
          return (
            <TouchableOpacity
              key={dateStr}
              style={[
                styles.calCell,
                isToday && { borderWidth: 1.5, borderColor: C.text, borderRadius: 8 },
              ]}
              onPress={() => !isFuture && onDayPress(dateStr)}
              activeOpacity={isFuture ? 1 : 0.6}
              disabled={isFuture}
            >
              <Text style={[styles.calDayNum, { color: isFuture ? C.border : C.text }]}>{day}</Text>
              <View style={[styles.calDot, { backgroundColor: dotColor }]} />
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.calLegend}>
        <View style={styles.calLegendItem}>
          <View style={[styles.calDot, { backgroundColor: '#6CC97C' }]} />
          <Text style={[styles.calLegendText, { color: C.textSecondary }]}>all done</Text>
        </View>
        <View style={styles.calLegendItem}>
          <View style={[styles.calDot, { backgroundColor: '#F9C74F' }]} />
          <Text style={[styles.calLegendText, { color: C.textSecondary }]}>partial</Text>
        </View>
      </View>
    </View>
  );
}

export default function HabitsScreen() {
  const C = useTheme();
  const today = todayStr();

  const [habits, setHabits] = useState([]);
  const [completed, setCompleted] = useState(new Set());
  const [streaks, setStreaks] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [monthCompletions, setMonthCompletions] = useState({});
  const [editingDate, setEditingDate] = useState(null);
  const [editDateCompletions, setEditDateCompletions] = useState(new Set());

  // New habit form
  const [newTitle, setNewTitle] = useState('');
  const [newEmoji, setNewEmoji] = useState('💧');
  const [newColor, setNewColor] = useState('#6CC97C');

  // Swipe-down-to-dismiss — lives only on handle zone, no interactive children to steal gesture
  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const resetFormRef = useRef(null);
  const handlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) sheetTranslateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 60) {
          Animated.timing(sheetTranslateY, { toValue: 600, duration: 200, useNativeDriver: true }).start(() => {
            sheetTranslateY.setValue(0);
            if (resetFormRef.current) resetFormRef.current();
          });
        } else {
          Animated.spring(sheetTranslateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
        }
      },
    })
  ).current;

  useFocusEffect(useCallback(() => {
    load();
  }, []));

  useEffect(() => {
    loadMonthCompletions();
  }, [calYear, calMonth]);

  async function load() {
    setLoadError(false);
    try {
      const h = await getHabits();
      setHabits(h);
      const done = await getCompletionsForDate(today);
      setCompleted(done);
      const streakEntries = await Promise.all(
        h.map(async (habit) => [habit.id, await getHabitStreak(habit.id)])
      );
      setStreaks(Object.fromEntries(streakEntries));
      loadMonthCompletions();
    } catch (e) {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  async function loadMonthCompletions() {
    const data = await getCompletionsForMonth(calYear, calMonth);
    const counts = {};
    for (const [date, set] of Object.entries(data)) {
      counts[date] = set.size;
    }
    setMonthCompletions(counts);
  }

  function prevMonth() {
    if (calMonth === 1) { setCalYear(y => y - 1); setCalMonth(12); }
    else setCalMonth(m => m - 1);
  }

  function nextMonth() {
    const n = new Date();
    const isNow = calYear === n.getFullYear() && calMonth === n.getMonth() + 1;
    if (isNow) return;
    if (calMonth === 12) { setCalYear(y => y + 1); setCalMonth(1); }
    else setCalMonth(m => m + 1);
  }

  async function handleDayPress(dateStr) {
    const done = await getCompletionsForDate(dateStr);
    setEditDateCompletions(done);
    setEditingDate(dateStr);
  }

  async function handleDayHabitToggle(habitId) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await toggleCompletion(habitId, editingDate);
    const done = await getCompletionsForDate(editingDate);
    setEditDateCompletions(done);
    loadMonthCompletions();
    // If editing today, keep the main list in sync too
    if (editingDate === today) {
      setCompleted(done);
      const streak = await getHabitStreak(habitId);
      setStreaks(s => ({ ...s, [habitId]: streak }));
    }
  }

  async function handleToggle(habitId) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await toggleCompletion(habitId, today);
    const done = await getCompletionsForDate(today);
    setCompleted(done);
    const streak = await getHabitStreak(habitId);
    setStreaks(s => ({ ...s, [habitId]: streak }));
    loadMonthCompletions();
  }

  async function handleAdd() {
    if (!newTitle.trim()) return;
    if (editingHabit) {
      await updateHabit(editingHabit.id, newTitle.trim(), newEmoji, newColor);
    } else {
      await createHabit(newTitle.trim(), newEmoji, newColor);
    }
    resetForm();
    load();
  }

  function openAdd() {
    setEditingHabit(null);
    setNewTitle('');
    setNewEmoji('💧');
    setNewColor('#6CC97C');
    setShowAdd(true);
  }

  function openEdit(habit) {
    setEditingHabit(habit);
    setNewTitle(habit.title);
    setNewEmoji(habit.emoji);
    setNewColor(habit.color);
    setShowAdd(true);
  }

  function resetForm() {
    setShowAdd(false);
    setEditingHabit(null);
    setNewTitle('');
    setNewEmoji('💧');
    setNewColor('#6CC97C');
  }
  resetFormRef.current = resetForm;

  async function handleDelete(habit) {
    Alert.alert('delete habit', `"${habit.title}"? this will remove all history.`, [
      { text: 'cancel', style: 'cancel' },
      {
        text: 'delete', style: 'destructive',
        onPress: async () => { await archiveHabit(habit.id); load(); },
      },
    ]);
  }

  const doneCount = habits.filter(h => completed.has(h.id)).length;
  const total = habits.length;

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: C.background, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: C.textSecondary, fontSize: 14 }}>loading...</Text>
    </View>
  );

  if (loadError) return (
    <View style={{ flex: 1, backgroundColor: C.background, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <Text style={{ color: C.textSecondary, fontSize: 14 }}>couldn't load habits</Text>
      <TouchableOpacity onPress={load} style={{ backgroundColor: C.card, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}>
        <Text style={{ color: C.text, fontSize: 14 }}>try again</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <AestheticBackground />
      <ScrollView
        style={{ flex: 1, backgroundColor: 'transparent' }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
      <MindfulHeader C={C} title="Habits" onRightPress={openAdd} rightLabel="+" />

      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: C.text }]}>Today's Habits</Text>
          <Text style={[styles.dateLabel, { color: C.textSecondary }]}>Cultivating focus, one step at a time.</Text>
        </View>
      </View>

      <View style={[styles.heroCard, { backgroundColor: C.primary }]}>
        <View>
          <Text style={styles.heroKicker}>TODAY'S MOMENTUM</Text>
          <Text style={styles.heroCount}>{doneCount}/{total || 0}</Text>
          <Text style={styles.heroSub}>{total > 0 ? 'habits complete' : 'habits ready to build'}</Text>
        </View>
        <View style={styles.heroRings}>
          <View style={[styles.heroRingOuter, { borderColor: 'rgba(255,255,255,0.28)' }]}>
            <View style={[styles.heroRingInner, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
              <Text style={styles.heroRingText}>{total ? Math.round((doneCount / total) * 100) : 0}%</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Progress bar */}
      {total > 0 && (
        <View style={[styles.progressCard, { backgroundColor: C.card }]}>
          <View style={styles.progressTop}>
            <Text style={[styles.progressLabel, { color: C.textSecondary }]}>today's progress</Text>
            <Text style={[styles.progressCount, { color: C.text }]}>{doneCount}/{total}</Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: C.border }]}>
            <View style={[
              styles.progressFill,
              {
                width: total > 0 ? `${(doneCount / total) * 100}%` : '0%',
                    backgroundColor: doneCount === total && total > 0 ? '#6CC97C' : C.primary,
              }
            ]} />
          </View>
          {doneCount === total && total > 0 && (
            <Text style={[styles.allDoneText, { color: '#6CC97C' }]}>all done for today ✓</Text>
          )}
        </View>
      )}

      {/* Habit Calendar */}
      {habits.length > 0 && <HabitCalendar
        calYear={calYear}
        calMonth={calMonth}
        habits={habits}
        monthCompletions={monthCompletions}
        C={C}
        onPrev={prevMonth}
        onNext={nextMonth}
        todayDate={today}
        onDayPress={handleDayPress}
      />}

      {/* Habit list */}
      {habits.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: C.text }]}>no habits yet</Text>
          <Text style={[styles.emptyDesc, { color: C.textSecondary }]}>
            add a habit to start tracking your daily routines.
          </Text>
          <TouchableOpacity
            style={[styles.emptyBtn, { backgroundColor: C.card }]}
            onPress={openAdd}
            activeOpacity={0.7}
          >
            <Text style={[styles.emptyBtnText, { color: C.text }]}>+ add first habit</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.list}>
          {habits.map((habit) => {
            const done = completed.has(habit.id);
            const streak = streaks[habit.id] || 0;
            return (
              <TouchableOpacity
                key={habit.id}
                style={[
                styles.habitRow,
                {
                  backgroundColor: C.card,
                    borderColor: done ? habit.color : C.border,
                    borderWidth: 1,
                    elevation: 2,
                  }
                ]}
                onPress={() => handleToggle(habit.id)}
                onLongPress={() => Alert.alert(
                  habit.title,
                  null,
                  [
                    { text: 'edit', onPress: () => openEdit(habit) },
                    { text: 'view history', onPress: () => router.push({ pathname: '/habit-detail', params: { id: habit.id } }) },
                    { text: 'delete', style: 'destructive', onPress: () => handleDelete(habit) },
                    { text: 'cancel', style: 'cancel' },
                  ]
                )}
                activeOpacity={0.7}
              >
                {/* Emoji circle */}
                <View style={[styles.emojiCircle, { backgroundColor: done ? habit.color : C.primaryLight }]}>
                  <Text style={styles.emoji}>{habit.emoji}</Text>
                </View>

                {/* Title + streak */}
                <View style={styles.habitInfo}>
                  <Text style={[
                    styles.habitTitle,
                    { color: done ? C.textSecondary : C.text },
                    done && { textDecorationLine: 'line-through', opacity: 0.7 }
                  ]}>
                    {habit.title}
                  </Text>
                  {streak > 0 && (
                    <Text style={[styles.streak, { color: C.textSecondary }]}>
                      🔥 {streak} day{streak !== 1 ? 's' : ''}
                    </Text>
                  )}
                </View>

                {/* Check */}
                <View style={[
                  styles.check,
                  { borderColor: done ? habit.color : C.border },
                  done && { backgroundColor: habit.color },
                ]}>
                  {done && <Text style={styles.checkMark}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Day edit modal */}
      <Modal visible={!!editingDate} transparent animationType="slide">
        <View style={styles.overlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setEditingDate(null)} activeOpacity={1} />
          <View style={[styles.sheet, { backgroundColor: C.card }]}>
            <Text style={[styles.sheetTitle, { color: C.text }]}>
              {editingDate
                ? new Date(editingDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                : ''}
            </Text>
            <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>tap to toggle</Text>
            {habits.map(habit => {
              const done = editDateCompletions.has(habit.id);
              return (
                <TouchableOpacity
                  key={habit.id}
                  style={[styles.habitRow, {
                    backgroundColor: C.card,
                    borderColor: done ? habit.color : 'transparent',
                    borderWidth: done ? 2 : 0,
                    elevation: 1,
                  }]}
                  onPress={() => handleDayHabitToggle(habit.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.emojiCircle, {
                    backgroundColor: done ? habit.color : C.border,
                    width: 36, height: 36, borderRadius: 18,
                  }]}>
                    <Text style={[styles.emoji, { fontSize: 16 }]}>{habit.emoji}</Text>
                  </View>
                  <Text style={[
                    styles.habitTitle, { color: done ? C.textSecondary : C.text, flex: 1 },
                    done && { textDecorationLine: 'line-through', opacity: 0.7 },
                  ]}>
                    {habit.title}
                  </Text>
                  <View style={[styles.check,
                    { borderColor: done ? habit.color : C.border },
                    done && { backgroundColor: habit.color },
                  ]}>
                    {done && <Text style={styles.checkMark}>✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* Add/Edit Modal */}
      <Modal visible={showAdd} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <View style={styles.overlay}>
          {/* Backdrop — tapping here dismisses */}
          <TouchableOpacity style={{ flex: 1 }} onPress={resetForm} activeOpacity={1} />
          {/* Sheet — PanResponder only on handle zone, no interactive children there */}
          <Animated.View
            style={[styles.sheet, { backgroundColor: C.card, transform: [{ translateY: sheetTranslateY }] }]}
          >
            <View style={styles.sheetHandle} {...handlePanResponder.panHandlers}>
              <View style={[styles.sheetHandleBar, { backgroundColor: C.border }]} />
            </View>

            <Text style={[styles.sheetTitle, { color: C.text }]}>
              {editingHabit ? 'edit habit' : 'new habit'}
            </Text>

            {/* Name + emoji on one row */}
            <View style={styles.nameRow}>
              <TextInput
                style={[styles.emojiInput, { backgroundColor: C.background, borderColor: C.border }]}
                value={newEmoji}
                onChangeText={(t) => {
                  const chars = [...t];
                  if (chars.length > 0) setNewEmoji(chars[chars.length - 1]);
                }}
                placeholder="😊"
                placeholderTextColor={C.textSecondary}
                returnKeyType="done"
              />
              <TextInput
                style={[styles.nameInput, { backgroundColor: C.background, borderColor: C.border, color: C.text, flex: 1 }]}
                placeholder="habit name..."
                placeholderTextColor={C.textSecondary}
                value={newTitle}
                onChangeText={setNewTitle}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleAdd}
              />
            </View>

            {/* Color picker */}
            <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>color</Text>
            <View style={styles.colorRow}>
              {COLOR_OPTIONS.map((col) => (
                <TouchableOpacity
                  key={col}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: col },
                    newColor === col && { borderWidth: 3, borderColor: C.text, transform: [{ scale: 1.15 }] },
                  ]}
                  onPress={() => setNewColor(col)}
                />
              ))}
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: newColor }, !newTitle.trim() && { opacity: 0.4 }]}
              onPress={handleAdd}
              disabled={!newTitle.trim()}
              activeOpacity={0.8}
            >
              <Text style={styles.saveBtnText}>
                {editingHabit ? 'save changes' : 'add habit'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 54, paddingBottom: 28 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 20,
  },
  title: { fontSize: 25, fontWeight: '900', letterSpacing: 0 },
  dateLabel: { fontSize: 12, letterSpacing: 0, marginTop: 5, fontWeight: '600' },
  addBtn: {
    width: 42, height: 42,
    borderRadius: 21, elevation: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  addBtnText: { fontSize: 24, fontWeight: '500', lineHeight: 28 },
  heroCard: {
    borderRadius: 26,
    padding: 20,
    minHeight: 145,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  heroKicker: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  heroCount: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 8,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '800',
  },
  heroRings: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroRingOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroRingInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroRingText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  progressCard: {
    borderRadius: 22, elevation: 2,
    padding: 16, marginBottom: 18, gap: 10,
  },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: 12, letterSpacing: 0, fontWeight: '800' },
  progressCount: { fontSize: 13, fontWeight: '700' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  allDoneText: { fontSize: 12, letterSpacing: 0.3, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingTop: 42, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', letterSpacing: 0 },
  emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
  emptyBtn: {
    marginTop: 12, paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 999, elevation: 1,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '600' },
  list: { gap: 12 },
  habitRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 22, padding: 15, gap: 14,
  },
  emojiCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  emoji: { fontSize: 20 },
  habitInfo: { flex: 1, gap: 3 },
  habitTitle: { fontSize: 15, letterSpacing: 0, fontWeight: '900' },
  streak: { fontSize: 12, letterSpacing: 0.2 },
  check: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  checkMark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 44, gap: 12,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', letterSpacing: 0 },
  fieldLabel: { fontSize: 12, letterSpacing: 0.4, marginBottom: 4 },
  sheetHandle: { alignItems: 'center', justifyContent: 'center', height: 28, marginBottom: 4 },
  sheetHandleBar: { width: 40, height: 4, borderRadius: 2 },
  nameRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  emojiInput: {
    width: 54, height: 54, borderRadius: 16, borderWidth: 1,
    textAlign: 'center', fontSize: 26,
  },
  nameInput: {
    borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 14, height: 54, fontSize: 15,
  },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorCircle: { width: 30, height: 30, borderRadius: 15 },
  saveBtn: { borderRadius: 999, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
  calCard: {
    borderRadius: 22, elevation: 2,
    padding: 16, marginBottom: 20,
  },
  calHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  calNavBtn: { padding: 4 },
  calNav: { fontSize: 22, fontWeight: '300', paddingHorizontal: 4 },
  calTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  calDayLabels: { flexDirection: 'row', marginBottom: 4 },
  calDayLabel: { flex: 1, textAlign: 'center', fontSize: 10, letterSpacing: 0.3 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: {
    width: '14.285%', aspectRatio: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  calDayNum: { fontSize: 11, fontWeight: '500' },
  calDot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
  calLegend: {
    flexDirection: 'row', gap: 14, marginTop: 8, justifyContent: 'flex-end',
  },
  calLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  calLegendText: { fontSize: 10, letterSpacing: 0.3 },
});
