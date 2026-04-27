import { getDatabase } from './database';
import {
  createPlanningTask,
  deletePlanningTask,
  getPlanningTasks,
  togglePlanningTask,
  updatePlanningTask,
} from './plannerDatabase';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── Tasks ──────────────────────────────────────────────

export async function getTasks() {
  return getPlanningTasks({ includeCompleted: true });
}

export async function createTask(title, targetPomodoros = 1) {
  return createPlanningTask({ title, targetPomodoros });
}

export async function setTaskPomodoros(id, target) {
  const database = await getDatabase();
  await database.runAsync('UPDATE tasks SET target_pomodoros = ? WHERE id = ?', [target, id]);
}

export async function getTaskPomodoroCount(taskId) {
  const database = await getDatabase();
  const result = await database.getFirstAsync(
    'SELECT COUNT(*) as count FROM pomodoro_sessions WHERE task_id = ? AND completed = 1',
    [taskId]
  );
  return result?.count || 0;
}

export async function updateTask(id, title) {
  await updatePlanningTask(id, { title });
}

export async function toggleTask(id) {
  await togglePlanningTask(id);
}

export async function deleteTask(id) {
  await deletePlanningTask(id);
}

// ── Sessions ───────────────────────────────────────────

export async function saveSession({ taskId, duration, completed, date, startedAt, endedAt }) {
  const database = await getDatabase();
  const id = genId();
  await database.runAsync(
    'INSERT INTO pomodoro_sessions (id, task_id, duration, completed, date, started_at, ended_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, taskId || null, duration, completed ? 1 : 0, date, startedAt, endedAt || null]
  );
  return id;
}

export async function getSessionsForMonth(year, month) {
  const database = await getDatabase();
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return database.getAllAsync(
    "SELECT * FROM pomodoro_sessions WHERE date LIKE ? || '%' ORDER BY started_at DESC",
    [prefix]
  );
}

export async function getSessionsForDay(date) {
  const database = await getDatabase();
  return database.getAllAsync(
    'SELECT s.*, t.title as task_title FROM pomodoro_sessions s LEFT JOIN tasks t ON s.task_id = t.id WHERE s.date = ? ORDER BY s.started_at DESC',
    [date]
  );
}

export async function getFocusStats(year, month) {
  const database = await getDatabase();
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const sessions = await database.getAllAsync(
    "SELECT date, SUM(duration) as total_mins, COUNT(*) as count FROM pomodoro_sessions WHERE date LIKE ? || '%' AND completed = 1 GROUP BY date",
    [prefix]
  );
  const map = {};
  for (const s of sessions) map[s.date] = { minutes: s.total_mins, count: s.count };
  return map;
}

export async function getAllFocusSessions(limit = 20000) {
  const database = await getDatabase();
  return database.getAllAsync(
    `SELECT s.*, COALESCE(t.title, '') as task_title
     FROM pomodoro_sessions s
     LEFT JOIN tasks t ON s.task_id = t.id
     ORDER BY s.date DESC, s.started_at DESC
     LIMIT ?`,
    [limit]
  );
}

export async function getTotalFocusMinutes() {
  const database = await getDatabase();
  const result = await database.getFirstAsync(
    'SELECT SUM(duration) as total FROM pomodoro_sessions WHERE completed = 1'
  );
  return result?.total || 0;
}

export async function getFocusInsights() {
  const database = await getDatabase();

  const today = new Date();
  const pad = n => String(n).padStart(2, '0');
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const weekStr = `${weekStart.getFullYear()}-${pad(weekStart.getMonth()+1)}-${pad(weekStart.getDate())}`;

  const week = await database.getFirstAsync(
    'SELECT SUM(duration) as mins, COUNT(*) as sessions FROM pomodoro_sessions WHERE completed = 1 AND date >= ?',
    [weekStr]
  );
  const total = await database.getFirstAsync(
    'SELECT SUM(duration) as mins, COUNT(*) as sessions FROM pomodoro_sessions WHERE completed = 1'
  );
  const best = await database.getAllAsync(
    'SELECT date, SUM(duration) as mins FROM pomodoro_sessions WHERE completed = 1 GROUP BY date ORDER BY mins DESC LIMIT 1'
  );

  return {
    weekMins: week?.mins || 0,
    weekSessions: week?.sessions || 0,
    totalMins: total?.mins || 0,
    totalSessions: total?.sessions || 0,
    bestDayMins: best[0]?.mins || 0,
    bestDate: best[0]?.date || null,
  };
}
