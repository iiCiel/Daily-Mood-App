import AsyncStorage from '@react-native-async-storage/async-storage';
// `/legacy` entry: expo-file-system v19's main entry dropped StorageAccessFramework.
import * as FileSystem from 'expo-file-system/legacy';

import { getEntries } from '../db/database';
import { getGoals } from '../db/goalsDatabase';
import { getNotes } from '../db/notesDatabase';
import { getRecentSleep } from '../db/sleepDatabase';
import { getAllCalorieEntries } from '../db/calorieDatabase';
import { getAllHabitCompletions, getAllHabitsForBackup } from '../db/habitDatabase';
import { getWeightEntries } from '../db/weightDatabase';
import { getAllWorkoutData } from '../db/workoutDatabase';
import {
  getAllPlannerEntries, getAllPlanningTasksForBackup,
  getAllProjectsForBackup, getAllTaskListsForBackup,
} from '../db/plannerDatabase';
import { getAllFocusSessions } from '../db/focusDatabase';
import { getSavedMeals } from '../db/savedMealsDatabase';

export const BACKUP_FOLDER_KEY = 'backup_folder_uri';
export const BACKUP_LAST_KEY = 'backup_last_run';
export const BACKUP_LAST_INFO_KEY = 'backup_last_info';
const KEEP_FILES = 14;

/** Single source of truth for what a backup contains. */
export async function buildBackupPayload() {
  const [
    moodEntries, sleepEntries, calorieEntries, habitCompletions, habitDefinitions, weightEntries,
    goals, notes, plannerEntries, focusSessions, tasks, projects, taskLists, savedMeals, workouts,
  ] = await Promise.all([
    getEntries(10000), getRecentSleep(3650), getAllCalorieEntries(), getAllHabitCompletions(),
    getAllHabitsForBackup(), getWeightEntries(3650), getGoals(), getNotes(),
    getAllPlannerEntries(), getAllFocusSessions(), getAllPlanningTasksForBackup(),
    getAllProjectsForBackup(), getAllTaskListsForBackup(), getSavedMeals(), getAllWorkoutData(),
  ]);

  return {
    app: 'Daily Mood',
    exported_at: new Date().toISOString(),
    version: 5,
    photo_note: 'Photos stay local to this device and are not embedded in this backup.',
    mood: moodEntries,
    sleep: sleepEntries,
    calories: calorieEntries,
    habits: habitCompletions,
    habit_definitions: habitDefinitions,
    weight: weightEntries,
    goals,
    notes,
    planner: plannerEntries,
    focus_sessions: focusSessions,
    tasks,
    projects,
    task_lists: taskLists,
    saved_meals: savedMeals,
    workouts,
  };
}

/** Count records per section, for verification and for showing the user. */
export function countRecords(payload) {
  let total = 0;
  for (const value of Object.values(payload || {})) {
    if (Array.isArray(value)) total += value.length;
    else if (value && typeof value === 'object') {
      for (const inner of Object.values(value)) if (Array.isArray(inner)) total += inner.length;
    }
  }
  return total;
}

/**
 * Write a backup and then READ IT BACK and re-parse it before reporting success.
 * A backup that was never verified is not a backup — that assumption is exactly
 * what lost data before (a truncated clipboard export reported success).
 */
export async function writeVerifiedBackup(dirUri, { prefix = 'daily_mood_backup' } = {}) {
  if (!FileSystem.StorageAccessFramework) throw new Error('storage access not available on this platform');

  const payload = await buildBackupPayload();
  const json = JSON.stringify(payload, null, 2);
  const expected = countRecords(payload);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const fileName = `${prefix}_${stamp}.json`;

  const uri = await FileSystem.StorageAccessFramework.createFileAsync(dirUri, fileName, 'application/json');
  await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });

  // Verify: read back, parse, and confirm the record count survived the round trip.
  const readBack = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
  if (readBack.length !== json.length) {
    throw new Error(`verification failed: wrote ${json.length} chars but read back ${readBack.length}`);
  }
  let reparsed;
  try {
    reparsed = JSON.parse(readBack);
  } catch (err) {
    throw new Error(`verification failed: file on disk is not valid JSON (${err.message})`);
  }
  const actual = countRecords(reparsed);
  if (actual !== expected) {
    throw new Error(`verification failed: expected ${expected} records, file has ${actual}`);
  }

  const info = { fileName, records: actual, bytes: json.length, at: new Date().toISOString() };
  await AsyncStorage.setItem(BACKUP_LAST_INFO_KEY, JSON.stringify(info));
  await pruneOldBackups(dirUri, prefix);
  return info;
}

/** Keep the folder from growing without bound; retain the newest KEEP_FILES. */
async function pruneOldBackups(dirUri, prefix) {
  try {
    const files = await FileSystem.StorageAccessFramework.readDirectoryAsync(dirUri);
    const ours = files
      .filter((u) => decodeURIComponent(u).split('/').pop()?.startsWith(prefix))
      .sort((a, b) => decodeURIComponent(b).localeCompare(decodeURIComponent(a)));
    for (const old of ours.slice(KEEP_FILES)) {
      try { await FileSystem.deleteAsync(old, { idempotent: true }); } catch {}
    }
  } catch {}
}

export async function getBackupFolder() {
  return AsyncStorage.getItem(BACKUP_FOLDER_KEY);
}

export async function setBackupFolder(uri) {
  if (uri) await AsyncStorage.setItem(BACKUP_FOLDER_KEY, uri);
  else await AsyncStorage.multiRemove([BACKUP_FOLDER_KEY, BACKUP_LAST_KEY, BACKUP_LAST_INFO_KEY]);
}

export async function getLastBackupInfo() {
  try {
    const raw = await AsyncStorage.getItem(BACKUP_LAST_INFO_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/** Let the user pick the folder automatic backups are written to. */
export async function chooseBackupFolder() {
  if (!FileSystem.StorageAccessFramework) throw new Error('storage access not available on this platform');
  const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permissions.granted) return null;
  await setBackupFolder(permissions.directoryUri);
  return permissions.directoryUri;
}

/**
 * Run at most once per calendar day, on app start. Silent on success; silent on
 * failure too (never block app launch) but records the error for Settings to show.
 */
export async function runAutoBackupIfDue() {
  try {
    const dirUri = await AsyncStorage.getItem(BACKUP_FOLDER_KEY);
    if (!dirUri) return { skipped: 'no-folder' };

    const today = new Date().toISOString().slice(0, 10);
    const last = await AsyncStorage.getItem(BACKUP_LAST_KEY);
    if (last === today) return { skipped: 'already-today' };

    const info = await writeVerifiedBackup(dirUri, { prefix: 'daily_mood_auto' });
    await AsyncStorage.setItem(BACKUP_LAST_KEY, today);
    return { ok: true, info };
  } catch (err) {
    // Most likely cause: the user revoked folder access or deleted the folder.
    try {
      await AsyncStorage.setItem(
        BACKUP_LAST_INFO_KEY,
        JSON.stringify({ error: String(err?.message || err), at: new Date().toISOString() })
      );
    } catch {}
    return { error: String(err?.message || err) };
  }
}
