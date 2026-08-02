import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase } from './database';

const UNIT_KEY = 'workout_weight_unit';
const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

export async function getWorkoutUnit() {
  return (await AsyncStorage.getItem(UNIT_KEY)) === 'lbs' ? 'lbs' : 'kg';
}

export async function saveWorkoutUnit(unit) {
  await AsyncStorage.setItem(UNIT_KEY, unit === 'lbs' ? 'lbs' : 'kg');
}

export async function getRoutines() {
  const db = await getDatabase();
  return db.getAllAsync(`SELECT r.*, COUNT(e.id) exercise_count
    FROM workout_routines r LEFT JOIN workout_routine_exercises e ON e.routine_id = r.id
    GROUP BY r.id ORDER BY r.updated_at DESC`);
}

export async function getRoutine(routineId) {
  const db = await getDatabase();
  const routine = await db.getFirstAsync('SELECT * FROM workout_routines WHERE id = ?', [routineId]);
  if (!routine) return null;
  const exercises = await db.getAllAsync(
    'SELECT * FROM workout_routine_exercises WHERE routine_id = ? ORDER BY position', [routineId]
  );
  return { ...routine, exercises };
}

export async function saveRoutine({ id: routineId, name, exercises }) {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const nextId = routineId || id();
  await db.runAsync(
    `INSERT INTO workout_routines (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`,
    [nextId, name.trim(), now, now]
  );
  await db.runAsync('DELETE FROM workout_routine_exercises WHERE routine_id = ?', [nextId]);
  for (let position = 0; position < exercises.length; position++) {
    const e = exercises[position];
    await db.runAsync(
      `INSERT INTO workout_routine_exercises
       (id, routine_id, exercise_id, name, muscle, position, target_sets, target_reps, target_weight)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id(), nextId, e.exercise_id, e.name, e.muscle, position,
       Math.max(1, Number(e.target_sets) || 3), Math.max(1, Number(e.target_reps) || 8),
       Math.max(0, Number(e.target_weight) || 0)]
    );
  }
  return nextId;
}

export async function deleteRoutine(routineId) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM workout_routines WHERE id = ?', [routineId]);
}

export async function getActiveWorkout() {
  const db = await getDatabase();
  return db.getFirstAsync("SELECT * FROM workout_sessions WHERE status = 'active' ORDER BY started_at DESC LIMIT 1");
}

async function getPreviousPerformance(exerciseId, limit) {
  const db = await getDatabase();
  return db.getAllAsync(
    `SELECT ws.weight, ws.reps FROM workout_sets ws
     JOIN workout_session_exercises we ON we.id = ws.session_exercise_id
     JOIN workout_sessions w ON w.id = we.session_id
     WHERE we.exercise_id = ? AND w.status = 'completed' AND ws.completed = 1
     ORDER BY w.ended_at DESC, ws.position LIMIT ?`,
    [exerciseId, limit]
  );
}

export async function startWorkout(routineId = null) {
  const db = await getDatabase();
  const existing = await getActiveWorkout();
  if (existing) return existing.id;
  const routine = routineId ? await getRoutine(routineId) : null;
  const sessionId = id();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, routine_id, name, status, started_at, created_at, updated_at)
     VALUES (?, ?, ?, 'active', ?, ?, ?)`,
    [sessionId, routine?.id || null, routine?.name || 'Empty Workout', now, now, now]
  );
  for (const [position, e] of (routine?.exercises || []).entries()) {
    const sessionExerciseId = id();
    await db.runAsync(
      `INSERT INTO workout_session_exercises (id, session_id, exercise_id, name, muscle, position)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sessionExerciseId, sessionId, e.exercise_id, e.name, e.muscle, position]
    );
    const previous = await getPreviousPerformance(e.exercise_id, e.target_sets);
    for (let setPosition = 0; setPosition < e.target_sets; setPosition++) {
      const weight = previous[setPosition]?.weight ?? e.target_weight;
      const reps = previous[setPosition]?.reps ?? e.target_reps;
      await db.runAsync(
        `INSERT INTO workout_sets (id, session_exercise_id, position, weight, reps, prev_weight, prev_reps, completed)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        [id(), sessionExerciseId, setPosition, weight, reps,
         previous[setPosition]?.weight ?? 0, previous[setPosition]?.reps ?? 0]
      );
    }
  }
  return sessionId;
}

export async function getWorkout(sessionId) {
  const db = await getDatabase();
  const workout = await db.getFirstAsync('SELECT * FROM workout_sessions WHERE id = ?', [sessionId]);
  if (!workout) return null;
  const exercises = await db.getAllAsync(
    'SELECT * FROM workout_session_exercises WHERE session_id = ? ORDER BY position', [sessionId]
  );
  for (const exercise of exercises) {
    exercise.sets = await db.getAllAsync(
      'SELECT * FROM workout_sets WHERE session_exercise_id = ? ORDER BY position', [exercise.id]
    );
  }
  return { ...workout, exercises };
}

export async function addWorkoutExercise(sessionId, exercise) {
  const db = await getDatabase();
  const row = await db.getFirstAsync(
    'SELECT COALESCE(MAX(position), -1) + 1 position FROM workout_session_exercises WHERE session_id = ?', [sessionId]
  );
  const exerciseId = id();
  await db.runAsync(
    `INSERT INTO workout_session_exercises (id, session_id, exercise_id, name, muscle, position)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [exerciseId, sessionId, exercise.id, exercise.name, exercise.muscle, row?.position || 0]
  );
  const previous = await getPreviousPerformance(exercise.id, 3);
  for (let i = 0; i < 3; i++) {
    const weight = previous[i]?.weight ?? 0;
    const reps = previous[i]?.reps ?? 8;
    await db.runAsync(
      `INSERT INTO workout_sets (id, session_exercise_id, position, weight, reps, prev_weight, prev_reps, completed)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [id(), exerciseId, i, weight, reps, previous[i]?.weight ?? 0, previous[i]?.reps ?? 0]
    );
  }
}

export async function removeWorkoutExercise(exerciseId) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM workout_session_exercises WHERE id = ?', [exerciseId]);
}

export async function addWorkoutSet(exerciseId, weight = 0, reps = 8) {
  const db = await getDatabase();
  const row = await db.getFirstAsync(
    'SELECT COALESCE(MAX(position), -1) + 1 position FROM workout_sets WHERE session_exercise_id = ?', [exerciseId]
  );
  const w = Number(weight) || 0;
  const r = Number(reps) || 0;
  await db.runAsync(
    `INSERT INTO workout_sets (id, session_exercise_id, position, weight, reps, prev_weight, prev_reps, completed)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    [id(), exerciseId, row?.position || 0, w, r, w, r]
  );
}

export async function updateWorkoutSet(setId, patch) {
  const db = await getDatabase();
  const fields = [];
  const values = [];
  for (const key of ['weight', 'reps', 'completed']) {
    if (patch[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(key === 'completed' ? (patch[key] ? 1 : 0) : Math.max(0, Number(patch[key]) || 0));
    }
  }
  if (!fields.length) return;
  await db.runAsync(`UPDATE workout_sets SET ${fields.join(', ')} WHERE id = ?`, [...values, setId]);
}

export async function deleteWorkoutSet(setId) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM workout_sets WHERE id = ?', [setId]);
}

export async function finishWorkout(sessionId) {
  const db = await getDatabase();
  const summary = await db.getFirstAsync(
    `SELECT COUNT(ws.id) total_sets,
      COALESCE(SUM(ws.weight * ws.reps), 0) total_volume
     FROM workout_sets ws JOIN workout_session_exercises we ON we.id = ws.session_exercise_id
     WHERE we.session_id = ? AND ws.completed = 1`, [sessionId]
  );
  const workout = await db.getFirstAsync('SELECT started_at FROM workout_sessions WHERE id = ?', [sessionId]);
  const ended = new Date();
  const duration = Math.max(1, Math.round((ended - new Date(workout.started_at)) / 60000));
  await db.runAsync(
    `UPDATE workout_sessions SET status = 'completed', ended_at = ?, duration_minutes = ?,
     total_sets = ?, total_volume = ?, updated_at = ? WHERE id = ?`,
    [ended.toISOString(), duration, summary?.total_sets || 0, summary?.total_volume || 0, ended.toISOString(), sessionId]
  );
}

export async function discardWorkout(sessionId) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM workout_sessions WHERE id = ?', [sessionId]);
}

export async function getWorkoutHistory(limit = 20) {
  const db = await getDatabase();
  return db.getAllAsync(
    "SELECT * FROM workout_sessions WHERE status = 'completed' ORDER BY ended_at DESC LIMIT ?", [limit]
  );
}

export async function getWorkoutStats() {
  const db = await getDatabase();
  const total = await db.getFirstAsync(
    `SELECT COUNT(*) workouts, COALESCE(SUM(total_volume), 0) volume,
     COALESCE(SUM(duration_minutes), 0) minutes FROM workout_sessions WHERE status = 'completed'`
  );
  const week = await db.getFirstAsync(
    `SELECT COUNT(*) workouts FROM workout_sessions WHERE status = 'completed'
     AND ended_at >= datetime('now', '-7 days')`
  );
  return { workouts: total?.workouts || 0, volume: total?.volume || 0, minutes: total?.minutes || 0, week: week?.workouts || 0 };
}

const BACKUP_LIMITS = {
  workout_routines: 2000,
  workout_routine_exercises: 20000,
  workout_sessions: 5000,
  workout_session_exercises: 50000,
  workout_sets: 200000,
};

export async function getAllWorkoutData() {
  const db = await getDatabase();
  const result = {};
  for (const [table, limit] of Object.entries(BACKUP_LIMITS)) {
    result[table] = await db.getAllAsync(`SELECT * FROM ${table} LIMIT ?`, [limit]);
  }
  return result;
}

const IMPORT_SPECS = [
  ['workout_routines', ['id', 'name', 'created_at', 'updated_at'], 'workoutRoutines'],
  ['workout_routine_exercises', ['id', 'routine_id', 'exercise_id', 'name', 'muscle', 'position', 'target_sets', 'target_reps', 'target_weight'], 'workoutRoutineExercises'],
  ['workout_sessions', ['id', 'routine_id', 'name', 'status', 'started_at', 'ended_at', 'duration_minutes', 'total_sets', 'total_volume', 'notes', 'created_at', 'updated_at'], 'workoutSessions'],
  ['workout_session_exercises', ['id', 'session_id', 'exercise_id', 'name', 'muscle', 'position'], 'workoutSessionExercises'],
  ['workout_sets', ['id', 'session_exercise_id', 'position', 'weight', 'reps', 'prev_weight', 'prev_reps', 'completed'], 'workoutSets'],
];

export async function importWorkoutData(data) {
  if (!data || typeof data !== 'object') return {};
  const db = await getDatabase();
  const counts = {};
  for (const [table, columns, countKey] of IMPORT_SPECS) {
    for (const row of Array.isArray(data[table]) ? data[table] : []) {
      if (!row?.id) continue;
      const placeholders = columns.map(() => '?').join(', ');
      const updates = columns.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ');
      await db.runAsync(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})
         ON CONFLICT(id) DO UPDATE SET ${updates}`,
        columns.map((column) => row[column] ?? null)
      );
      counts[countKey] = (counts[countKey] || 0) + 1;
    }
  }
  return counts;
}
