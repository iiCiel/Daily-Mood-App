import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase } from './database';

const CALORIE_GOAL_KEY = 'calorie_goal';
const MACRO_GOALS_KEY = 'macro_goals';
const HIDDEN_FOODS_KEY = 'hidden_recent_foods';
const DEFAULT_CALORIE_GOAL = 2000;
const VALID_MEALS = new Set(['breakfast', 'lunch', 'dinner', 'snack']);

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function cleanNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function cleanMeal(meal) {
  return VALID_MEALS.has(meal) ? meal : 'snack';
}

function dayString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export async function getCalorieGoal() {
  const stored = await AsyncStorage.getItem(CALORIE_GOAL_KEY);
  const goal = Number(stored);
  return Number.isFinite(goal) && goal > 0 ? Math.round(goal) : DEFAULT_CALORIE_GOAL;
}

export async function getMacroGoals() {
  try {
    const stored = await AsyncStorage.getItem(MACRO_GOALS_KEY);
    if (!stored) return { protein: 0, carbs: 0, fat: 0 };
    const p = JSON.parse(stored);
    return {
      protein: Math.max(0, Number(p.protein) || 0),
      carbs: Math.max(0, Number(p.carbs) || 0),
      fat: Math.max(0, Number(p.fat) || 0),
    };
  } catch {
    return { protein: 0, carbs: 0, fat: 0 };
  }
}

export async function saveMacroGoals({ protein, carbs, fat }) {
  const goals = {
    protein: Math.max(0, Math.round(Number(protein) || 0)),
    carbs: Math.max(0, Math.round(Number(carbs) || 0)),
    fat: Math.max(0, Math.round(Number(fat) || 0)),
  };
  await AsyncStorage.setItem(MACRO_GOALS_KEY, JSON.stringify(goals));
  return goals;
}

export async function saveCalorieGoal(goal) {
  const nextGoal = Math.max(1, Math.round(Number(goal) || DEFAULT_CALORIE_GOAL));
  await AsyncStorage.setItem(CALORIE_GOAL_KEY, String(nextGoal));
  return nextGoal;
}

export async function getCalorieEntries(date) {
  const db = await getDatabase();
  return db.getAllAsync(
    'SELECT * FROM calorie_entries WHERE date = ? ORDER BY created_at DESC',
    [date]
  );
}

export async function saveCalorieEntry(entry) {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const id = entry.id || genId();
  const values = [
    entry.date,
    cleanMeal(entry.meal),
    String(entry.name || '').trim(),
    Math.max(0, Math.round(Number(entry.calories) || 0)),
    cleanNumber(entry.protein),
    cleanNumber(entry.carbs),
    cleanNumber(entry.fat),
    String(entry.note || '').trim() || null,
    now,
    id,
  ];

  if (entry.id) {
    await db.runAsync(
      `UPDATE calorie_entries
       SET date = ?, meal = ?, name = ?, calories = ?, protein = ?, carbs = ?, fat = ?, note = ?, updated_at = ?
       WHERE id = ?`,
      values
    );
    return id;
  }

  await db.runAsync(
    `INSERT INTO calorie_entries
     (id, date, meal, name, calories, protein, carbs, fat, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, ...values.slice(0, 8), now, now]
  );
  return id;
}

export async function deleteCalorieEntry(id) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM calorie_entries WHERE id = ?', [id]);
}

export async function getCalorieDaySummary(date) {
  const db = await getDatabase();
  const row = await db.getFirstAsync(
    `SELECT
      COUNT(*) as count,
      COALESCE(SUM(calories), 0) as calories,
      COALESCE(SUM(protein), 0) as protein,
      COALESCE(SUM(carbs), 0) as carbs,
      COALESCE(SUM(fat), 0) as fat
     FROM calorie_entries
     WHERE date = ?`,
    [date]
  );
  return {
    date,
    count: row?.count || 0,
    calories: row?.calories || 0,
    protein: row?.protein || 0,
    carbs: row?.carbs || 0,
    fat: row?.fat || 0,
  };
}

export async function getRecentCalorieSummaries(days = 14) {
  const db = await getDatabase();
  const dates = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(dayString(d));
  }

  const rows = await db.getAllAsync(
    `SELECT
      date,
      COUNT(*) as count,
      COALESCE(SUM(calories), 0) as calories,
      COALESCE(SUM(protein), 0) as protein,
      COALESCE(SUM(carbs), 0) as carbs,
      COALESCE(SUM(fat), 0) as fat
     FROM calorie_entries
     WHERE date IN (${dates.map(() => '?').join(',')})
     GROUP BY date`,
    dates
  );

  const byDate = {};
  for (const row of rows) byDate[row.date] = row;

  return dates.map((date) => ({
    date,
    count: byDate[date]?.count || 0,
    calories: byDate[date]?.calories || 0,
    protein: byDate[date]?.protein || 0,
    carbs: byDate[date]?.carbs || 0,
    fat: byDate[date]?.fat || 0,
  }));
}

async function getHiddenFoods() {
  try {
    const raw = await AsyncStorage.getItem(HIDDEN_FOODS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export async function hideRecentFood(name, calories) {
  const hidden = await getHiddenFoods();
  hidden.add(`${String(name).trim().toLowerCase()}|${calories}`);
  await AsyncStorage.setItem(HIDDEN_FOODS_KEY, JSON.stringify([...hidden]));
}

export async function getRecentFoods(limit = 8) {
  const db = await getDatabase();
  const hidden = await getHiddenFoods();
  const rows = await db.getAllAsync(
    `SELECT name, meal, calories, protein, carbs, fat, note, updated_at
     FROM calorie_entries
     ORDER BY updated_at DESC
     LIMIT 120`
  );

  const foods = [];
  const seen = new Set();
  for (const row of rows) {
    const key = `${String(row.name || '').trim().toLowerCase()}|${row.calories}`;
    if (!row.name || seen.has(key) || hidden.has(key)) continue;
    seen.add(key);
    foods.push(row);
    if (foods.length >= limit) break;
  }
  return foods;
}

export async function importCalorieEntry({ date, meal, name, calories, protein, carbs, fat, note }) {
  const db = await getDatabase();
  const existing = await db.getFirstAsync(
    'SELECT id FROM calorie_entries WHERE date = ? AND meal = ? AND name = ? AND calories = ?',
    [date, cleanMeal(meal), String(name || '').trim(), Math.round(Number(calories) || 0)]
  );
  if (existing) return;
  const id = genId();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO calorie_entries (id, date, meal, name, calories, protein, carbs, fat, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, date, cleanMeal(meal), String(name || '').trim(),
     Math.round(Number(calories) || 0),
     cleanNumber(protein), cleanNumber(carbs), cleanNumber(fat),
     String(note || '').trim() || null, now, now]
  );
}

export async function getAllCalorieEntries(limit = 5000) {
  const db = await getDatabase();
  return db.getAllAsync(
    'SELECT * FROM calorie_entries ORDER BY date DESC, created_at DESC LIMIT ?',
    [limit]
  );
}

export async function getCalorieInsights(days = 30) {
  const summaries = await getRecentCalorieSummaries(days);
  const goal = await getCalorieGoal();
  const logged = summaries.filter((day) => day.count > 0);
  if (!logged.length) return null;

  const sum = (rows, key) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
  const last7 = summaries.slice(0, 7);
  const logged7 = last7.filter((day) => day.count > 0);
  const calories30 = sum(logged, 'calories');
  const calories7 = sum(logged7, 'calories');

  const db = await getDatabase();
  const since = summaries[summaries.length - 1]?.date;
  const mealRows = since ? await db.getAllAsync(
    `SELECT
      meal,
      COALESCE(SUM(calories), 0) as calories,
      COALESCE(SUM(protein), 0) as protein,
      COALESCE(SUM(carbs), 0) as carbs,
      COALESCE(SUM(fat), 0) as fat
     FROM calorie_entries
     WHERE date >= ?
     GROUP BY meal`,
    [since]
  ) : [];

  const mealTotals = {};
  for (const row of mealRows) {
    mealTotals[row.meal || 'snack'] = {
      calories: row.calories || 0,
      protein: row.protein || 0,
      carbs: row.carbs || 0,
      fat: row.fat || 0,
    };
  }

  return {
    goal,
    days,
    loggedDays: logged.length,
    logged7: logged7.length,
    avgCalories: Math.round(calories30 / logged.length),
    avgCalories7: logged7.length ? Math.round(calories7 / logged7.length) : 0,
    avgProtein: Math.round((sum(logged, 'protein') / logged.length) * 10) / 10,
    avgCarbs: Math.round((sum(logged, 'carbs') / logged.length) * 10) / 10,
    avgFat: Math.round((sum(logged, 'fat') / logged.length) * 10) / 10,
    goalDays: logged.filter((day) => day.calories <= goal).length,
    overGoalDays: logged.filter((day) => day.calories > goal).length,
    recent: summaries.slice(0, 14).reverse(),
    mealTotals,
  };
}
