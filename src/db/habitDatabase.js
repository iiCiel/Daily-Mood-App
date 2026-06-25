import { getDatabase } from './database';

const DAILY_SCHEDULE = [0, 1, 2, 3, 4, 5, 6];
const DAILY_TARGET = 7;
const DEFAULT_HABIT_ICON = 'star-outline';

export function parseScheduleDays(value) {
  if (Array.isArray(value)) return normalizeScheduleDays(value);
  if (!value) return DAILY_SCHEDULE;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return normalizeScheduleDays(parsed);
    return DAILY_SCHEDULE.slice(0, parseWeeklyTarget(parsed));
  } catch {
    return DAILY_SCHEDULE;
  }
}

export function parseWeeklyTarget(value) {
  return normalizeWeeklyTarget(parseWeeklyTargetValue(value));
}

function parseWeeklyTargetValue(value) {
  if (value == null || value === '') return DAILY_TARGET;
  if (typeof value === 'number') return value;
  if (Array.isArray(value)) return normalizeScheduleDays(value).length;
  if (typeof value === 'object') {
    return value.daysPerWeek ?? value.days_per_week ?? value.weeklyTarget ?? value.target ?? DAILY_TARGET;
  }
  try {
    return parseWeeklyTargetValue(JSON.parse(value));
  } catch {
    const number = Number(value);
    return Number.isFinite(number) ? number : DAILY_TARGET;
  }
}

function normalizeWeeklyTarget(value) {
  const target = Math.round(Number(value));
  if (!Number.isFinite(target)) return DAILY_TARGET;
  return Math.min(DAILY_TARGET, Math.max(1, target));
}

function normalizeScheduleDays(days) {
  const unique = [...new Set((days || []).map(Number).filter((day) => day >= 0 && day <= 6))];
  return unique.length ? unique.sort((a, b) => a - b) : DAILY_SCHEDULE;
}

function serializeWeeklyTarget(daysPerWeek) {
  return JSON.stringify({ daysPerWeek: normalizeWeeklyTarget(daysPerWeek) });
}

function dateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function toLocalDate(date) {
  if (date instanceof Date) return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return new Date(`${date}T00:00:00`);
}

function weekStart(date) {
  const d = toLocalDate(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function weekEnd(date) {
  const d = weekStart(date);
  d.setDate(d.getDate() + 6);
  return d;
}

function weekKey(date) {
  return dateStr(weekStart(date));
}

export function isHabitScheduledOn(habit) {
  return parseWeeklyTarget(habit?.schedule_days) > 0;
}

export async function getHabits() {
  const database = await getDatabase();
  return database.getAllAsync('SELECT * FROM habits WHERE archived = 0 ORDER BY created_at ASC');
}

export async function createHabit(title, emoji, color, daysPerWeek = DAILY_TARGET) {
  const database = await getDatabase();
  await database.runAsync(
    'INSERT INTO habits (title, emoji, color, schedule_days, created_at) VALUES (?, ?, ?, ?, ?)',
    [title, emoji || DEFAULT_HABIT_ICON, color || '#C5A8E8', serializeWeeklyTarget(daysPerWeek), new Date().toISOString()]
  );
}

export async function updateHabit(id, title, emoji, color, daysPerWeek = DAILY_TARGET) {
  const database = await getDatabase();
  await database.runAsync(
    'UPDATE habits SET title = ?, emoji = ?, color = ?, schedule_days = ? WHERE id = ?',
    [title, emoji, color, serializeWeeklyTarget(daysPerWeek), id]
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

export async function getHabitWeekProgress(habitOrId, date = new Date()) {
  const database = await getDatabase();
  const habit = typeof habitOrId === 'object'
    ? habitOrId
    : await database.getFirstAsync('SELECT id, schedule_days FROM habits WHERE id = ?', [habitOrId]);
  if (!habit) {
    return { target: DAILY_TARGET, completed: 0, remaining: 1, todayDone: false, dueToday: true, goalMet: false };
  }

  const target = parseWeeklyTarget(habit.schedule_days);
  const current = toLocalDate(date);
  const currentStr = dateStr(current);
  const startStr = dateStr(weekStart(current));
  const endStr = dateStr(weekEnd(current));
  const rows = await database.getAllAsync(
    'SELECT date FROM habit_completions WHERE habit_id = ? AND date >= ? AND date <= ?',
    [habit.id, startStr, endStr]
  );
  const doneDates = new Set(rows.map((row) => row.date));
  const completed = doneDates.size;
  const todayDone = doneDates.has(currentStr);

  if (target === DAILY_TARGET) {
    return {
      target,
      completed,
      remaining: todayDone ? 0 : 1,
      todayDone,
      dueToday: !todayDone,
      goalMet: todayDone,
    };
  }

  const goalMet = completed >= target;
  return {
    target,
    completed,
    remaining: Math.max(0, target - completed),
    todayDone,
    dueToday: !goalMet,
    goalMet,
  };
}

export async function getHabitStreak(habitId) {
  const database = await getDatabase();
  const habit = await database.getFirstAsync('SELECT schedule_days FROM habits WHERE id = ?', [habitId]);
  const target = parseWeeklyTarget(habit?.schedule_days);
  const rows = await database.getAllAsync(
    'SELECT date FROM habit_completions WHERE habit_id = ? ORDER BY date DESC',
    [habitId]
  );
  if (rows.length === 0) return 0;

  const doneSet = new Set(rows.map((row) => row.date));
  const today = new Date();

  if (target < DAILY_TARGET) {
    let cursor = weekStart(today);
    let streak = 0;
    let skippedCurrentWeek = false;

    for (let guard = 0; guard < 104; guard++) {
      const start = dateStr(cursor);
      const end = dateStr(weekEnd(cursor));
      const completed = rows.filter((row) => row.date >= start && row.date <= end).length;

      if (completed >= target) {
        streak++;
        cursor.setDate(cursor.getDate() - 7);
        continue;
      }

      if (!skippedCurrentWeek && start === weekKey(today)) {
        skippedCurrentWeek = true;
        cursor.setDate(cursor.getDate() - 7);
        continue;
      }

      break;
    }

    return streak;
  }

  const check = new Date(today);
  let streak = 0;
  let skippedCurrentScheduledDay = false;

  for (let guard = 0; guard < 730; guard++) {
    const current = dateStr(check);
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
  const target = parseWeeklyTarget(habit?.schedule_days);
  const doneSet = new Set(rows.map((row) => row.date));

  if (target === DAILY_TARGET) {
    return result.map((date) => ({ date, done: doneSet.has(date), scheduled: true }));
  }

  const byWeek = {};
  for (const date of result) {
    const key = weekKey(date);
    if (!byWeek[key]) byWeek[key] = [];
    byWeek[key].push(date);
  }

  const todayKey = weekKey(new Date());
  const scheduledSet = new Set();
  for (const [key, dates] of Object.entries(byWeek)) {
    const doneDates = dates.filter((date) => doneSet.has(date));
    for (const date of doneDates.slice(0, target)) {
      scheduledSet.add(date);
    }

    const doneInWeek = doneDates.length;
    if (key === todayKey || doneInWeek >= target) continue;

    const expected = Math.min(target, dates.length);
    let missing = Math.max(0, expected - doneInWeek);
    for (const date of [...dates].reverse()) {
      if (missing <= 0) break;
      if (doneSet.has(date)) continue;
      scheduledSet.add(date);
      missing--;
    }
  }

  return result.map((date) => ({ date, done: doneSet.has(date), scheduled: scheduledSet.has(date) }));
}

export async function getCompletionRate(habitId, days = 30) {
  const database = await getDatabase();
  const habit = await database.getFirstAsync('SELECT schedule_days FROM habits WHERE id = ?', [habitId]);
  const target = parseWeeklyTarget(habit?.schedule_days);
  const dates = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(dateStr(d));
  }
  if (!dates.length) return 0;

  const rows = await database.getAllAsync(
    `SELECT date FROM habit_completions WHERE habit_id = ? AND date IN (${dates.map(() => '?').join(',')})`,
    [habitId, ...dates]
  );
  const doneSet = new Set(rows.map((row) => row.date));

  if (target === DAILY_TARGET) {
    return Math.round((rows.length / dates.length) * 100);
  }

  const weeks = {};
  for (const date of dates) {
    const key = weekKey(date);
    if (!weeks[key]) weeks[key] = [];
    weeks[key].push(date);
  }

  let opportunities = 0;
  let completed = 0;
  for (const weekDates of Object.values(weeks)) {
    const expected = Math.min(target, weekDates.length);
    const done = weekDates.filter((date) => doneSet.has(date)).length;
    opportunities += expected;
    completed += Math.min(done, expected);
  }

  return opportunities ? Math.round((completed / opportunities) * 100) : 0;
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
    const target = parseWeeklyTarget(habit.schedule_days);
    const weekBuckets = {};
    const cursor = new Date(since);
    for (let i = 0; i < 30; i++) {
      const current = dateStr(cursor);
      if (target === DAILY_TARGET) {
        opportunities++;
        if (doneSet.has(`${habit.id}:${current}`)) completed++;
      } else {
        const key = weekKey(cursor);
        if (!weekBuckets[key]) weekBuckets[key] = [];
        weekBuckets[key].push(current);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    if (target < DAILY_TARGET) {
      for (const dates of Object.values(weekBuckets)) {
        const expected = Math.min(target, dates.length);
        const done = dates.filter((date) => doneSet.has(`${habit.id}:${date}`)).length;
        opportunities += expected;
        completed += Math.min(done, expected);
      }
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
  let todayDue = 0;
  let todayDone = 0;
  for (const habit of habits) {
    const progress = await getHabitWeekProgress(habit, today);
    if (progress.dueToday) todayDue++;
    if (progress.goalMet || todayDoneSet.has(habit.id)) todayDone++;
  }

  return { total: habits.length, todayDue, rate30, bestStreak, todayDone };
}

export async function importHabitDefinition(habit) {
  if (!habit?.title) return;
  const database = await getDatabase();
  const scheduleDays = serializeWeeklyTarget(parseWeeklyTarget(habit.schedule_days));
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
      [title, emoji || DEFAULT_HABIT_ICON, '#C5A8E8', serializeWeeklyTarget(parseWeeklyTarget(scheduleDays)), now]
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
