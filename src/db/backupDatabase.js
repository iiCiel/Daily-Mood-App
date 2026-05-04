import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase, saveEntry } from './database';
import { saveSleep } from './sleepDatabase';
import { importCalorieEntry } from './calorieDatabase';
import { importHabitCompletion } from './habitDatabase';
import { saveWeightEntry } from './weightDatabase';

const SAVED_MEALS_KEY = 'saved_meals_v1';
const DEFAULT_PROJECT_ID = 'default-project';
const DEFAULT_LIST_ID = 'focus-list';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function parseArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function intFlag(value) {
  return value ? 1 : 0;
}

function textOrNull(value) {
  const text = String(value || '').trim();
  return text || null;
}

function count(counts, key) {
  counts[key] = (counts[key] || 0) + 1;
}

async function importProjects(db, projects, counts) {
  for (const project of asArray(projects)) {
    if (!project?.id || !textOrNull(project.name)) continue;
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO projects
        (id, name, color, status, notes, archived, google_calendar_id, sync_status, last_synced_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        color = excluded.color,
        status = excluded.status,
        notes = excluded.notes,
        archived = excluded.archived,
        google_calendar_id = excluded.google_calendar_id,
        sync_status = 'pending',
        updated_at = excluded.updated_at`,
      [
        project.id,
        String(project.name).trim(),
        project.color || '#4A7856',
        project.status || 'active',
        project.notes || null,
        intFlag(project.archived),
        project.google_calendar_id || null,
        project.sync_status || 'local',
        project.last_synced_at || null,
        project.created_at || now,
        project.updated_at || now,
      ]
    );
    count(counts, 'projects');
  }
}

async function importTaskLists(db, taskLists, counts) {
  for (const list of asArray(taskLists)) {
    if (!list?.id || !textOrNull(list.title)) continue;
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO task_lists
        (id, project_id, title, color, position, archived, google_task_list_id, sync_status, last_synced_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        title = excluded.title,
        color = excluded.color,
        position = excluded.position,
        archived = excluded.archived,
        google_task_list_id = excluded.google_task_list_id,
        sync_status = 'pending',
        updated_at = excluded.updated_at`,
      [
        list.id,
        list.project_id || DEFAULT_PROJECT_ID,
        String(list.title).trim(),
        list.color || '#4A7856',
        Number.isFinite(Number(list.position)) ? Number(list.position) : 0,
        intFlag(list.archived),
        list.google_task_list_id || null,
        list.sync_status || 'local',
        list.last_synced_at || null,
        list.created_at || now,
        list.updated_at || now,
      ]
    );
    count(counts, 'taskLists');
  }
}

async function importTasks(db, tasks, counts) {
  for (const task of asArray(tasks)) {
    if (!task?.id || !textOrNull(task.title)) continue;
    const now = new Date().toISOString();
    const status = ['todo', 'doing', 'done'].includes(task.status) ? task.status : (task.completed ? 'done' : 'todo');
    await db.runAsync(
      `INSERT INTO tasks
        (id, project_id, list_id, title, notes, due_date, completed, status, target_pomodoros, position,
         google_task_id, sync_status, last_synced_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        list_id = excluded.list_id,
        title = excluded.title,
        notes = excluded.notes,
        due_date = excluded.due_date,
        completed = excluded.completed,
        status = excluded.status,
        target_pomodoros = excluded.target_pomodoros,
        position = excluded.position,
        google_task_id = excluded.google_task_id,
        sync_status = 'pending',
        updated_at = excluded.updated_at`,
      [
        task.id,
        task.project_id || DEFAULT_PROJECT_ID,
        task.list_id || DEFAULT_LIST_ID,
        String(task.title).trim(),
        task.notes || null,
        task.due_date || null,
        status === 'done' ? 1 : 0,
        status,
        Math.max(1, parseInt(task.target_pomodoros, 10) || 1),
        Number.isFinite(Number(task.position)) ? Number(task.position) : 0,
        task.google_task_id || null,
        task.sync_status || 'local',
        task.last_synced_at || null,
        task.created_at || now,
        task.updated_at || now,
      ]
    );
    count(counts, 'tasks');
  }
}

async function importGoals(db, goals, counts) {
  for (const goal of asArray(goals)) {
    if (!goal?.id || !textOrNull(goal.title)) continue;
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO goals
        (id, title, category, target_value, current_value, unit, deadline, completed, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        category = excluded.category,
        target_value = excluded.target_value,
        current_value = excluded.current_value,
        unit = excluded.unit,
        deadline = excluded.deadline,
        completed = excluded.completed,
        updated_at = excluded.updated_at`,
      [
        goal.id,
        String(goal.title).trim(),
        goal.category || 'personal',
        numberOrNull(goal.target_value),
        numberOrNull(goal.current_value) || 0,
        goal.unit || null,
        goal.deadline || null,
        intFlag(goal.completed),
        goal.created_at || now,
        goal.updated_at || now,
      ]
    );
    count(counts, 'goals');
  }
}

async function importNotes(db, notes, counts) {
  for (const note of asArray(notes)) {
    if (!note?.id) continue;
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO notes (id, title, body, pinned, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        body = excluded.body,
        pinned = excluded.pinned,
        updated_at = excluded.updated_at`,
      [
        note.id,
        note.title || '',
        note.body || '',
        intFlag(note.pinned),
        note.created_at || now,
        note.updated_at || now,
      ]
    );
    count(counts, 'notes');
  }
}

async function importPlannerEntries(db, plannerEntries, counts) {
  for (const entry of asArray(plannerEntries)) {
    if (!entry?.date) continue;
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO planner_entries
        (id, date, intention, priorities, evening_note, evening_rating, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
        intention = excluded.intention,
        priorities = excluded.priorities,
        evening_note = excluded.evening_note,
        evening_rating = excluded.evening_rating,
        updated_at = excluded.updated_at`,
      [
        entry.id || genId(),
        entry.date,
        entry.intention || null,
        JSON.stringify(parseArray(entry.priorities)),
        entry.evening_note || null,
        numberOrNull(entry.evening_rating),
        entry.created_at || now,
        entry.updated_at || now,
      ]
    );
    count(counts, 'planner');
  }
}

async function importFocusSessions(db, sessions, counts) {
  for (const session of asArray(sessions)) {
    if (!session?.date || !session.started_at) continue;
    await db.runAsync(
      `INSERT INTO pomodoro_sessions (id, task_id, duration, completed, date, started_at, ended_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        task_id = excluded.task_id,
        duration = excluded.duration,
        completed = excluded.completed,
        date = excluded.date,
        started_at = excluded.started_at,
        ended_at = excluded.ended_at`,
      [
        session.id || genId(),
        session.task_id || null,
        Math.max(1, parseInt(session.duration, 10) || 25),
        intFlag(session.completed),
        session.date,
        session.started_at,
        session.ended_at || null,
      ]
    );
    count(counts, 'focusSessions');
  }
}

async function importSavedMeals(savedMeals, counts) {
  const incoming = asArray(savedMeals).filter((meal) => meal?.id && textOrNull(meal.name));
  if (!incoming.length) return;

  let existing = [];
  try {
    const raw = await AsyncStorage.getItem(SAVED_MEALS_KEY);
    existing = raw ? JSON.parse(raw) : [];
  } catch {}

  const merged = new Map(asArray(existing).map((meal) => [meal.id, meal]));
  for (const meal of incoming) {
    merged.set(meal.id, {
      id: meal.id,
      name: String(meal.name).trim(),
      items: asArray(meal.items),
      created_at: meal.created_at || new Date().toISOString(),
    });
    count(counts, 'savedMeals');
  }
  await AsyncStorage.setItem(SAVED_MEALS_KEY, JSON.stringify([...merged.values()]));
}

export async function importBackup(backup) {
  if (!backup || typeof backup !== 'object') {
    throw new Error('not a valid backup file');
  }

  const db = await getDatabase();
  const counts = {};

  await importProjects(db, backup.projects, counts);
  await importTaskLists(db, backup.task_lists, counts);
  await importTasks(db, backup.tasks, counts);

  for (const entry of asArray(backup.mood)) {
    if (!entry?.date || !entry.mood) continue;
    await saveEntry(
      entry.date,
      Number(entry.mood),
      entry.note || '',
      [],
      parseArray(entry.tags),
      parseArray(entry.gratitude)
    );
    count(counts, 'mood');
  }

  for (const entry of asArray(backup.sleep)) {
    if (!entry?.date) continue;
    await saveSleep(entry.date, entry.bedtime || null, entry.wake_time || null, numberOrNull(entry.quality), entry.note || '');
    count(counts, 'sleep');
  }

  for (const entry of asArray(backup.calories)) {
    if (!entry?.date || !textOrNull(entry.name)) continue;
    await importCalorieEntry({
      date: entry.date,
      meal: entry.meal,
      name: entry.name,
      calories: numberOrNull(entry.calories) || 0,
      protein: numberOrNull(entry.protein),
      carbs: numberOrNull(entry.carbs),
      fat: numberOrNull(entry.fat),
      note: entry.note,
    });
    count(counts, 'calories');
  }

  for (const entry of asArray(backup.habits)) {
    if (!entry?.date || !textOrNull(entry.title)) continue;
    await importHabitCompletion(entry.title, entry.emoji, entry.date);
    count(counts, 'habits');
  }

  for (const entry of asArray(backup.weight)) {
    if (!entry?.date || !Number.isFinite(Number(entry.weight))) continue;
    await saveWeightEntry({
      date: entry.date,
      weight: Number(entry.weight),
      unit: entry.unit === 'lbs' ? 'lbs' : 'kg',
      note: entry.note || '',
    });
    count(counts, 'weight');
  }

  await importGoals(db, backup.goals, counts);
  await importNotes(db, backup.notes, counts);
  await importPlannerEntries(db, backup.planner, counts);
  await importFocusSessions(db, backup.focus_sessions, counts);
  await importSavedMeals(backup.saved_meals, counts);

  return counts;
}
