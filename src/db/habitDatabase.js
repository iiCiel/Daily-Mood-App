import { getDatabase } from './database';

const DAILY_SCHEDULE = [0, 1, 2, 3, 4, 5, 6];
const DEFAULT_HABIT_ICON = 'star-outline';

export function parseScheduleDays(value) {
  if (Array.isArray(value)) return normalizeScheduleDays(value);
  if (!value) return DAILY_SCHEDULE;
  try {
    return normalizeScheduleDays(JSON.parse(value));
  } catch {
    return DAILY_SCHEDULE;
  }
}

function normalizeScheduleDays(days) {
  const unique = [...new Set((days || []).map(Number).filter((day) => day >= 0 && day <= 6))];
  return unique.length ? unique.sort((a, b) => a - b) : DAILY_SCHEDULE;
}

function dateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

export function isHabitScheduledOn(habit, date = new Date()) {
  return parseScheduleDays(habit?.schedule_days).includes(date.getDay());
}

export async function getHabits() {
  const database = await getDatabase();
  return database.getAllAsync('SELECT * FROM habits WHERE archived = 0 ORDER BY created_at ASC');
}

export async function createHabit(title, emoji, color, scheduleDays = DAILY_SCHEDULE) {
  const database = await getDatabase();
  await database.runAsync(
    'INSERT INTO habits (title, emoji, color, schedule_days, created_at) VALUES (?, ?, ?, ?, ?)',
    [title, emoji || DEFAULT_HABIT_ICON, color || '#C5A8E8', JSON.stringify(normalizeScheduleDays(scheduleDays)), new Date().toISOString()]
  );
}

export async function updateHabit(id, title, emoji, color, scheduleDays = DAILY_SCHEDULE) {
  const database = await getDatabase();
  await database.runAsync(
    'UPDATE habits SET title = ?, emoji = ?, color = ?, schedule_days = ? WHERE id = ?',
    [title, emoji, color, JSON.stringify(normalizeScheduleDays(scheduleDays)), id]
  );
}

export async function archiveHabit(id) {
  const database = await getDatabase();
  await database.runAsync('UPDATE habits SET archived = 1 WHERE id = ?', [id]);
}

export async function toggleCompletion(habitId, date) {
  const database = await getDatabase();
  const existing = await database.getFirstAsync(
    'SELECT id FROM habit_completions WHERE habit_id = ? AND date = ?',
    [habitId, date]
  );
  if (existing) {
    await database.runAsync(
      'DELETE FROM habit_completions WHERE habit_id = ? AND date = ?',
      [habitId, date]
    );
    return false;
  }

  await database.runAsync(
    'INSERT INTO habit_completions (habit_id, date, completed_at) VALUES (?, ?, ?)',
    [habitId, date, new Date().toISOString()]
  );
  return true;
}

export async function getCompletionsForDate(date) {
  const database = await getDatabase();
  const rows = await database.getAllAsync(
    'SELECT habit_id FROM habit_completions WHERE date = ?',
    [date]
  );
  const set = new Set();
  for (const row of rows) set.add(row.habit_id);
  return set;
}

export async function getCompletionsForMonth(year, month) {
  const database = await getDatabase();
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const rows = await database.getAllAsync(
    "SELECT habit_id, date FROM habit_completions WHERE date LIKE ? || '%'",
    [prefix]
  );
  const map = {};
  for (const row of rows) {
    if (!map[row.date]) map[row.date] = new Set();
    map[row.date].add(row.habit_id);
  }
  return map;
}

export async function getHabitStreak(habitId) {
  const database = await getDatabase();
  const habit = await database.getFirstAsync('SELECT schedule_days FROM habits WHERE id = ?', [habitId]);
  const scheduleDays = parseScheduleDays(habit?.schedule_days);
  const rows = await database.getAllAsync(
    'SELECT date FROM habit_completions WHERE habit_id = ? ORDER BY date DESC',
    [habitId]
  );
  if (rows.length === 0) return 0;

  const doneSet = new Set(rows.map((row) => row.date));
  const today = new Date();
  const check = new Date(today);
  let streak = 0;
  let skippedCurrentScheduledDay = false;

  for (let guard = 0; guard < 730; guard++) {
    const current = dateStr(check);
    if (!scheduleDays.includes(check.getDay())) {
      check.setDate(check.getDate() - 1);
      continue;
    }

    if (doneSet.has(current)) {
      streak++;
      check.setDate(check.getDate() - 1);
      continue;
    }

    // Do not break a displayed streak before today's scheduled window is over.
    if (streak === 0 && !skippedCurrentScheduledDay && current === dateStr(today)) {
      skippedCurrentScheduledDay = true;
      check.setDate(check.getDate() - 1);
      continue;
    }

    break;
  }

  return streak;
}

export async function getHabitHistory(habitId, days = 30) {
  const database = await getDatabase();
  const result = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    result.push(dateStr(d));
  }

  const rows = await database.getAllAsync(
    `SELECT date FROM habit_completions WHERE habit_id = ? AND date IN (${result.map(() => '?').join(',')})`,
    [habitId, ...result]
  );
  const habit = await database.getFirstAsync('SELECT schedule_days FROM habits WHERE id = ?', [habitId]);
  const scheduleDays = parseScheduleDays(habit?.schedule_days);
  const doneSet = new Set(rows.map((row) => row.date));

  return result.map((date) => {
    const localDate = new Date(`${date}T00:00:00`);
    return { date, done: doneSet.has(date), scheduled: scheduleDays.includes(localDate.getDay()) };
  });
}

export async function getCompletionRate(habitId, days = 30) {
  const database = await getDatabase();
  const habit = await database.getFirstAsync('SELECT schedule_days FROM habits WHERE id = ?', [habitId]);
  const scheduleDays = parseScheduleDays(habit?.schedule_days);
  const scheduledDates = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (scheduleDays.includes(d.getDay())) scheduledDates.push(dateStr(d));
  }
  if (!scheduledDates.length) return 0;

  const row = await database.getFirstAsync(
    `SELECT COUNT(*) as count FROM habit_completions WHERE habit_id = ? AND date IN (${scheduledDates.map(() => '?').join(',')})`,
    [habitId, ...scheduledDates]
  );
  return Math.round(((row?.count || 0) / scheduledDates.length) * 100);
}

export async function getHabitInsights() {
  const database = await getDatabase();
  const habits = await database.getAllAsync('SELECT id, schedule_days FROM habits WHERE archived = 0');
  if (!habits.length) return { total: 0, todayDue: 0, rate30: 0, bestStreak: 0, todayDone: 0 };

  const today = new Date();
  const since = new Date(today);
  since.setDate(today.getDate() - 29);
  const sinceStr = dateStr(since);
  const todayString = dateStr(today);

  const done30 = await database.getAllAsync(
    'SELECT habit_id, date FROM habit_completions WHERE date >= ?',
    [sinceStr]
  );
  const doneSet = new Set(done30.map((row) => `${row.habit_id}:${row.date}`));
  let opportunities = 0;
  let completed = 0;

  for (const habit of habits) {
    const scheduleDays = parseScheduleDays(habit.schedule_days);
    const cursor = new Date(since);
    for (let i = 0; i < 30; i++) {
      const current = dateStr(cursor);
      if (scheduleDays.includes(cursor.getDay())) {
        opportunities++;
        if (doneSet.has(`${habit.id}:${current}`)) completed++;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  const rate30 = opportunities ? Math.round((completed / opportunities) * 100) : 0;

  let bestStreak = 0;
  for (const habit of habits) {
    const streak = await getHabitStreak(habit.id);
    if (streak > bestStreak) bestStreak = streak;
  }

  const todayRows = await database.getAllAsync(
    'SELECT habit_id FROM habit_completions WHERE date = ?',
    [todayString]
  );
  const todayDoneSet = new Set(todayRows.map((row) => row.habit_id));
  const todayDueHabits = habits.filter((habit) => parseScheduleDays(habit.schedule_days).includes(today.getDay()));
  const todayDone = todayDueHabits.filter((habit) => todayDoneSet.has(habit.id)).length;

  return { total: habits.length, todayDue: todayDueHabits.length, rate30, bestStreak, todayDone };
}

export async function importHabitDefinition(habit) {
  if (!habit?.title) return;
  const database = await getDatabase();
  const scheduleDays = JSON.stringify(parseScheduleDays(habit.schedule_days));
  const now = new Date().toISOString();
  await database.runAsync(
    `INSERT INTO habits (id, title, emoji, color, schedule_days, created_at, archived)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      emoji = excluded.emoji,
      color = excluded.color,
      schedule_days = excluded.schedule_days,
      archived = excluded.archived`,
    [
      habit.id || null,
      String(habit.title).trim(),
      habit.emoji || DEFAULT_HABIT_ICON,
      habit.color || '#C5A8E8',
      scheduleDays,
      habit.created_at || now,
      habit.archived ? 1 : 0,
    ]
  );
}

export async function importHabitCompletion(title, emoji, date, scheduleDays = DAILY_SCHEDULE) {
  const database = await getDatabase();
  let habit = await database.getFirstAsync(
    'SELECT id FROM habits WHERE LOWER(title) = LOWER(?)',
    [title]
  );
  if (!habit) {
    const now = new Date().toISOString();
    await database.runAsync(
      'INSERT INTO habits (title, emoji, color, schedule_days, created_at, archived) VALUES (?, ?, ?, ?, ?, 0)',
      [title, emoji || DEFAULT_HABIT_ICON, '#C5A8E8', JSON.stringify(parseScheduleDays(scheduleDays)), now]
    );
    habit = await database.getFirstAsync('SELECT id FROM habits WHERE LOWER(title) = LOWER(?)', [title]);
  }
  if (!habit) return;
  try {
    await database.runAsync(
      'INSERT OR IGNORE INTO habit_completions (habit_id, date, completed_at) VALUES (?, ?, ?)',
      [habit.id, date, new Date().toISOString()]
    );
  } catch {}
}

export async function getAllHabitsForBackup() {
  const database = await getDatabase();
  return database.getAllAsync(
    'SELECT id, title, emoji, color, schedule_days, archived, created_at FROM habits ORDER BY created_at ASC'
  );
}

export async function getAllHabitCompletions() {
  const database = await getDatabase();
  return database.getAllAsync(
    `SELECT hc.date, h.title, h.emoji, h.schedule_days
     FROM habit_completions hc
     JOIN habits h ON h.id = hc.habit_id
     ORDER BY hc.date DESC, h.title ASC`
  );
}
