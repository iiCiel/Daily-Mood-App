import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Modal, KeyboardAvoidingView, Platform,
  PanResponder, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/context/ThemeContext';
import MindfulHeader from '../../src/components/MindfulHeader';
import AestheticBackground from '../../src/components/AestheticBackground';
import HabitIcon from '../../src/components/HabitIcon';
import { HABIT_ICONS, DEFAULT_HABIT_ICON } from '../../src/constants/habitIcons';
import {
  getHabits, createHabit, updateHabit, archiveHabit,
  toggleCompletion, getCompletionsForDate,
  getHabitStreak, getCompletionsForMonth,
} from '../../src/db/habitDatabase';

const COLOR_OPTIONS = [
  '#4F8F6D', '#6E7FD9', '#D08A3E', '#C85D5D', '#4E9CA6',
  '#8B6BAE', '#D6A23F', '#668A4C', '#B76E79', '#4F78B8',
  '#C96B3A', '#6CC97C', '#F9C74F', '#F28B82',
];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

function formatDateLabel(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function progressCopy(doneCount, total) {
  if (!total) return 'Add a habit to start tracking your routine.';
  if (doneCount === total) return 'Done for today. Your streaks are protected.';
  if (doneCount === 0) return 'Start with one small check-in.';
  return `${total - doneCount} left for today.`;
}

function HabitCalendar({
  calYear,
  calMonth,
  habits,
  monthCompletions,
  C,
  onPrev,
  onNext,
  todayDate,
  onDayPress,
}) {
  const now = new Date();
  const isCurrentMonth = calYear === now.getFullYear() && calMonth === now.getMonth() + 1;
  const monthLabel = new Date(calYear, calMonth - 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  const calDays = buildCalendarDays(calYear, calMonth);
  const total = habits.length;

  return (
    <View style={[styles.calendarPanel, { backgroundColor: C.card, borderColor: C.border }]}>
      <View style={styles.calendarHeader}>
        <View>
          <Text style={[styles.sectionLabel, { color: C.textSecondary }]}>history</Text>
          <Text style={[styles.calendarTitle, { color: C.text }]}>{monthLabel}</Text>
        </View>
        <View style={styles.calendarNav}>
          <TouchableOpacity
            onPress={onPrev}
            style={[styles.iconButton, { backgroundColor: C.background, borderColor: C.border }]}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={17} color={C.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onNext}
            style={[styles.iconButton, { backgroundColor: C.background, borderColor: C.border }, isCurrentMonth && { opacity: 0.35 }]}
            disabled={isCurrentMonth}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-forward" size={17} color={C.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.calendarDayLabels}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <Text key={`${d}${i}`} style={[styles.calendarDayLabel, { color: C.textSecondary }]}>{d}</Text>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {calDays.map((day, i) => {
          if (!day) return <View key={`empty-${i}`} style={styles.calendarCell} />;

          const dateStr = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isToday = dateStr === todayDate;
          const isFuture = dateStr > todayDate;
          const count = monthCompletions[dateStr] || 0;
          const ratio = total ? count / total : 0;
          const done = ratio >= 1;
          const partial = ratio > 0 && ratio < 1;

          return (
            <TouchableOpacity
              key={dateStr}
              style={[
                styles.calendarCell,
                {
                  borderColor: isToday ? C.primary : 'transparent',
                  backgroundColor: done ? C.mint : partial ? C.sand : 'transparent',
                },
              ]}
              onPress={() => !isFuture && onDayPress(dateStr)}
              activeOpacity={isFuture ? 1 : 0.65}
              disabled={isFuture}
            >
              <Text
                style={[
                  styles.calendarDayNum,
                  { color: isFuture ? C.border : done ? C.success : C.text },
                ]}
              >
                {day}
              </Text>
              <View style={[styles.calendarMiniTrack, { backgroundColor: C.border }]}>
                <View
                  style={[
                    styles.calendarMiniFill,
                    {
                      width: `${Math.min(100, Math.round(ratio * 100))}%`,
                      backgroundColor: done ? C.success : C.primary,
                    },
                  ]}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: C.success }]} />
          <Text style={[styles.legendText, { color: C.textSecondary }]}>complete</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: C.primary }]} />
          <Text style={[styles.legendText, { color: C.textSecondary }]}>partial</Text>
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

  const [newTitle, setNewTitle] = useState('');
  const [newIcon, setNewIcon] = useState(DEFAULT_HABIT_ICON);
  const [newColor, setNewColor] = useState('#4F8F6D');
  const [menuHabit, setMenuHabit] = useState(null);
  const [confirmDeleteHabit, setConfirmDeleteHabit] = useState(null);

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
    if (calMonth === 1) {
      setCalYear(y => y - 1);
      setCalMonth(12);
    } else {
      setCalMonth(m => m - 1);
    }
  }

  function nextMonth() {
    const n = new Date();
    const isNow = calYear === n.getFullYear() && calMonth === n.getMonth() + 1;
    if (isNow) return;
    if (calMonth === 12) {
      setCalYear(y => y + 1);
      setCalMonth(1);
    } else {
      setCalMonth(m => m + 1);
    }
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
      await updateHabit(editingHabit.id, newTitle.trim(), newIcon, newColor);
    } else {
      await createHabit(newTitle.trim(), newIcon, newColor);
    }
    resetForm();
    load();
  }

  function openAdd() {
    setEditingHabit(null);
    setNewTitle('');
    setNewIcon(DEFAULT_HABIT_ICON);
    setNewColor('#4F8F6D');
    setShowAdd(true);
  }

  function openEdit(habit) {
    setEditingHabit(habit);
    setNewTitle(habit.title);
    setNewIcon(HABIT_ICONS.includes(habit.emoji) ? habit.emoji : DEFAULT_HABIT_ICON);
    setNewColor(habit.color);
    setShowAdd(true);
  }

  function resetForm() {
    setShowAdd(false);
    setEditingHabit(null);
    setNewTitle('');
    setNewIcon(DEFAULT_HABIT_ICON);
    setNewColor('#4F8F6D');
  }
  resetFormRef.current = resetForm;

  function openHabitMenu(habit) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMenuHabit(habit);
  }

  function handleDeleteRequest(habit) {
    setMenuHabit(null);
    setConfirmDeleteHabit(habit);
  }

  async function confirmDelete() {
    if (!confirmDeleteHabit) return;
    await archiveHabit(confirmDeleteHabit.id);
    setConfirmDeleteHabit(null);
    load();
  }

  const doneCount = habits.filter(h => completed.has(h.id)).length;
  const total = habits.length;
  const percent = total ? Math.round((doneCount / total) * 100) : 0;
  const bestStreak = Math.max(0, ...Object.values(streaks));
  const completedDaysThisMonth = Object.values(monthCompletions).filter(count => total > 0 && count >= total).length;
  const remaining = Math.max(0, total - doneCount);

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: C.background, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: C.textSecondary, fontSize: 14 }}>Loading habits...</Text>
    </View>
  );

  if (loadError) return (
    <View style={{ flex: 1, backgroundColor: C.background, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <Text style={{ color: C.textSecondary, fontSize: 14 }}>Couldn't load habits.</Text>
      <TouchableOpacity onPress={load} style={{ backgroundColor: C.card, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 14 }}>
        <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>Try again</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <AestheticBackground />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <MindfulHeader C={C} title="Habits" onRightPress={openAdd} rightIcon="add" />

        <View style={[styles.summaryPanel, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={styles.summaryTop}>
            <View style={styles.summaryTitleBlock}>
              <Text style={[styles.sectionLabel, { color: C.textSecondary }]}>today</Text>
              <Text style={[styles.summaryTitle, { color: C.text }]}>{formatDateLabel(today)}</Text>
              <Text style={[styles.summarySub, { color: C.textSecondary }]}>{progressCopy(doneCount, total)}</Text>
            </View>
            <View style={[styles.percentBadge, { backgroundColor: C.primaryLight, borderColor: C.border }]}>
              <Text style={[styles.percentText, { color: C.primary }]}>{percent}%</Text>
            </View>
          </View>

          <View style={[styles.progressTrack, { backgroundColor: C.border }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${percent}%`,
                  backgroundColor: total > 0 && doneCount === total ? C.success : C.primary,
                },
              ]}
            />
          </View>

          <View style={[styles.metricsRow, { borderTopColor: C.border }]}>
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { color: C.text }]}>{doneCount}/{total}</Text>
              <Text style={[styles.metricLabel, { color: C.textSecondary }]}>complete</Text>
            </View>
            <View style={[styles.metricDivider, { backgroundColor: C.border }]} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { color: C.text }]}>{remaining}</Text>
              <Text style={[styles.metricLabel, { color: C.textSecondary }]}>remaining</Text>
            </View>
            <View style={[styles.metricDivider, { backgroundColor: C.border }]} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { color: C.text }]}>{bestStreak}d</Text>
              <Text style={[styles.metricLabel, { color: C.textSecondary }]}>best streak</Text>
            </View>
          </View>
        </View>

        {habits.length === 0 ? (
          <View style={[styles.emptyPanel, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: C.primaryLight }]}>
              <Ionicons name="repeat" size={25} color={C.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: C.text }]}>Build your first streak</Text>
            <Text style={[styles.emptyDesc, { color: C.textSecondary }]}>
              Add one small habit you can check off today.
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: C.primary }]}
              onPress={openAdd}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Add habit</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: C.text }]}>Today's checklist</Text>
                <Text style={[styles.sectionHint, { color: C.textSecondary }]}>Tap a habit to mark it done.</Text>
              </View>
              {doneCount === total && (
                <View style={[styles.donePill, { backgroundColor: C.mint }]}>
                  <Ionicons name="checkmark-circle" size={15} color={C.success} />
                  <Text style={[styles.donePillText, { color: C.success }]}>done</Text>
                </View>
              )}
            </View>

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
                      },
                    ]}
                    onPress={() => handleToggle(habit.id)}
                    onLongPress={() => openHabitMenu(habit)}
                    activeOpacity={0.72}
                  >
                    <View style={[styles.habitAccent, { backgroundColor: habit.color }]} />
                    <View style={[styles.emojiCircle, { backgroundColor: done ? habit.color : C.primaryLight }]}>
                      <HabitIcon name={habit.emoji} size={20} color={done ? '#FFFFFF' : habit.color} />
                    </View>

                    <View style={styles.habitInfo}>
                      <Text
                        style={[
                          styles.habitTitle,
                          { color: C.text },
                          done && { color: C.textSecondary, textDecorationLine: 'line-through' },
                        ]}
                        numberOfLines={1}
                      >
                        {habit.title}
                      </Text>
                      <View style={styles.habitMetaRow}>
                        <Ionicons name="flame-outline" size={13} color={streak > 0 ? C.primary : C.textSecondary} />
                        <Text style={[styles.habitMeta, { color: C.textSecondary }]}>
                          {streak > 0 ? `${streak} day streak` : 'No current streak'}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[styles.rowIconButton, { borderColor: C.border }]}
                      onPress={() => openHabitMenu(habit)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="ellipsis-horizontal" size={17} color={C.textSecondary} />
                    </TouchableOpacity>

                    <View
                      style={[
                        styles.check,
                        {
                          borderColor: done ? habit.color : C.border,
                          backgroundColor: done ? habit.color : 'transparent',
                        },
                      ]}
                    >
                      {done && <Ionicons name="checkmark" size={15} color="#FFFFFF" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <HabitCalendar
              calYear={calYear}
              calMonth={calMonth}
              habits={habits}
              monthCompletions={monthCompletions}
              C={C}
              onPrev={prevMonth}
              onNext={nextMonth}
              todayDate={today}
              onDayPress={handleDayPress}
            />

            <View style={[styles.monthNote, { backgroundColor: C.mint, borderColor: C.border }]}>
              <Ionicons name="calendar-clear-outline" size={17} color={C.success} />
              <Text style={[styles.monthNoteText, { color: C.inkSoft }]}>
                {completedDaysThisMonth} fully complete {completedDaysThisMonth === 1 ? 'day' : 'days'} this month.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={!!editingDate} transparent animationType="slide">
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backdrop} onPress={() => setEditingDate(null)} activeOpacity={1} />
          <View style={[styles.sheet, { backgroundColor: C.card }]}>
            <View style={styles.sheetTopRow}>
              <View>
                <Text style={[styles.sheetTitle, { color: C.text }]}>
                  {editingDate ? formatDateLabel(editingDate) : ''}
                </Text>
                <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>Edit completed habits</Text>
              </View>
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: C.background, borderColor: C.border }]}
                onPress={() => setEditingDate(null)}
              >
                <Ionicons name="close" size={18} color={C.text} />
              </TouchableOpacity>
            </View>

            {habits.map(habit => {
              const done = editDateCompletions.has(habit.id);
              return (
                <TouchableOpacity
                  key={habit.id}
                  style={[styles.sheetHabitRow, { backgroundColor: C.background, borderColor: done ? habit.color : C.border }]}
                  onPress={() => handleDayHabitToggle(habit.id)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.sheetEmoji, { backgroundColor: done ? habit.color : C.card }]}>
                    <HabitIcon name={habit.emoji} size={18} color={done ? '#FFFFFF' : habit.color} />
                  </View>
                  <Text
                    style={[
                      styles.sheetHabitTitle,
                      { color: C.text },
                      done && { color: C.textSecondary, textDecorationLine: 'line-through' },
                    ]}
                    numberOfLines={1}
                  >
                    {habit.title}
                  </Text>
                  <View style={[styles.check, { borderColor: done ? habit.color : C.border, backgroundColor: done ? habit.color : 'transparent' }]}>
                    {done && <Ionicons name="checkmark" size={15} color="#FFFFFF" />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>

      <Modal visible={showAdd} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.overlay}>
            <TouchableOpacity style={styles.backdrop} onPress={resetForm} activeOpacity={1} />
            <Animated.View
              style={[styles.sheet, { backgroundColor: C.card, transform: [{ translateY: sheetTranslateY }] }]}
            >
              <View style={styles.sheetHandle} {...handlePanResponder.panHandlers}>
                <View style={[styles.sheetHandleBar, { backgroundColor: C.border }]} />
              </View>

              <View style={styles.sheetTopRow}>
                <View>
                  <Text style={[styles.sheetTitle, { color: C.text }]}>
                    {editingHabit ? 'Edit habit' : 'New habit'}
                  </Text>
                  <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>Name it, pick a color, then start.</Text>
                </View>
                <TouchableOpacity
                  style={[styles.iconButton, { backgroundColor: C.background, borderColor: C.border }]}
                  onPress={resetForm}
                >
                  <Ionicons name="close" size={18} color={C.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.nameRow}>
                <View style={[styles.iconPreview, { backgroundColor: newColor }]}>
                  <HabitIcon name={newIcon} size={22} color="#FFFFFF" />
                </View>
                <TextInput
                  style={[styles.nameInput, { backgroundColor: C.background, borderColor: C.border, color: C.text }]}
                  placeholder="Habit name"
                  placeholderTextColor={C.textSecondary}
                  value={newTitle}
                  onChangeText={setNewTitle}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleAdd}
                />
              </View>

              <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>Icon</Text>
              <View style={styles.iconRow}>
                {HABIT_ICONS.map((icon) => (
                  <TouchableOpacity
                    key={icon}
                    style={[
                      styles.iconOption,
                      { backgroundColor: C.background, borderColor: C.border },
                      newIcon === icon && { backgroundColor: newColor, borderColor: newColor },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setNewIcon(icon);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={icon} size={18} color={newIcon === icon ? '#FFFFFF' : C.text} />
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>Color</Text>
              <View style={styles.colorRow}>
                {COLOR_OPTIONS.map((col) => (
                  <TouchableOpacity
                    key={col}
                    style={[
                      styles.colorCircle,
                      { backgroundColor: col },
                      newColor === col && { borderWidth: 3, borderColor: C.text, transform: [{ scale: 1.12 }] },
                    ]}
                    onPress={() => setNewColor(col)}
                    activeOpacity={0.7}
                  />
                ))}
              </View>

              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: newColor }, !newTitle.trim() && { opacity: 0.4 }]}
                onPress={handleAdd}
                disabled={!newTitle.trim()}
                activeOpacity={0.85}
              >
                <Ionicons name={editingHabit ? 'save-outline' : 'add-circle-outline'} size={18} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>
                  {editingHabit ? 'Save changes' : 'Add habit'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!menuHabit} transparent animationType="fade">
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backdrop} onPress={() => setMenuHabit(null)} activeOpacity={1} />
          <View style={[styles.sheet, { backgroundColor: C.card }]}>
            {menuHabit && (
              <>
                <View style={styles.sheetTopRow}>
                  <View style={styles.menuTitleRow}>
                    <View style={[styles.sheetEmoji, { backgroundColor: menuHabit.color }]}>
                      <HabitIcon name={menuHabit.emoji} size={18} color="#FFFFFF" />
                    </View>
                    <Text style={[styles.sheetTitle, { color: C.text }]} numberOfLines={1}>{menuHabit.title}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.iconButton, { backgroundColor: C.background, borderColor: C.border }]}
                    onPress={() => setMenuHabit(null)}
                  >
                    <Ionicons name="close" size={18} color={C.text} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.menuRow, { backgroundColor: C.background, borderColor: C.border }]}
                  onPress={() => { setMenuHabit(null); openEdit(menuHabit); }}
                  activeOpacity={0.75}
                >
                  <Ionicons name="pencil-outline" size={18} color={C.text} />
                  <Text style={[styles.menuRowText, { color: C.text }]}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.menuRow, { backgroundColor: C.background, borderColor: C.border }]}
                  onPress={() => { setMenuHabit(null); router.push({ pathname: '/habit-detail', params: { id: menuHabit.id } }); }}
                  activeOpacity={0.75}
                >
                  <Ionicons name="stats-chart-outline" size={18} color={C.text} />
                  <Text style={[styles.menuRowText, { color: C.text }]}>View history</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.menuRow, { backgroundColor: C.background, borderColor: C.border }]}
                  onPress={() => handleDeleteRequest(menuHabit)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="trash-outline" size={18} color={C.danger} />
                  <Text style={[styles.menuRowText, { color: C.danger }]}>Delete</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={!!confirmDeleteHabit} transparent animationType="fade">
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backdrop} onPress={() => setConfirmDeleteHabit(null)} activeOpacity={1} />
          <View style={[styles.sheet, { backgroundColor: C.card }]}>
            {confirmDeleteHabit && (
              <>
                <Text style={[styles.sheetTitle, { color: C.text }]}>Delete habit</Text>
                <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>
                  Remove "{confirmDeleteHabit.title}" and its history? This can't be undone.
                </Text>
                <View style={styles.confirmRow}>
                  <TouchableOpacity
                    style={[styles.confirmButton, { backgroundColor: C.background, borderColor: C.border }]}
                    onPress={() => setConfirmDeleteHabit(null)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.confirmButtonText, { color: C.text }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmButton, { backgroundColor: C.danger }]}
                    onPress={confirmDelete}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.confirmButtonText, { color: '#FFFFFF' }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 20, paddingTop: 54, paddingBottom: 34 },

  summaryPanel: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    marginBottom: 22,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 14,
  },
  summaryTitleBlock: { flex: 1 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  summaryTitle: { fontSize: 23, fontWeight: '900', marginTop: 4 },
  summarySub: { fontSize: 13, lineHeight: 18, marginTop: 6, fontWeight: '700' },
  percentBadge: {
    width: 68,
    height: 68,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentText: { fontSize: 21, fontWeight: '900' },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 18,
  },
  progressFill: { height: '100%', borderRadius: 999 },
  metricsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    marginTop: 18,
    paddingTop: 14,
  },
  metricItem: { flex: 1, alignItems: 'center', gap: 3 },
  metricValue: { fontSize: 17, fontWeight: '900' },
  metricLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  metricDivider: { width: 1, alignSelf: 'stretch' },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '900' },
  sectionHint: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  donePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  donePillText: { fontSize: 12, fontWeight: '900' },

  list: { gap: 10, marginBottom: 22 },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 11,
    overflow: 'hidden',
  },
  habitAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  emojiCircle: {
    width: 43,
    height: 43,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 20 },
  habitInfo: { flex: 1, minWidth: 0, gap: 5 },
  habitTitle: { fontSize: 15, letterSpacing: 0, fontWeight: '900' },
  habitMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  habitMeta: { fontSize: 12, fontWeight: '700' },
  rowIconButton: {
    width: 32,
    height: 32,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyPanel: {
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    padding: 24,
    gap: 10,
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 19, fontWeight: '900', letterSpacing: 0 },
  emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },

  calendarPanel: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  calendarTitle: { fontSize: 18, fontWeight: '900', marginTop: 3 },
  calendarNav: { flexDirection: 'row', gap: 8 },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayLabels: { flexDirection: 'row', marginBottom: 6 },
  calendarDayLabel: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '900' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: {
    width: '14.285%',
    aspectRatio: 1,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  calendarDayNum: { fontSize: 12, fontWeight: '900' },
  calendarMiniTrack: {
    height: 3,
    width: '64%',
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 5,
  },
  calendarMiniFill: { height: '100%', borderRadius: 999 },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 14,
    marginTop: 12,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: '800' },
  monthNote: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  monthNoteText: { flex: 1, fontSize: 12, fontWeight: '800', lineHeight: 17 },

  overlay: { flex: 1, backgroundColor: 'rgba(24,18,14,0.48)', justifyContent: 'flex-end' },
  backdrop: { flex: 1 },
  keyboardAvoid: { flex: 1 },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    paddingBottom: 34,
    gap: 13,
  },
  sheetTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  sheetTitle: { fontSize: 20, fontWeight: '900', letterSpacing: 0 },
  fieldLabel: { fontSize: 12, fontWeight: '800', lineHeight: 17 },
  sheetHandle: { alignItems: 'center', justifyContent: 'center', height: 22, marginTop: -4 },
  sheetHandleBar: { width: 42, height: 4, borderRadius: 999 },
  sheetHabitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 15,
    borderWidth: 1,
    padding: 11,
    gap: 11,
  },
  sheetEmoji: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHabitTitle: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: '900' },

  menuTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1, minWidth: 0 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: 15,
    borderWidth: 1,
    padding: 14,
  },
  menuRowText: { fontSize: 15, fontWeight: '900' },
  confirmRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  confirmButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingVertical: 14,
  },
  confirmButtonText: { fontSize: 15, fontWeight: '900' },

  nameRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  iconPreview: {
    width: 56,
    height: 56,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  iconOption: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameInput: {
    flex: 1,
    height: 56,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '800',
  },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
  colorCircle: { width: 31, height: 31, borderRadius: 11 },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 15,
    paddingVertical: 15,
    marginTop: 4,
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
});
