import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Modal, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Stack, useFocusEffect, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../src/context/ThemeContext';
import { getGoals, createGoal, updateGoalProgress, toggleGoalComplete, deleteGoal, updateGoal } from '../src/db/goalsDatabase';
import { COLORS } from '../src/constants/theme';

const CATEGORIES = ['personal', 'health', 'learning', 'finance', 'creative', 'career', 'social'];
const CATEGORY_ICONS = {
  personal: '✦', health: '💪', learning: '📚', finance: '💰',
  creative: '🎨', career: '🚀', social: '🤝',
};

export default function GoalsScreen() {
  const C = useTheme();
  const [goals, setGoals] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [progressGoal, setProgressGoal] = useState(null);
  const [progressValue, setProgressValue] = useState('');

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('personal');
  const [formTarget, setFormTarget] = useState('');
  const [formUnit, setFormUnit] = useState('');
  const [formDeadline, setFormDeadline] = useState('');

  useFocusEffect(useCallback(() => { load(); }, []));

  async function load() {
    const g = await getGoals();
    setGoals(g);
  }

  function openAdd() {
    setEditingGoal(null);
    setFormTitle(''); setFormCategory('personal');
    setFormTarget(''); setFormUnit(''); setFormDeadline('');
    setShowAdd(true);
  }

  function openEdit(goal) {
    setEditingGoal(goal);
    setFormTitle(goal.title);
    setFormCategory(goal.category || 'personal');
    setFormTarget(goal.target_value != null ? String(goal.target_value) : '');
    setFormUnit(goal.unit || '');
    setFormDeadline(goal.deadline || '');
    setShowAdd(true);
  }

  async function handleSave() {
    if (!formTitle.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const data = {
      title: formTitle.trim(),
      category: formCategory,
      targetValue: formTarget ? parseFloat(formTarget) : null,
      unit: formUnit.trim() || null,
      deadline: formDeadline.trim() || null,
    };
    if (editingGoal) {
      await updateGoal(editingGoal.id, data);
    } else {
      await createGoal(data);
    }
    setShowAdd(false);
    load();
  }

  async function handleUpdateProgress(goal) {
    const val = parseFloat(progressValue);
    if (isNaN(val) || val < 0) { Alert.alert('invalid', 'enter a valid number.'); return; }
    await updateGoalProgress(goal.id, val);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setProgressGoal(null);
    load();
  }

  async function handleToggleComplete(goal) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await toggleGoalComplete(goal.id, goal.completed);
    load();
  }

  async function handleDelete(goal) {
    Alert.alert('delete goal', `"${goal.title}"? this will be gone forever.`, [
      { text: 'cancel', style: 'cancel' },
      { text: 'delete', style: 'destructive', onPress: async () => { await deleteGoal(goal.id); load(); } },
    ]);
  }

  const active = goals.filter(g => !g.completed);
  const done = goals.filter(g => g.completed);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={[s.container, { backgroundColor: C.background }]} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>`n        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[s.back, { color: C.text }]}>←</Text>
          </TouchableOpacity>
          <Text style={[s.title, { color: C.text }]}>goals</Text>
          <TouchableOpacity style={[s.addBtn, { backgroundColor: C.card }]} onPress={openAdd} activeOpacity={0.7}>
            <Text style={[s.addBtnText, { color: C.text }]}>+ add</Text>
          </TouchableOpacity>
        </View>

        {active.length === 0 && done.length === 0 && (
          <View style={s.empty}>
            <Text style={[s.emptyTitle, { color: C.text }]}>no goals yet</Text>
            <Text style={[s.emptyDesc, { color: C.textSecondary }]}>set a goal and track your progress over time.</Text>
            <TouchableOpacity style={[s.emptyBtn, { backgroundColor: C.card }]} onPress={openAdd} activeOpacity={0.7}>
              <Text style={[s.emptyBtnText, { color: C.text }]}>+ add first goal</Text>
            </TouchableOpacity>
          </View>
        )}

        {active.map(goal => {
          const hasProg = goal.target_value != null && goal.target_value > 0;
          const pct = hasProg ? Math.min(100, Math.round((goal.current_value / goal.target_value) * 100)) : null;
          return (
            <TouchableOpacity
              key={goal.id}
              style={[s.goalCard, { backgroundColor: C.card }]}
              onLongPress={() => Alert.alert(goal.title, null, [
                { text: 'edit', onPress: () => openEdit(goal) },
                { text: 'mark complete', onPress: () => handleToggleComplete(goal) },
                { text: 'delete', style: 'destructive', onPress: () => handleDelete(goal) },
                { text: 'cancel', style: 'cancel' },
              ])}
              onPress={() => {
                if (hasProg) { setProgressValue(String(goal.current_value || '')); setProgressGoal(goal); }
                else handleToggleComplete(goal);
              }}
              activeOpacity={0.7}
            >
              <View style={s.goalTop}>
                <Text style={s.catIcon}>{CATEGORY_ICONS[goal.category] || '✦'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.goalTitle, { color: C.text }]}>{goal.title}</Text>
                  <Text style={[s.goalCat, { color: C.textSecondary }]}>{goal.category}</Text>
                </View>
                {hasProg && (
                  <Text style={[s.goalPct, { color: pct >= 100 ? '#6CC97C' : C.text }]}>{pct}%</Text>
                )}
              </View>
              {hasProg && (
                <View style={[s.track, { backgroundColor: C.border }]}>
                  <View style={[s.fill, { width: `${pct}%`, backgroundColor: pct >= 100 ? '#6CC97C' : C.text }]} />
                </View>
              )}
              {hasProg && (
                <Text style={[s.goalProgress, { color: C.textSecondary }]}>
                  {goal.current_value} / {goal.target_value}{goal.unit ? ` ${goal.unit}` : ''}
                  {goal.deadline ? `  ·  due ${goal.deadline}` : ''}
                </Text>
              )}
              {!hasProg && goal.deadline && (
                <Text style={[s.goalProgress, { color: C.textSecondary }]}>due {goal.deadline}</Text>
              )}
            </TouchableOpacity>
          );
        })}

        {done.length > 0 && (
          <>
            <Text style={[s.doneLabel, { color: C.textSecondary }]}>completed</Text>
            {done.map(goal => (
              <TouchableOpacity
                key={goal.id}
                style={[s.goalCard, s.doneCard, { backgroundColor: C.card }]}
                onLongPress={() => Alert.alert(goal.title, null, [
                  { text: 'reopen', onPress: () => handleToggleComplete(goal) },
                  { text: 'delete', style: 'destructive', onPress: () => handleDelete(goal) },
                  { text: 'cancel', style: 'cancel' },
                ])}
                activeOpacity={0.7}
              >
                <View style={s.goalTop}>
                  <Text style={s.catIcon}>{CATEGORY_ICONS[goal.category] || '✦'}</Text>
                  <Text style={[s.goalTitle, { color: C.textSecondary, textDecorationLine: 'line-through', flex: 1 }]}>
                    {goal.title}
                  </Text>
                  <Text style={{ fontSize: 16 }}>✓</Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>

      {/* Progress update modal */}
      <Modal visible={!!progressGoal} transparent animationType="fade">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={s.overlay} onPress={() => setProgressGoal(null)} activeOpacity={1}>
            <View style={[s.progSheet, { backgroundColor: C.card }]}>
              <Text style={[s.progTitle, { color: C.text }]}>{progressGoal?.title}</Text>
              <Text style={[s.progLabel, { color: C.textSecondary }]}>
                current progress{progressGoal?.unit ? ` (${progressGoal.unit})` : ''}
              </Text>
              <TextInput
                style={[s.progInput, { color: C.text, borderColor: C.border }]}
                value={progressValue}
                onChangeText={setProgressValue}
                keyboardType="numeric"
                autoFocus
                placeholder="0"
                placeholderTextColor={C.textSecondary}
              />
              <TouchableOpacity style={[s.progBtn, { backgroundColor: C.accent }]} onPress={() => handleUpdateProgress(progressGoal)}>
                <Text style={[s.progBtnText, { color: C.background }]}>update</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add/Edit goal modal */}
      <Modal visible={showAdd} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={s.overlay} onPress={() => setShowAdd(false)} activeOpacity={1}>
            <View style={[s.sheet, { backgroundColor: C.card }]}>
              <Text style={[s.sheetTitle, { color: C.text }]}>{editingGoal ? 'edit goal' : 'new goal'}</Text>

              <Text style={[s.fieldLabel, { color: C.textSecondary }]}>goal</Text>
              <TextInput
                style={[s.input, { backgroundColor: C.background, borderColor: C.border, color: C.text }]}
                placeholder="what do you want to achieve?"
                placeholderTextColor={C.textSecondary}
                value={formTitle}
                onChangeText={setFormTitle}
                autoFocus
              />

              <Text style={[s.fieldLabel, { color: C.textSecondary }]}>category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[s.catChip, { borderColor: C.border, backgroundColor: formCategory === cat ? C.text : C.background }]}
                    onPress={() => setFormCategory(cat)}
                  >
                    <Text style={[s.catChipText, { color: formCategory === cat ? C.background : C.textSecondary }]}>
                      {CATEGORY_ICONS[cat]} {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={s.rowInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.fieldLabel, { color: C.textSecondary }]}>target (optional)</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: C.background, borderColor: C.border, color: C.text }]}
                    placeholder="100"
                    placeholderTextColor={C.textSecondary}
                    value={formTarget}
                    onChangeText={setFormTarget}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.fieldLabel, { color: C.textSecondary }]}>unit</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: C.background, borderColor: C.border, color: C.text }]}
                    placeholder="pages, km..."
                    placeholderTextColor={C.textSecondary}
                    value={formUnit}
                    onChangeText={setFormUnit}
                  />
                </View>
              </View>

              <Text style={[s.fieldLabel, { color: C.textSecondary }]}>deadline (optional)</Text>
              <TextInput
                style={[s.input, { backgroundColor: C.background, borderColor: C.border, color: C.text }]}
                placeholder="e.g. Dec 31, 2025"
                placeholderTextColor={C.textSecondary}
                value={formDeadline}
                onChangeText={setFormDeadline}
              />

              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: C.accent }, !formTitle.trim() && { opacity: 0.4 }]}
                onPress={handleSave}
                disabled={!formTitle.trim()}
                activeOpacity={0.8}
              >
                <Text style={[s.saveBtnText, { color: C.background }]}>{editingGoal ? 'save changes' : 'add goal'}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 60, paddingBottom: 50 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 28 },
  back: { fontSize: 24 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, flex: 1 },
  addBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, elevation: 1 },
  addBtnText: { fontSize: 13, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyDesc: { fontSize: 14, textAlign: 'center', paddingHorizontal: 20 },
  emptyBtn: { marginTop: 12, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999, elevation: 1 },
  emptyBtnText: { fontSize: 14, fontWeight: '600' },
  goalCard: { borderRadius: 18, elevation: 2, padding: 16, marginBottom: 12, gap: 8 },
  doneCard: { opacity: 0.6 },
  goalTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  catIcon: { fontSize: 20 },
  goalTitle: { fontSize: 15, fontWeight: '600', letterSpacing: 0.1 },
  goalCat: { fontSize: 11, letterSpacing: 0.3, marginTop: 2 },
  goalPct: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  goalProgress: { fontSize: 12, letterSpacing: 0.2 },
  doneLabel: { fontSize: 12, letterSpacing: 0.5, marginBottom: 10, marginTop: 8 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  progSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 44, gap: 12 },
  progTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  progLabel: { fontSize: 12, letterSpacing: 0.3 },
  progInput: {
    fontSize: 32, fontWeight: '700', letterSpacing: -1,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10,
  },
  progBtn: { borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  progBtnText: { fontSize: 15, fontWeight: '600', letterSpacing: 0.8 },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 44, gap: 4 },
  sheetTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3, marginBottom: 12 },
  fieldLabel: { fontSize: 11, letterSpacing: 0.5, marginBottom: 6, marginTop: 8 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, marginBottom: 4 },
  rowInputs: { flexDirection: 'row', gap: 10 },
  catChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, marginRight: 8 },
  catChipText: { fontSize: 12, letterSpacing: 0.2 },
  saveBtn: { borderRadius: 999, paddingVertical: 15, alignItems: 'center', marginTop: 12 },
  saveBtnText: { fontSize: 15, fontWeight: '600', letterSpacing: 0.8 },
});
