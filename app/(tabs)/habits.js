import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Modal, Alert, Dimensions,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/context/ThemeContext';
import AestheticBackground from '../../src/components/AestheticBackground';
import {
  getHabits, createHabit, updateHabit, archiveHabit,
  toggleCompletion, getCompletionsForDate,
  getHabitStreak,
} from '../../src/db/habitDatabase';

const EMOJI_OPTIONS = ['✦', '💧', '📚', '🏃', '🧘', '💊', '🥗', '😴', '✍️', '🎯', '🎸', '🌿', '🧹', '💪', '🫁', '☀️', '🛁', '🍵'];
const COLOR_OPTIONS = ['#C5A8E8', '#6CC97C', '#F9C74F', '#F4A56A', '#89B4D4', '#F28B82', '#AECBFA', '#E6C9A8'];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export default function HabitsScreen() {
  const C = useTheme();
  const today = todayStr();

  const [habits, setHabits] = useState([]);
  const [completed, setCompleted] = useState(new Set());
  const [streaks, setStreaks] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);

  // New habit form
  const [newTitle, setNewTitle] = useState('');
  const [newEmoji, setNewEmoji] = useState('✦');
  const [newColor, setNewColor] = useState('#C5A8E8');

  useFocusEffect(useCallback(() => {
    load();
  }, []));

  async function load() {
    const h = await getHabits();
    setHabits(h);
    const done = await getCompletionsForDate(today);
    setCompleted(done);
    const s = {};
    for (const habit of h) {
      s[habit.id] = await getHabitStreak(habit.id);
    }
    setStreaks(s);
  }

  async function handleToggle(habitId) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await toggleCompletion(habitId, today);
    const done = await getCompletionsForDate(today);
    setCompleted(done);
    // Refresh streak for this habit
    const streak = await getHabitStreak(habitId);
    setStreaks(s => ({ ...s, [habitId]: streak }));
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
    setNewEmoji('✦');
    setNewColor('#C5A8E8');
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
    setNewEmoji('✦');
    setNewColor('#C5A8E8');
  }

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

  const dayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toLowerCase();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: C.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <AestheticBackground />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: C.text }]}>habits</Text>
          <Text style={[styles.dateLabel, { color: C.textSecondary }]}>{dayLabel}</Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: C.card, borderColor: C.border }]}
          onPress={openAdd}
          activeOpacity={0.7}
        >
          <Text style={[styles.addBtnText, { color: C.text }]}>+ add</Text>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      {total > 0 && (
        <View style={[styles.progressCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={styles.progressTop}>
            <Text style={[styles.progressLabel, { color: C.textSecondary }]}>today's progress</Text>
            <Text style={[styles.progressCount, { color: C.text }]}>{doneCount}/{total}</Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: C.border }]}>
            <View style={[
              styles.progressFill,
              {
                width: total > 0 ? `${(doneCount / total) * 100}%` : '0%',
                backgroundColor: doneCount === total && total > 0 ? '#6CC97C' : C.text,
              }
            ]} />
          </View>
          {doneCount === total && total > 0 && (
            <Text style={[styles.allDoneText, { color: '#6CC97C' }]}>all done for today ✓</Text>
          )}
        </View>
      )}

      {/* Habit list */}
      {habits.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: C.text }]}>no habits yet</Text>
          <Text style={[styles.emptyDesc, { color: C.textSecondary }]}>
            add a habit to start tracking your daily routines.
          </Text>
          <TouchableOpacity
            style={[styles.emptyBtn, { backgroundColor: C.card, borderColor: C.border }]}
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
                    borderWidth: done ? 1.5 : 1,
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
                <View style={[styles.emojiCircle, { backgroundColor: done ? habit.color : C.border }]}>
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

      {/* Add/Edit Modal */}
      <Modal visible={showAdd} transparent animationType="slide">
        <TouchableOpacity style={styles.overlay} onPress={resetForm} activeOpacity={1}>
          <View style={[styles.sheet, { backgroundColor: C.card }]}>
            <Text style={[styles.sheetTitle, { color: C.text }]}>
              {editingHabit ? 'edit habit' : 'new habit'}
            </Text>

            {/* Emoji picker */}
            <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>icon</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiScroll}>
              {EMOJI_OPTIONS.map((e) => (
                <TouchableOpacity
                  key={e}
                  style={[
                    styles.emojiOption,
                    { backgroundColor: newEmoji === e ? C.text : C.background },
                  ]}
                  onPress={() => setNewEmoji(e)}
                >
                  <Text style={styles.emojiOptionText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Color picker */}
            <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>color</Text>
            <View style={styles.colorRow}>
              {COLOR_OPTIONS.map((col) => (
                <TouchableOpacity
                  key={col}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: col },
                    newColor === col && { borderWidth: 3, borderColor: C.text },
                  ]}
                  onPress={() => setNewColor(col)}
                />
              ))}
            </View>

            {/* Title input */}
            <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: C.background, borderColor: C.border, color: C.text }]}
              placeholder="e.g. drink water, read 10 pages..."
              placeholderTextColor={C.textSecondary}
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleAdd}
            />

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
    alignItems: 'flex-start', marginBottom: 24,
  },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  dateLabel: { fontSize: 13, letterSpacing: 0.2, marginTop: 2 },
  addBtn: {
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 999, borderWidth: 1,
  },
  addBtnText: { fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },
  progressCard: {
    borderRadius: 16, borderWidth: 1,
    padding: 16, marginBottom: 24, gap: 10,
  },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: 12, letterSpacing: 0.4 },
  progressCount: { fontSize: 13, fontWeight: '700' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  allDoneText: { fontSize: 12, letterSpacing: 0.3, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
  emptyBtn: {
    marginTop: 12, paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 999, borderWidth: 1,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '600' },
  list: { gap: 10 },
  habitRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, padding: 14, gap: 14,
  },
  emojiCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  emoji: { fontSize: 20 },
  habitInfo: { flex: 1, gap: 3 },
  habitTitle: { fontSize: 15, letterSpacing: 0.1, fontWeight: '500' },
  streak: { fontSize: 12, letterSpacing: 0.2 },
  check: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  checkMark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 44, gap: 8,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3, marginBottom: 8 },
  fieldLabel: { fontSize: 12, letterSpacing: 0.4, marginTop: 8, marginBottom: 4 },
  emojiScroll: { marginBottom: 4 },
  emojiOption: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  emojiOptionText: { fontSize: 20 },
  colorRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  colorCircle: { width: 28, height: 28, borderRadius: 14 },
  input: {
    borderRadius: 14, borderWidth: 1,
    padding: 14, fontSize: 15,
    marginTop: 4, marginBottom: 12,
  },
  saveBtn: { borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
});
