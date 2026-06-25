import React, { useCallback, useEffect, useState } from 'react';
import { Image, ImageBackground, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/context/ThemeContext';
import GiftPhotoFrame from '../../src/components/GiftPhotoFrame';
import HabitIcon from '../../src/components/HabitIcon';
import { DEFAULT_HABIT_ICON, HABIT_ICONS } from '../../src/constants/habitIcons';
import {
  archiveHabit,
  createHabit,
  getCompletionsForDate,
  getHabitStreak,
  getHabitWeekProgress,
  getHabits,
  parseWeeklyTarget,
  toggleCompletion,
  updateHabit,
} from '../../src/db/habitDatabase';
import StorybookHeroFade from '../../src/components/StorybookHeroFade';
import { getStoryHeroHeight, STORY_TAB_BOTTOM_PADDING } from '../../src/constants/storybookLayout';

const habitsArt = require('../../assets/illustrations/storybook-habits.png');
const paperArt = require('../../assets/illustrations/storybook-paper-rich.png');
const deleteCardArt = require('../../assets/illustrations/dialogs/delete-habit-card.png');
const COLORS = ['#F47F72', '#23B8D0', '#69B989', '#8E7DCA', '#F2A35F', '#D95763'];
const TARGET_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function HabitsScreen() {
  const C = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  const today = todayStr();
  const [habits, setHabits] = useState([]);
  const [completed, setCompleted] = useState(new Set());
  const [streaks, setStreaks] = useState({});
  const [weekProgress, setWeekProgress] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState(DEFAULT_HABIT_ICON);
  const [color, setColor] = useState(COLORS[0]);
  const [daysPerWeek, setDaysPerWeek] = useState(7);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [editDaysPerWeek, setEditDaysPerWeek] = useState(7);
  const [pendingDelete, setPendingDelete] = useState(null);

  useFocusEffect(useCallback(() => {
    load();
  }, []));

  async function load() {
    const h = await getHabits();
    const done = await getCompletionsForDate(today);
    const [streakPairs, progressPairs] = await Promise.all([
      Promise.all(h.map(async (habit) => [habit.id, await getHabitStreak(habit.id)])),
      Promise.all(h.map(async (habit) => [habit.id, await getHabitWeekProgress(habit, today)])),
    ]);
    setHabits(h);
    setCompleted(done);
    setStreaks(Object.fromEntries(streakPairs));
    setWeekProgress(Object.fromEntries(progressPairs));
  }

  async function toggle(id) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await toggleCompletion(id, today);
    await load();
  }

  async function addHabit() {
    if (!title.trim()) return;
    await createHabit(title.trim(), icon, color, daysPerWeek);
    setTitle('');
    setIcon(DEFAULT_HABIT_ICON);
    setColor(COLORS[0]);
    setDaysPerWeek(7);
    setShowAdd(false);
    await load();
  }

  function requestDeleteHabit(habit) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setPendingDelete(habit);
  }

  function openScheduleEditor(habit) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingSchedule(habit);
    setEditDaysPerWeek(parseWeeklyTarget(habit.schedule_days));
  }

  async function saveSchedule() {
    if (!editingSchedule) return;
    await updateHabit(editingSchedule.id, editingSchedule.title, editingSchedule.emoji, editingSchedule.color, editDaysPerWeek);
    setEditingSchedule(null);
    await load();
  }

  async function confirmDeleteHabit() {
    if (!pendingDelete) return;
    await archiveHabit(pendingDelete.id);
    setPendingDelete(null);
    await load();
  }

  const goalsMet = habits.filter((habit) => weekProgress[habit.id]?.goalMet).length;
  const dueCount = habits.filter((habit) => weekProgress[habit.id]?.dueToday).length;
  const percent = habits.length ? Math.round((goalsMet / habits.length) * 100) : 100;
  const heroHeight = getStoryHeroHeight(screenHeight, { min: 480, max: 530, ratio: 0.52 });

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView style={styles.pageScroll} contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
        <ImageBackground source={habitsArt} style={[styles.hero, { height: heroHeight }]} imageStyle={styles.heroImage}>
          <StorybookHeroFade />
          <View style={styles.topBar}>
            <TouchableOpacity style={[styles.circleBtn, { backgroundColor: C.white }]} onPress={() => setShowAdd(true)}>
              <Ionicons name="add" size={20} color={C.primary} />
            </TouchableOpacity>
          </View>
          <View style={[styles.progressCard, { backgroundColor: C.white }]}>
            <Text style={[styles.script, { color: C.text }]}>keep it gentle</Text>
            <Text style={[styles.percent, { color: C.primary }]}>{percent}%</Text>
            <Text style={[styles.caption, { color: C.textSecondary }]}>
              {habits.length ? dueCount ? `${dueCount} need a check-in` : 'all habit goals met' : 'nothing due today'}
            </Text>
            <View style={[styles.track, { backgroundColor: C.primaryLight }]}>
              <View style={[styles.fill, { width: `${percent}%`, backgroundColor: C.primary }]} />
            </View>
          </View>
        </ImageBackground>

        <ImageBackground source={paperArt} style={[styles.sheet, styles.sheetContent]} imageStyle={styles.sheetImage}>
          <GiftPhotoFrame C={C} compact style={styles.habitMemory} />

          <Text style={[styles.sectionTitle, { color: C.text }]}>Today's habits</Text>
          <View style={styles.list}>
            {habits.length === 0 ? (
              <TouchableOpacity style={[styles.empty, { backgroundColor: C.card, borderColor: C.border }]} onPress={() => setShowAdd(true)}>
                <Text style={[styles.itemTitle, { color: C.text }]}>Add your first habit</Text>
                <Text style={[styles.itemMeta, { color: C.textSecondary }]}>Start with something tiny.</Text>
              </TouchableOpacity>
            ) : habits.map((habit) => {
              const done = completed.has(habit.id);
              const progress = weekProgress[habit.id] || {
                target: parseWeeklyTarget(habit.schedule_days),
                completed: 0,
                dueToday: true,
                goalMet: false,
                todayDone: done,
              };
              const scheduled = progress.dueToday || done;
              const scheduleLabel = formatSchedule(progress.target);
              const progressLabel = progress.target === 7
                ? done ? 'done today' : scheduleLabel
                : `${Math.min(progress.completed, progress.target)}/${progress.target} this week`;
              const statusLabel = !progress.dueToday && !done ? `goal met - ${progressLabel}` : progressLabel;
              return (
                <TouchableOpacity
                  key={habit.id}
                  style={[styles.item, { backgroundColor: C.card, borderColor: done ? habit.color : C.border }, !scheduled && styles.offDayItem]}
                  onPress={() => toggle(habit.id)}
                  onLongPress={() => requestDeleteHabit(habit)}
                  delayLongPress={360}
                >
                  <View style={[styles.iconWrap, { backgroundColor: done ? habit.color : C.primaryLight }]}>
                    <HabitIcon name={habit.emoji} size={20} color={done ? C.white : habit.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemTitle, { color: done ? C.textSecondary : C.text }, done && { textDecorationLine: 'line-through' }]}>{habit.title}</Text>
                    <Text style={[styles.itemMeta, { color: C.textSecondary }]}>
                      {formatStreak(streaks[habit.id] || 0, progress.target)} - {statusLabel}
                    </Text>
                  </View>
                  <TouchableOpacity style={[styles.rowIconBtn, { backgroundColor: C.primaryLight }]} onPress={() => openScheduleEditor(habit)}>
                    <Ionicons name="calendar-outline" size={17} color={C.primary} />
                  </TouchableOpacity>
                  <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={done ? habit.color : C.textSecondary} />
                </TouchableOpacity>
              );
            })}
          </View>
        </ImageBackground>
      </ScrollView>

      <Modal visible={showAdd} transparent animationType="slide" statusBarTranslucent>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={18}
        >
          <TouchableOpacity style={styles.backdrop} onPress={() => setShowAdd(false)} />
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={[styles.sheetModal, { backgroundColor: C.card }]}>
              <Text style={[styles.modalTitle, { color: C.text }]}>New habit</Text>
              <TextInput style={[styles.input, { backgroundColor: C.panel, borderColor: C.border, color: C.text }]} value={title} onChangeText={setTitle} placeholder="Habit title" placeholderTextColor={C.textSecondary} />
              <View>
                <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>How many days a week?</Text>
                <View style={styles.dayRow}>
                  {TARGET_OPTIONS.map((target) => {
                    const active = daysPerWeek === target;
                    return (
                      <TouchableOpacity
                        key={`target-${target}`}
                        style={[styles.dayChip, { backgroundColor: active ? color : C.panel, borderColor: active ? color : C.border }]}
                        onPress={() => setDaysPerWeek(target)}
                      >
                        <Text style={[styles.dayChipText, { color: active ? C.white : C.textSecondary }]}>{target}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={styles.iconGrid}>
                {HABIT_ICONS.slice(0, 12).map((name) => (
                  <TouchableOpacity key={name} style={[styles.pickIcon, { backgroundColor: icon === name ? color : C.panel, borderColor: C.border }]} onPress={() => setIcon(name)}>
                    <Ionicons name={name} size={18} color={icon === name ? C.white : C.text} />
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.colorRow}>
                {COLORS.map((swatch) => <TouchableOpacity key={swatch} style={[styles.swatch, { backgroundColor: swatch, borderColor: color === swatch ? C.text : 'transparent' }]} onPress={() => setColor(swatch)} />)}
              </View>
              <TouchableOpacity style={[styles.save, { backgroundColor: color }]} onPress={addHabit}>
                <Text style={styles.saveText}>Add habit</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!editingSchedule} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.confirmOverlay}>
          <TouchableOpacity style={styles.confirmBackdrop} onPress={() => setEditingSchedule(null)} />
          <View style={[styles.scheduleCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[styles.confirmTitle, { color: C.text }]}>Habit schedule</Text>
            <Text style={[styles.confirmBody, { color: C.textSecondary }]} numberOfLines={2}>
              {editingSchedule?.title}
            </Text>
            <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>days per week</Text>
            <View style={styles.dayRow}>
              {TARGET_OPTIONS.map((target) => {
                const active = editDaysPerWeek === target;
                return (
                  <TouchableOpacity
                    key={`edit-target-${target}`}
                    style={[styles.dayChip, { backgroundColor: active ? (editingSchedule?.color || C.primary) : C.panel, borderColor: active ? (editingSchedule?.color || C.primary) : C.border }]}
                    onPress={() => setEditDaysPerWeek(target)}
                  >
                    <Text style={[styles.dayChipText, { color: active ? C.white : C.textSecondary }]}>{target}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={[styles.confirmButton, styles.cancelButton, { backgroundColor: C.white, borderColor: C.border }]} onPress={() => setEditingSchedule(null)}>
                <Text style={[styles.cancelText, { color: C.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmButton, { backgroundColor: editingSchedule?.color || C.primary }]} onPress={saveSchedule}>
                <Text style={styles.deleteText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!pendingDelete} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.confirmOverlay}>
          <TouchableOpacity style={styles.confirmBackdrop} onPress={() => setPendingDelete(null)} />
          <View style={styles.confirmCard}>
            <Image source={deleteCardArt} style={styles.confirmCardImage} resizeMode="stretch" />
            <View style={styles.confirmCardContent}>
              <Text style={[styles.confirmTitle, { color: C.text }]}>Delete habit?</Text>
              <Text style={[styles.confirmBody, { color: C.textSecondary }]} numberOfLines={2}>
                {pendingDelete?.title}
              </Text>
              <View style={styles.confirmActions}>
                <TouchableOpacity style={[styles.confirmButton, styles.cancelButton, { backgroundColor: C.white, borderColor: C.border }]} onPress={() => setPendingDelete(null)}>
                  <Text style={[styles.cancelText, { color: C.textSecondary }]}>Keep</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.confirmButton, { backgroundColor: C.primary }]} onPress={confirmDeleteHabit}>
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function formatSchedule(daysPerWeek) {
  if (daysPerWeek === 7) return 'daily';
  return `${daysPerWeek} days/week`;
}

function formatStreak(streak, daysPerWeek) {
  return `${streak} ${daysPerWeek === 7 ? 'day' : 'week'} streak`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pageScroll: { flex: 1 },
  pageContent: { paddingBottom: 0 },
  hero: { paddingTop: 58, paddingHorizontal: 22 },
  heroImage: { resizeMode: 'cover' },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  circleBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', shadowColor: '#8792BE', shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  progressCard: { marginTop: 88, width: 178, borderRadius: 28, padding: 18, shadowColor: '#7D88B8', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  script: { fontFamily: 'Story', fontSize: 34 },
  percent: { fontFamily: 'Rounded', fontSize: 38, fontWeight: '900', marginTop: -2 },
  caption: { fontFamily: 'Rounded', fontSize: 11, fontWeight: '900' },
  track: { height: 8, borderRadius: 999, overflow: 'hidden', marginTop: 12 },
  fill: { height: '100%', borderRadius: 999 },
  sheet: {
    marginTop: 0,
    minHeight: 520,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    overflow: 'hidden',
  },
  sheetImage: { resizeMode: 'cover', borderTopLeftRadius: 34, borderTopRightRadius: 34 },
  sheetContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: STORY_TAB_BOTTOM_PADDING + 8 },
  habitMemory: { width: '52%', maxWidth: 178, minHeight: 220, alignSelf: 'center', marginBottom: 20 },
  sectionTitle: { fontFamily: 'Rounded', fontSize: 18, fontWeight: '900', marginBottom: 12 },
  list: { gap: 10 },
  item: { minHeight: 68, borderRadius: 22, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  offDayItem: { opacity: 0.74 },
  empty: { borderRadius: 22, borderWidth: 1, padding: 18 },
  iconWrap: { width: 44, height: 44, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rowIconBtn: { width: 34, height: 34, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontFamily: 'Rounded', fontSize: 15, fontWeight: '900' },
  itemMeta: { fontFamily: 'Rounded', fontSize: 11, fontWeight: '800', marginTop: 3 },
  overlay: { flex: 1, backgroundColor: 'rgba(39,42,75,0.45)', justifyContent: 'flex-end' },
  backdrop: { flex: 1 },
  modalScroll: { maxHeight: '82%' },
  modalScrollContent: { flexGrow: 1, justifyContent: 'flex-end' },
  sheetModal: { borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 22, paddingBottom: 34, gap: 14 },
  modalTitle: { fontFamily: 'Rounded', fontSize: 22, fontWeight: '900' },
  input: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13, fontFamily: 'Rounded', fontWeight: '800' },
  fieldLabel: { fontFamily: 'Rounded', fontSize: 12, fontWeight: '900', marginBottom: 8 },
  dayRow: { flexDirection: 'row', gap: 7 },
  dayChip: { flex: 1, height: 38, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dayChipText: { fontFamily: 'Rounded', fontSize: 12, fontWeight: '900' },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  pickIcon: { width: 40, height: 40, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  colorRow: { flexDirection: 'row', gap: 10 },
  swatch: { width: 32, height: 32, borderRadius: 12, borderWidth: 2 },
  save: { borderRadius: 20, alignItems: 'center', paddingVertical: 15 },
  saveText: { color: '#FFFFFF', fontFamily: 'Rounded', fontWeight: '900', fontSize: 15 },
  confirmOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(39,42,75,0.28)', padding: 22 },
  confirmBackdrop: { ...StyleSheet.absoluteFillObject },
  confirmCard: { width: '88%', maxWidth: 320, minHeight: 250, alignItems: 'center', justifyContent: 'center' },
  scheduleCard: { width: '90%', maxWidth: 340, borderRadius: 30, borderWidth: 1, padding: 22, alignItems: 'center', shadowColor: '#7D88B8', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  confirmCardImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', borderRadius: 30 },
  confirmCardContent: { width: '100%', paddingHorizontal: 24, paddingTop: 46, paddingBottom: 24, alignItems: 'center', justifyContent: 'center' },
  confirmTitle: { fontFamily: 'Rounded', fontSize: 24, fontWeight: '900', textAlign: 'center' },
  confirmBody: { fontFamily: 'Rounded', fontSize: 15, fontWeight: '800', textAlign: 'center', marginTop: 8, minHeight: 34 },
  confirmActions: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 20 },
  confirmButton: { flex: 1, borderRadius: 18, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  cancelButton: { borderWidth: 1 },
  cancelText: { fontFamily: 'Rounded', fontWeight: '900', fontSize: 14 },
  deleteText: { color: '#FFFFFF', fontFamily: 'Rounded', fontWeight: '900', fontSize: 14 },
});
