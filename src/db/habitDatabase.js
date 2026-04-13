import { getDatabase } from './database';

export async function getHabits() {
  const database = await getDatabase();
  return database.getAllAsync('SELECT * FROM habits WHERE archived = 0 ORDER BY created_at ASC');
}

export async function createHabit(title, emoji, color) {
  const database = await getDatabase();
  await database.runAsync(
    'INSERT INTO habits (title, emoji, color, created_at) VALUES (?, ?, ?, ?)',
    [title, emoji || '✦', color || '#C5A8E8', new Date().toISOString()]
  );
}

export async function updateHabit(id, title, emoji, color) {
  const database = await getDatabase();
  await database.runAsync(
    'UPDATE habits SET title = ?, emoji = ?, color = ? WHERE id = ?',
    [title, emoji, color, id]
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
  } else {
    await database.runAsync(
      'INSERT INTO habit_completions (habit_id, date, completed_at) VALUES (?, ?, ?)',
      [habitId, date, new Date().toISOString()]
    );
    return true;
  }
}

export async function getCompletionsForDate(date) {
  const database = await getDatabase();
  const rows = await database.getAllAsync(
    'SELECT habit_id FROM habit_completions WHERE date = ?',
    [date]
  );
  const set = new Set();
  for (const r of rows) set.add(r.habit_id);
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
  for (const r of rows) {
    if (!map[r.date]) map[r.date] = new Set();
    map[r.date].add(r.habit_id);
  }
  return map;
}

export async function getHabitStreak(habitId) {
  const database = await getDatabase();
  const rows = await database.getAllAsync(
    'SELECT date FROM habit_completions WHERE habit_id = ? ORDER BY date DESC',
    [habitId]
  );
  if (rows.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  let check = new Date(today);

  for (const { date } of rows) {
    const checkStr = `${check.getFullYear()}-${String(check.getMonth()+1).padStart(2,'0')}-${String(check.getDate()).padStart(2,'0')}`;
    if (date === checkStr) {
      streak++;
      check.setDate(check.getDate() - 1);
    } else {
      if (streak === 0) {
        check.setDate(check.getDate() - 1);
        const yStr = `${check.getFullYear()}-${String(check.getMonth()+1).padStart(2,'0')}-${String(check.getDate()).padStart(2,'0')}`;
        if (date === yStr) {
          streak++;
          check.setDate(check.getDate() - 1);
        } else break;
      } else break;
    }
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
    const str = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    result.push(str);
  }
  const rows = await database.getAllAsync(
    `SELECT date FROM habit_completions WHERE habit_id = ? AND date IN (${result.map(() => '?').join(',')})`,
    [habitId, ...result]
  );
  const doneSet = new Set(rows.map(r => r.date));
  return result.map(date => ({ date, done: doneSet.has(date) }));
}

export async function getCompletionRate(habitId, days = 30) {
  const database = await getDatabase();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = `${since.getFullYear()}-${String(since.getMonth()+1).padStart(2,'0')}-${String(since.getDate()).padStart(2,'0')}`;
  const row = await database.getFirstAsync(
    'SELECT COUNT(*) as count FROM habit_completions WHERE habit_id = ? AND date >= ?',
    [habitId, sinceStr]
  );
  return Math.round(((row?.count || 0) / days) * 100);
}

export async function getHabitInsights() {
  const database = await getDatabase();
  const habits = await database.getAllAsync('SELECT id FROM habits WHERE archived = 0');
  if (!habits.length) return { total: 0, rate30: 0, bestStreak: 0, todayDone: 0 };

  const today = new Date();
  const pad = n => String(n).padStart(2, '0');
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
  const since = new Date(today); since.setDate(today.getDate() - 30);
  const sinceStr = `${since.getFullYear()}-${pad(since.getMonth()+1)}-${pad(since.getDate())}`;

  const done30 = await database.getFirstAsync(
    'SELECT COUNT(*) as count FROM habit_completions WHERE date >= ?', [sinceStr]
  );
  const rate30 = Math.round(((done30?.count || 0) / (habits.length * 30)) * 100);

  let bestStreak = 0;
  for (const h of habits) {
    const s = await getHabitStreak(h.id);
    if (s > bestStreak) bestStreak = s;
  }

  const todayDone = await database.getFirstAsync(
    'SELECT COUNT(*) as count FROM habit_completions WHERE date = ?', [todayStr]
  );

  return { total: habits.length, rate30, bestStreak, todayDone: todayDone?.count || 0 };
}
