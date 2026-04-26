import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../src/context/ThemeContext';
import {
  getCalorieEntries,
  getCalorieDaySummary,
  getCalorieGoal,
  getMacroGoals,
  getRecentFoods,
  getRecentCalorieSummaries,
  saveCalorieEntry,
  saveCalorieGoal,
  saveMacroGoals,
  deleteCalorieEntry,
  hideRecentFood,
} from '../src/db/calorieDatabase';
import { getSavedMeals } from '../src/db/savedMealsDatabase';

const MEALS = [
  { key: 'breakfast', label: 'Breakfast', color: '#F9C74F' },
  { key: 'lunch', label: 'Lunch', color: '#6CC97C' },
  { key: 'dinner', label: 'Dinner', color: '#89B4D4' },
  { key: 'snack', label: 'Snack', color: '#C5A8E8' },
];

function dateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function todayStr() {
  return dateStr(new Date());
}

function shiftDate(date, amount) {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + amount);
  return dateStr(d);
}

function fmtDate(date) {
  const today = todayStr();
  const yesterday = shiftDate(today, -1);
  if (date === today) return 'today';
  if (date === yesterday) return 'yesterday';
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function toDraft(value) {
  return value === null || value === undefined ? '' : String(value);
}

function optionalNumber(value) {
  if (!String(value || '').trim()) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function roundMacro(value) {
  const num = Number(value || 0);
  return Math.round(num * 10) / 10;
}

export default function CaloriesScreen() {
  const C = useTheme();
  const today = todayStr();

  const [selectedDate, setSelectedDate] = useState(today);
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 });
  const [history, setHistory] = useState([]);
  const [recentFoods, setRecentFoods] = useState([]);
  const [goal, setGoal] = useState(2000);
  const [goalDraft, setGoalDraft] = useState('2000');
  const [macroGoals, setMacroGoals] = useState({ protein: 0, carbs: 0, fat: 0 });
  const [macroGoalDrafts, setMacroGoalDrafts] = useState({ protein: '', carbs: '', fat: '' });
  const [savedMeals, setSavedMeals] = useState([]);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [meal, setMeal] = useState('breakfast');
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [note, setNote] = useState('');

  useFocusEffect(useCallback(() => {
    load();
  }, [selectedDate]));

  async function load() {
    const [nextEntries, nextSummary, nextHistory, nextFoods, nextGoal, nextMacroGoals, nextMeals] = await Promise.all([
      getCalorieEntries(selectedDate),
      getCalorieDaySummary(selectedDate),
      getRecentCalorieSummaries(7),
      getRecentFoods(20),
      getCalorieGoal(),
      getMacroGoals(),
      getSavedMeals(),
    ]);
    setEntries(nextEntries);
    setSummary(nextSummary);
    setHistory(nextHistory);
    setRecentFoods(nextFoods);
    setGoal(nextGoal);
    setGoalDraft(String(nextGoal));
    setMacroGoals(nextMacroGoals);
    setSavedMeals(nextMeals);
    setMacroGoalDrafts({
      protein: nextMacroGoals.protein > 0 ? String(nextMacroGoals.protein) : '',
      carbs: nextMacroGoals.carbs > 0 ? String(nextMacroGoals.carbs) : '',
      fat: nextMacroGoals.fat > 0 ? String(nextMacroGoals.fat) : '',
    });
  }

  function resetForm() {
    setEditingId(null);
    setMeal('breakfast');
    setName('');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
    setNote('');
  }

  function openEdit(entry) {
    setEditingId(entry.id);
    setMeal(entry.meal || 'snack');
    setName(entry.name || '');
    setCalories(toDraft(entry.calories));
    setProtein(toDraft(entry.protein));
    setCarbs(toDraft(entry.carbs));
    setFat(toDraft(entry.fat));
    setNote(entry.note || '');
  }

  async function repeatFood(food) {
    try {
      await saveCalorieEntry({
        date: selectedDate,
        meal: food.meal,
        name: food.name,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        note: food.note,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await load();
    } catch (e) {
      Alert.alert('error', 'could not repeat this food.');
    }
  }

  async function handleHideFood(food) {
    await hideRecentFood(food.name, food.calories);
    await load();
  }

  async function applyMeal(meal) {
    try {
      for (const item of meal.items) {
        await saveCalorieEntry({
          date: selectedDate,
          meal: item.meal || 'snack',
          name: item.name,
          calories: item.calories,
          protein: item.protein || null,
          carbs: item.carbs || null,
          fat: item.fat || null,
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    } catch {
      Alert.alert('error', 'could not add meal.');
    }
  }

  async function handleSaveMacroGoals() {
    const saved = await saveMacroGoals({
      protein: macroGoalDrafts.protein,
      carbs: macroGoalDrafts.carbs,
      fat: macroGoalDrafts.fat,
    });
    setMacroGoals(saved);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  async function handleSaveGoal() {
    const next = Number(goalDraft);
    if (!Number.isFinite(next) || next <= 0) {
      Alert.alert('invalid goal', 'enter a daily calorie goal greater than 0.');
      return;
    }
    const saved = await saveCalorieGoal(next);
    setGoal(saved);
    setGoalDraft(String(saved));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  async function handleSaveEntry() {
    const cal = Number(calories);
    if (!name.trim()) {
      Alert.alert('food name needed', 'add the food or meal name.');
      return;
    }
    if (!Number.isFinite(cal) || cal <= 0) {
      Alert.alert('calories needed', 'enter calories greater than 0.');
      return;
    }

    setSaving(true);
    try {
      await saveCalorieEntry({
        id: editingId,
        date: selectedDate,
        meal,
        name,
        calories: cal,
        protein: optionalNumber(protein),
        carbs: optionalNumber(carbs),
        fat: optionalNumber(fat),
        note,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      resetForm();
      await load();
    } catch (e) {
      Alert.alert('error', 'could not save this food entry.');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(entry) {
    Alert.alert('delete entry', `remove ${entry.name}?`, [
      { text: 'cancel', style: 'cancel' },
      {
        text: 'delete',
        style: 'destructive',
        onPress: async () => {
          await deleteCalorieEntry(entry.id);
          if (editingId === entry.id) resetForm();
          await load();
        },
      },
    ]);
  }

  const progress = goal > 0 ? Math.min(100, (summary.calories / goal) * 100) : 0;
  const remaining = goal - summary.calories;
  const canGoForward = selectedDate < today;
  const mealTotals = MEALS.map((item) => ({
    ...item,
    calories: entries
      .filter((entry) => entry.meal === item.key)
      .reduce((total, entry) => total + (Number(entry.calories) || 0), 0),
  }));
  const topMealCalories = Math.max(1, ...mealTotals.map((item) => item.calories));

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={[s.flex, { backgroundColor: C.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={[s.flex, { backgroundColor: C.background }]}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.header}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
              <Text style={[s.back, { color: C.text }]}>←</Text>
            </TouchableOpacity>
            <View style={s.headerTitleWrap}>
              <Text style={[s.title, { color: C.text }]}>calories</Text>
              <Text style={[s.dateLabel, { color: C.textSecondary }]}>{fmtDate(selectedDate)}</Text>
            </View>
            <TouchableOpacity
              style={[s.todayBtn, { backgroundColor: C.card, borderColor: C.border }]}
              onPress={() => setSelectedDate(today)}
              activeOpacity={0.75}
            >
              <Text style={[s.todayText, { color: C.text }]}>today</Text>
            </TouchableOpacity>
          </View>

          <View style={s.dateNav}>
            <TouchableOpacity
              style={[s.navBtn, { backgroundColor: C.card, borderColor: C.border }]}
              onPress={() => setSelectedDate(shiftDate(selectedDate, -1))}
            >
              <Text style={[s.navText, { color: C.text }]}>{'<'}</Text>
            </TouchableOpacity>
            <Text style={[s.fullDate, { color: C.textSecondary }]}>
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              }).toLowerCase()}
            </Text>
            <TouchableOpacity
              style={[
                s.navBtn,
                { backgroundColor: C.card, borderColor: C.border },
                !canGoForward && { opacity: 0.35 },
              ]}
              disabled={!canGoForward}
              onPress={() => setSelectedDate(shiftDate(selectedDate, 1))}
            >
              <Text style={[s.navText, { color: C.text }]}>{'>'}</Text>
            </TouchableOpacity>
          </View>

          <View style={[s.summaryCard, { backgroundColor: C.card }]}>
            <View style={s.summaryTop}>
              <View>
                <Text style={[s.kicker, { color: C.textSecondary }]}>daily total</Text>
                <Text style={[s.bigNumber, { color: C.text }]}>{summary.calories}</Text>
                <Text style={[s.unit, { color: C.textSecondary }]}>kcal logged</Text>
              </View>
              <View style={[s.remainingPill, { backgroundColor: remaining >= 0 ? C.primaryLight : '#FCE4E4' }]}>
                <Text style={[s.remainingValue, { color: remaining >= 0 ? C.primary : C.danger }]}>
                  {Math.abs(remaining)}
                </Text>
                <Text style={[s.remainingLabel, { color: C.textSecondary }]}>
                  {remaining >= 0 ? 'left' : 'over'}
                </Text>
              </View>
            </View>

            <View style={[s.progressTrack, { backgroundColor: C.background }]}>
              <View style={[s.progressFill, { width: `${progress}%`, backgroundColor: remaining >= 0 ? C.primary : C.danger }]} />
            </View>

            <View style={s.goalRow}>
              <Text style={[s.goalLabel, { color: C.textSecondary }]}>daily goal</Text>
              <TextInput
                style={[s.goalInput, { color: C.text, borderColor: C.border, backgroundColor: C.background }]}
                value={goalDraft}
                onChangeText={setGoalDraft}
                keyboardType="number-pad"
                maxLength={5}
              />
              <TouchableOpacity style={[s.goalBtn, { backgroundColor: C.accent }]} onPress={handleSaveGoal}>
                <Text style={[s.goalBtnText, { color: C.background }]}>set</Text>
              </TouchableOpacity>
            </View>

            <View style={s.macroRow}>
              <MacroStat C={C} label="protein" current={roundMacro(summary.protein)} goal={macroGoals.protein} />
              <MacroStat C={C} label="carbs" current={roundMacro(summary.carbs)} goal={macroGoals.carbs} />
              <MacroStat C={C} label="fat" current={roundMacro(summary.fat)} goal={macroGoals.fat} />
            </View>

            <TouchableOpacity onPress={() => router.push('/macro-calculator')} activeOpacity={0.75} style={s.calcLink}>
              <Text style={[s.calcLinkText, { color: C.accent }]}>calculate my macros →</Text>
            </TouchableOpacity>

            <View style={s.macroGoalRow}>
              <Text style={[s.goalLabel, { color: C.textSecondary }]}>macro goals</Text>
              <MacroGoalInput C={C} label="P" value={macroGoalDrafts.protein} onChangeText={(v) => setMacroGoalDrafts((d) => ({ ...d, protein: v }))} />
              <MacroGoalInput C={C} label="C" value={macroGoalDrafts.carbs} onChangeText={(v) => setMacroGoalDrafts((d) => ({ ...d, carbs: v }))} />
              <MacroGoalInput C={C} label="F" value={macroGoalDrafts.fat} onChangeText={(v) => setMacroGoalDrafts((d) => ({ ...d, fat: v }))} />
              <TouchableOpacity style={[s.goalBtn, { backgroundColor: C.accent }]} onPress={handleSaveMacroGoals}>
                <Text style={[s.goalBtnText, { color: C.background }]}>set</Text>
              </TouchableOpacity>
            </View>
          </View>

          {summary.count > 0 && (
            <View style={[s.card, { backgroundColor: C.card }]}>
              <Text style={[s.cardTitle, { color: C.text }]}>meal breakdown</Text>
              <View style={s.breakdownStack}>
                {mealTotals.map((item) => {
                  const width = summary.calories > 0 ? (item.calories / summary.calories) * 100 : 0;
                  return (
                    <View
                      key={item.key}
                      style={[
                        s.stackSegment,
                        {
                          width: `${Math.max(width, item.calories > 0 ? 4 : 0)}%`,
                          backgroundColor: item.calories > 0 ? item.color : 'transparent',
                        },
                      ]}
                    />
                  );
                })}
              </View>
              {mealTotals.map((item) => (
                <View key={item.key} style={s.breakdownRow}>
                  <View style={s.breakdownLeft}>
                    <View style={[s.breakdownDot, { backgroundColor: item.color }]} />
                    <Text style={[s.breakdownLabel, { color: C.text }]}>{item.label}</Text>
                  </View>
                  <View style={[s.breakdownTrack, { backgroundColor: C.background }]}>
                    <View
                      style={[
                        s.breakdownFill,
                        { width: `${(item.calories / topMealCalories) * 100}%`, backgroundColor: item.color },
                      ]}
                    />
                  </View>
                  <Text style={[s.breakdownCalories, { color: C.textSecondary }]}>{item.calories}</Text>
                </View>
              ))}
            </View>
          )}

          {!editingId && recentFoods.length > 0 && (
            <View style={[s.card, { backgroundColor: C.card }]}>
              <View style={s.cardHeader}>
                <Text style={[s.cardTitle, { color: C.text }]}>quick repeat</Text>
                <TouchableOpacity onPress={() => setShowAllRecent(true)}>
                  <Text style={[s.linkSmall, { color: C.accent }]}>see all ({recentFoods.length}) →</Text>
                </TouchableOpacity>
              </View>
              <View style={s.repeatGrid}>
                {recentFoods.slice(0, 5).map((food, index) => (
                  <TouchableOpacity
                    key={`${food.name}-${food.calories}-${index}`}
                    style={[s.repeatChip, { backgroundColor: C.background, borderColor: C.border }]}
                    onPress={() => repeatFood(food)}
                    activeOpacity={0.75}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[s.repeatName, { color: C.text }]} numberOfLines={1}>{food.name}</Text>
                      <Text style={[s.repeatMeta, { color: C.textSecondary }]}>{food.calories} kcal</Text>
                    </View>
                    <Text style={[s.repeatPlus, { color: C.primary }]}>+</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {!editingId && savedMeals.length > 0 && (
            <View style={[s.card, { backgroundColor: C.card }]}>
              <View style={s.cardHeader}>
                <Text style={[s.cardTitle, { color: C.text }]}>saved meals</Text>
                <TouchableOpacity onPress={() => router.push('/saved-meals')}>
                  <Text style={[s.linkSmall, { color: C.accent }]}>manage →</Text>
                </TouchableOpacity>
              </View>
              <View style={s.repeatGrid}>
                {savedMeals.slice(0, 5).map((meal) => {
                  const total = meal.items.reduce((sum, i) => sum + (Number(i.calories) || 0), 0);
                  return (
                    <TouchableOpacity
                      key={meal.id}
                      style={[s.repeatChip, { backgroundColor: C.background, borderColor: C.border }]}
                      onPress={() => applyMeal(meal)}
                      activeOpacity={0.75}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[s.repeatName, { color: C.text }]} numberOfLines={1}>{meal.name}</Text>
                        <Text style={[s.repeatMeta, { color: C.textSecondary }]}>{meal.items.length} items · {total} kcal</Text>
                      </View>
                      <Text style={[s.repeatPlus, { color: C.primary }]}>+</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {!editingId && savedMeals.length === 0 && (
            <TouchableOpacity
              style={[s.saveMealBanner, { backgroundColor: C.card, borderColor: C.border }]}
              onPress={() => router.push('/saved-meals')}
              activeOpacity={0.75}
            >
              <Text style={[s.saveMealBannerText, { color: C.text }]}>save a meal template</Text>
              <Text style={[s.saveMealBannerSub, { color: C.textSecondary }]}>log multiple foods at once →</Text>
            </TouchableOpacity>
          )}

          <View style={[s.card, { backgroundColor: C.card }]}>
            <View style={s.cardHeader}>
              <Text style={[s.cardTitle, { color: C.text }]}>{editingId ? 'edit entry' : 'add food'}</Text>
              {editingId ? (
                <TouchableOpacity onPress={resetForm}>
                  <Text style={[s.cancelText, { color: C.textSecondary }]}>cancel</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={s.mealRow}>
              {MEALS.map((item) => {
                const selected = meal === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      s.mealBtn,
                      { backgroundColor: selected ? item.color : C.background, borderColor: selected ? item.color : C.border },
                    ]}
                    onPress={() => setMeal(item.key)}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.mealText, { color: selected ? '#FFFFFF' : C.textSecondary }]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput
              style={[s.input, { color: C.text, borderColor: C.border, backgroundColor: C.background }]}
              placeholder="food or meal name"
              placeholderTextColor={C.textSecondary}
              value={name}
              onChangeText={setName}
            />

            <TextInput
              style={[s.input, { color: C.text, borderColor: C.border, backgroundColor: C.background }]}
              placeholder="calories"
              placeholderTextColor={C.textSecondary}
              value={calories}
              onChangeText={setCalories}
              keyboardType="number-pad"
            />

            <Text style={[s.fieldLabel, { color: C.textSecondary }]}>macros optional</Text>
            <View style={s.macroInputs}>
              <MacroInput C={C} label="protein" value={protein} onChangeText={setProtein} />
              <MacroInput C={C} label="carbs" value={carbs} onChangeText={setCarbs} />
              <MacroInput C={C} label="fat" value={fat} onChangeText={setFat} />
            </View>

            <TextInput
              style={[s.noteInput, { color: C.text, borderColor: C.border, backgroundColor: C.background }]}
              placeholder="note"
              placeholderTextColor={C.textSecondary}
              value={note}
              onChangeText={setNote}
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: C.accent }, saving && { opacity: 0.55 }]}
              onPress={handleSaveEntry}
              disabled={saving}
              activeOpacity={0.8}
            >
              <Text style={[s.saveBtnText, { color: C.background }]}>
                {saving ? 'saving...' : editingId ? 'save changes' : 'add entry'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[s.card, { backgroundColor: C.card }]}>
            <Text style={[s.cardTitle, { color: C.text }]}>entries</Text>
            {entries.length === 0 ? (
              <Text style={[s.empty, { color: C.textSecondary }]}>no food logged for this day.</Text>
            ) : (
              MEALS.map((item) => {
                const mealEntries = entries.filter((entry) => entry.meal === item.key);
                if (!mealEntries.length) return null;
                return (
                  <View key={item.key} style={s.mealGroup}>
                    <Text style={[s.mealGroupTitle, { color: item.color }]}>{item.label}</Text>
                    {mealEntries.map((entry) => (
                      <TouchableOpacity
                        key={entry.id}
                        style={[s.entryRow, { backgroundColor: C.background }]}
                        onPress={() => openEdit(entry)}
                        onLongPress={() => confirmDelete(entry)}
                        activeOpacity={0.75}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[s.entryName, { color: C.text }]} numberOfLines={1}>{entry.name}</Text>
                          <Text style={[s.entryMeta, { color: C.textSecondary }]}>
                            P {roundMacro(entry.protein)}g  C {roundMacro(entry.carbs)}g  F {roundMacro(entry.fat)}g
                          </Text>
                        </View>
                        <View style={s.entryRight}>
                          <Text style={[s.entryCalories, { color: C.text }]}>{entry.calories}</Text>
                          <Text style={[s.entryKcal, { color: C.textSecondary }]}>kcal</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })
            )}
          </View>

          <Text style={[s.sectionLabel, { color: C.textSecondary }]}>recent</Text>
          {history.map((day) => {
            const dayProgress = goal > 0 ? Math.min(100, (day.calories / goal) * 100) : 0;
            const active = day.date === selectedDate;
            return (
              <TouchableOpacity
                key={day.date}
                style={[
                  s.historyRow,
                  { backgroundColor: C.card, borderColor: active ? C.primary : C.border },
                ]}
                onPress={() => setSelectedDate(day.date)}
                activeOpacity={0.75}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.historyDate, { color: C.text }]}>{fmtDate(day.date)}</Text>
                  <View style={[s.historyTrack, { backgroundColor: C.background }]}>
                    <View style={[s.historyFill, { width: `${dayProgress}%`, backgroundColor: C.primary }]} />
                  </View>
                </View>
                <Text style={[s.historyCalories, { color: C.text }]}>{day.calories} kcal</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showAllRecent} transparent animationType="slide" onRequestClose={() => setShowAllRecent(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: C.card }]}>
            <View style={[s.modalHeader, { borderBottomColor: C.border }]}>
              <Text style={[s.modalTitle, { color: C.text }]}>recent foods</Text>
              <TouchableOpacity onPress={() => setShowAllRecent(false)}>
                <Text style={[s.modalDone, { color: C.accent }]}>done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {recentFoods.map((food, index) => (
                <View key={`${food.name}-${food.calories}-${index}`} style={[s.modalRow, { borderBottomColor: C.border }]}>
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => { repeatFood(food); setShowAllRecent(false); }}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.modalRowName, { color: C.text }]} numberOfLines={1}>{food.name}</Text>
                    <Text style={[s.modalRowMeta, { color: C.textSecondary }]}>{food.calories} kcal · {food.meal}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleHideFood(food)}
                    hitSlop={10}
                    style={s.modalDeleteBtn}
                  >
                    <Text style={[s.modalDeleteText, { color: C.danger }]}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {recentFoods.length === 0 && (
                <Text style={[s.empty, { color: C.textSecondary, padding: 20 }]}>no recent foods.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function MacroStat({ C, label, current, goal }) {
  const hasGoal = goal > 0;
  const pct = hasGoal ? Math.min(100, (current / goal) * 100) : 0;
  const over = hasGoal && current > goal;
  return (
    <View style={[s.macroStat, { backgroundColor: C.background }]}>
      <Text style={[s.macroValue, { color: C.text }]}>{current}g</Text>
      {hasGoal && (
        <Text style={[s.macroGoalText, { color: C.textSecondary }]}>/ {goal}g</Text>
      )}
      <Text style={[s.macroLabel, { color: C.textSecondary }]}>{label}</Text>
      {hasGoal && (
        <View style={[s.macroProgressTrack, { backgroundColor: C.card }]}>
          <View style={[s.macroProgressFill, { width: `${pct}%`, backgroundColor: over ? C.danger : C.primary }]} />
        </View>
      )}
    </View>
  );
}

function MacroGoalInput({ C, label, value, onChangeText }) {
  return (
    <View style={s.macroGoalInputWrap}>
      <Text style={[s.macroGoalInputLabel, { color: C.textSecondary }]}>{label}</Text>
      <TextInput
        style={[s.macroGoalInput, { color: C.text, borderColor: C.border, backgroundColor: C.background }]}
        placeholder="0"
        placeholderTextColor={C.textSecondary}
        value={value}
        onChangeText={onChangeText}
        keyboardType="number-pad"
        maxLength={4}
      />
    </View>
  );
}

function MacroInput({ C, label, value, onChangeText }) {
  return (
    <View style={s.macroInputWrap}>
      <Text style={[s.macroInputLabel, { color: C.textSecondary }]}>{label}</Text>
      <TextInput
        style={[s.macroInput, { color: C.text, borderColor: C.border, backgroundColor: C.background }]}
        placeholder="0"
        placeholderTextColor={C.textSecondary}
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
      />
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 24, paddingTop: 60, paddingBottom: 50 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  back: { fontSize: 24, fontWeight: '800' },
  headerTitleWrap: { flex: 1 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: 0 },
  dateLabel: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  todayBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  todayText: { fontSize: 12, fontWeight: '800' },
  dateNav: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  navBtn: {
    width: 38,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: { fontSize: 17, fontWeight: '900' },
  fullDate: { flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '700' },
  summaryCard: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#172417',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 },
  kicker: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  bigNumber: { fontSize: 44, fontWeight: '900', letterSpacing: 0, marginTop: 4 },
  unit: { fontSize: 12, fontWeight: '700', marginTop: -2 },
  remainingPill: {
    minWidth: 82,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  remainingValue: { fontSize: 21, fontWeight: '900' },
  remainingLabel: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginTop: 1 },
  progressTrack: { height: 9, borderRadius: 5, overflow: 'hidden', marginTop: 18 },
  progressFill: { height: 9, borderRadius: 5 },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  goalLabel: { flex: 1, fontSize: 12, fontWeight: '800' },
  goalInput: {
    width: 86,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
  },
  goalBtn: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  goalBtnText: { fontSize: 12, fontWeight: '900' },
  macroRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  macroStat: { flex: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center', gap: 2 },
  macroValue: { fontSize: 15, fontWeight: '900' },
  macroGoalText: { fontSize: 10, fontWeight: '700' },
  macroLabel: { fontSize: 10, fontWeight: '800', marginTop: 1 },
  macroProgressTrack: { width: '85%', height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 5 },
  macroProgressFill: { height: 4, borderRadius: 2 },
  calcLink: { alignSelf: 'flex-end', marginTop: 10, marginBottom: 2 },
  calcLinkText: { fontSize: 12, fontWeight: '900' },
  macroGoalRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  macroGoalInputWrap: { alignItems: 'center', gap: 3 },
  macroGoalInputLabel: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  macroGoalInput: {
    width: 52,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 7,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '800',
  },
  breakdownStack: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    flexDirection: 'row',
    marginTop: 14,
    marginBottom: 14,
  },
  stackSegment: { height: 12 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 9 },
  breakdownLeft: { width: 82, flexDirection: 'row', alignItems: 'center', gap: 7 },
  breakdownDot: { width: 9, height: 9, borderRadius: 5 },
  breakdownLabel: { fontSize: 12, fontWeight: '900' },
  breakdownTrack: { flex: 1, height: 7, borderRadius: 4, overflow: 'hidden' },
  breakdownFill: { height: 7, borderRadius: 4 },
  breakdownCalories: { width: 44, textAlign: 'right', fontSize: 11, fontWeight: '900' },
  repeatGrid: { gap: 8, marginTop: 12 },
  repeatChip: {
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 13,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  repeatName: { fontSize: 13, fontWeight: '900' },
  repeatMeta: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  repeatPlus: { fontSize: 22, fontWeight: '800', lineHeight: 24 },
  card: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#172417',
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  cardTitle: { fontSize: 17, fontWeight: '900', letterSpacing: 0 },
  cancelText: { fontSize: 12, fontWeight: '800' },
  mealRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  mealBtn: {
    minWidth: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  mealText: { fontSize: 12, fontWeight: '900' },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 10,
  },
  fieldLabel: { fontSize: 11, fontWeight: '800', marginBottom: 8, marginTop: 2 },
  macroInputs: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  macroInputWrap: { flex: 1, gap: 5 },
  macroInputLabel: { fontSize: 10, fontWeight: '800' },
  macroInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '800',
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    fontSize: 14,
    minHeight: 64,
    lineHeight: 20,
    marginBottom: 12,
  },
  saveBtn: { borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '800', letterSpacing: 0 },
  empty: { fontSize: 13, lineHeight: 19, paddingTop: 12 },
  mealGroup: { marginTop: 12 },
  mealGroupTitle: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginBottom: 8 },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 13,
    marginBottom: 8,
  },
  entryName: { fontSize: 14, fontWeight: '900' },
  entryMeta: { fontSize: 11, fontWeight: '700', marginTop: 4 },
  entryRight: { alignItems: 'flex-end', minWidth: 56 },
  entryCalories: { fontSize: 18, fontWeight: '900' },
  entryKcal: { fontSize: 10, fontWeight: '800', marginTop: -1 },
  linkSmall: { fontSize: 12, fontWeight: '900' },
  saveMealBanner: {
    borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 16,
    borderStyle: 'dashed',
  },
  saveMealBannerText: { fontSize: 14, fontWeight: '900' },
  saveMealBannerSub: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%', paddingBottom: 34 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: '900' },
  modalDone: { fontSize: 14, fontWeight: '900' },
  modalRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1 },
  modalRowName: { fontSize: 14, fontWeight: '800' },
  modalRowMeta: { fontSize: 11, fontWeight: '600', marginTop: 3 },
  modalDeleteBtn: { paddingLeft: 16 },
  modalDeleteText: { fontSize: 16, fontWeight: '900' },
  sectionLabel: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginBottom: 10 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: 16,
    padding: 13,
    marginBottom: 8,
  },
  historyDate: { fontSize: 13, fontWeight: '900', marginBottom: 8 },
  historyTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  historyFill: { height: 5, borderRadius: 3 },
  historyCalories: { fontSize: 13, fontWeight: '900' },
});
