import React, { useCallback, useEffect, useState } from 'react';
import { ImageBackground, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/context/ThemeContext';
import HabitIcon from '../../src/components/HabitIcon';
import { DEFAULT_HABIT_ICON, HABIT_ICONS } from '../../src/constants/habitIcons';
import { createHabit, getCompletionsForDate, getHabitStreak, getHabits, toggleCompletion } from '../../src/db/habitDatabase';

const habitsArt = require('../../assets/illustrations/storybook-habits.png');
const paperArt = require('../../assets/illustrations/storybook-paper.png');
const COLORS = ['#F47F72', '#23B8D0', '#69B989', '#8E7DCA', '#F2A35F', '#D95763'];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function HabitsScreen() {
  const C = useTheme();
  const today = todayStr();
  const [habits, setHabits] = useState([]);
  const [completed, setCompleted] = useState(new Set());
  const [streaks, setStreaks] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState(DEFAULT_HABIT_ICON);
  const [color, setColor] = useState(COLORS[0]);

  useFocusEffect(useCallback(() => {
    load();
  }, []));

  async function load() {
    const h = await getHabits();
    const done = await getCompletionsForDate(today);
    const streakPairs = await Promise.all(h.map(async (habit) => [habit.id, await getHabitStreak(habit.id)]));
    setHabits(h);
    setCompleted(done);
    setStreaks(Object.fromEntries(streakPairs));
  }

  async function toggle(id) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await toggleCompletion(id, today);
    await load();
  }

  async function addHabit() {
    if (!title.trim()) return;
    await createHabit(title.trim(), icon, color);
    setTitle('');
    setIcon(DEFAULT_HABIT_ICON);
    setColor(COLORS[0]);
    setShowAdd(false);
    await load();
  }

  const doneCount = habits.filter((habit) => completed.has(habit.id)).length;
  const percent = habits.length ? Math.round((doneCount / habits.length) * 100) : 0;

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView style={styles.pageScroll} contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
        <ImageBackground source={habitsArt} style={styles.hero} imageStyle={styles.heroImage}>
          <View style={styles.topBar}>
            <Text style={[styles.title, { color: C.text }]}>Routine Story</Text>
            <TouchableOpacity style={[styles.circleBtn, { backgroundColor: C.white }]} onPress={() => setShowAdd(true)}>
              <Ionicons name="add" size={20} color={C.primary} />
            </TouchableOpacity>
          </View>
          <View style={[styles.progressCard, { backgroundColor: C.white }]}>
            <Text style={[styles.script, { color: C.text }]}>keep it gentle</Text>
            <Text style={[styles.percent, { color: C.primary }]}>{percent}%</Text>
            <Text style={[styles.caption, { color: C.textSecondary }]}>{doneCount}/{habits.length} rituals complete</Text>
            <View style={[styles.track, { backgroundColor: C.primaryLight }]}>
              <View style={[styles.fill, { width: `${percent}%`, backgroundColor: C.primary }]} />
            </View>
          </View>
        </ImageBackground>

        <ImageBackground source={paperArt} style={[styles.sheet, styles.sheetContent]} imageStyle={styles.sheetImage}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>Today&apos;s playlist</Text>
          <View style={styles.list}>
            {habits.length === 0 ? (
              <TouchableOpacity style={[styles.empty, { backgroundColor: C.card, borderColor: C.border }]} onPress={() => setShowAdd(true)}>
                <Text style={[styles.itemTitle, { color: C.text }]}>Add your first ritual</Text>
                <Text style={[styles.itemMeta, { color: C.textSecondary }]}>Start with something tiny.</Text>
              </TouchableOpacity>
            ) : habits.map((habit) => {
              const done = completed.has(habit.id);
              return (
                <TouchableOpacity key={habit.id} style={[styles.item, { backgroundColor: C.card, borderColor: done ? habit.color : C.border }]} onPress={() => toggle(habit.id)}>
                  <View style={[styles.iconWrap, { backgroundColor: done ? habit.color : C.primaryLight }]}>
                    <HabitIcon name={habit.emoji} size={20} color={done ? C.white : habit.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemTitle, { color: done ? C.textSecondary : C.text }, done && { textDecorationLine: 'line-through' }]}>{habit.title}</Text>
                    <Text style={[styles.itemMeta, { color: C.textSecondary }]}>{streaks[habit.id] || 0} day streak</Text>
                  </View>
                  <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={done ? habit.color : C.textSecondary} />
                </TouchableOpacity>
              );
            })}
          </View>
        </ImageBackground>
      </ScrollView>

      <Modal visible={showAdd} transparent animationType="slide">
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backdrop} onPress={() => setShowAdd(false)} />
          <View style={[styles.sheetModal, { backgroundColor: C.card }]}>
            <Text style={[styles.modalTitle, { color: C.text }]}>New ritual</Text>
            <TextInput style={[styles.input, { backgroundColor: C.panel, borderColor: C.border, color: C.text }]} value={title} onChangeText={setTitle} placeholder="Habit title" placeholderTextColor={C.textSecondary} />
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
              <Text style={styles.saveText}>Add ritual</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pageScroll: { flex: 1 },
  pageContent: { paddingBottom: 0 },
  hero: { height: 500, paddingTop: 58, paddingHorizontal: 22 },
  heroImage: { resizeMode: 'cover' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: 'Rounded', fontSize: 24, fontWeight: '900' },
  circleBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', shadowColor: '#8792BE', shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  progressCard: { marginTop: 88, width: 178, borderRadius: 28, padding: 18, shadowColor: '#7D88B8', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  script: { fontFamily: 'Story', fontSize: 34 },
  percent: { fontFamily: 'Rounded', fontSize: 38, fontWeight: '900', marginTop: -2 },
  caption: { fontFamily: 'Rounded', fontSize: 11, fontWeight: '900' },
  track: { height: 8, borderRadius: 999, overflow: 'hidden', marginTop: 12 },
  fill: { height: '100%', borderRadius: 999 },
  sheet: {
    marginTop: -44,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    overflow: 'hidden',
  },
  sheetImage: { resizeMode: 'cover', borderTopLeftRadius: 34, borderTopRightRadius: 34 },
  sheetContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 30 },
  sectionTitle: { fontFamily: 'Rounded', fontSize: 18, fontWeight: '900', marginBottom: 12 },
  list: { gap: 10 },
  item: { minHeight: 68, borderRadius: 22, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  empty: { borderRadius: 22, borderWidth: 1, padding: 18 },
  iconWrap: { width: 44, height: 44, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontFamily: 'Rounded', fontSize: 15, fontWeight: '900' },
  itemMeta: { fontFamily: 'Rounded', fontSize: 11, fontWeight: '800', marginTop: 3 },
  overlay: { flex: 1, backgroundColor: 'rgba(39,42,75,0.45)', justifyContent: 'flex-end' },
  backdrop: { flex: 1 },
  sheetModal: { borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 22, paddingBottom: 34, gap: 14 },
  modalTitle: { fontFamily: 'Rounded', fontSize: 22, fontWeight: '900' },
  input: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13, fontFamily: 'Rounded', fontWeight: '800' },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  pickIcon: { width: 40, height: 40, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  colorRow: { flexDirection: 'row', gap: 10 },
  swatch: { width: 32, height: 32, borderRadius: 12, borderWidth: 2 },
  save: { borderRadius: 20, alignItems: 'center', paddingVertical: 15 },
  saveText: { color: '#FFFFFF', fontFamily: 'Rounded', fontWeight: '900', fontSize: 15 },
});
