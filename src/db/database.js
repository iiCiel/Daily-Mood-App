import * as SQLite from 'expo-sqlite';

let db = null;

export async function getDatabase() {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('mood_journal.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      mood INTEGER NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL,
      uri TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      target_pomodoros INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pomodoro_sessions (
      id TEXT PRIMARY KEY,
      task_id TEXT,
      duration INTEGER NOT NULL DEFAULT 25,
      completed INTEGER NOT NULL DEFAULT 0,
      date TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      emoji TEXT DEFAULT '✦',
      color TEXT DEFAULT '#C5A8E8',
      created_at TEXT NOT NULL,
      archived INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS habit_completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      habit_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      UNIQUE(habit_id, date)
    );

    CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
    CREATE INDEX IF NOT EXISTS idx_photos_entry ON photos(entry_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_date ON pomodoro_sessions(date);
    CREATE INDEX IF NOT EXISTS idx_sessions_task ON pomodoro_sessions(task_id);
  `);
  return db;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export async function saveEntry(date, mood, note, photoUris = []) {
  const database = await getDatabase();
  const existing = await database.getFirstAsync(
    'SELECT id FROM entries WHERE date = ?',
    [date]
  );

  const entryId = existing?.id || generateId();
  const now = new Date().toISOString();

  if (existing) {
    await database.runAsync(
      'UPDATE entries SET mood = ?, note = ?, updated_at = ?, synced = 0 WHERE id = ?',
      [mood, note, now, entryId]
    );
  } else {
    await database.runAsync(
      'INSERT INTO entries (id, date, mood, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [entryId, date, mood, note, now, now]
    );
  }

  // Handle photos - delete removed ones, add new ones
  const existingPhotos = await database.getAllAsync(
    'SELECT uri FROM photos WHERE entry_id = ?',
    [entryId]
  );
  const existingUris = new Set(existingPhotos.map((p) => p.uri));
  const newUris = new Set(photoUris);

  // Delete removed photos
  for (const photo of existingPhotos) {
    if (!newUris.has(photo.uri)) {
      await database.runAsync('DELETE FROM photos WHERE entry_id = ? AND uri = ?', [
        entryId,
        photo.uri,
      ]);
    }
  }

  // Add new photos
  for (const uri of photoUris) {
    if (!existingUris.has(uri)) {
      const photoId = generateId();
      await database.runAsync(
        'INSERT INTO photos (id, entry_id, uri) VALUES (?, ?, ?)',
        [photoId, entryId, uri]
      );
    }
  }

  return entryId;
}

export async function getEntry(date) {
  const database = await getDatabase();
  const entry = await database.getFirstAsync(
    'SELECT * FROM entries WHERE date = ?',
    [date]
  );
  if (!entry) return null;

  const photos = await database.getAllAsync(
    'SELECT * FROM photos WHERE entry_id = ? ORDER BY created_at',
    [entry.id]
  );
  return { ...entry, photos };
}

export async function getEntries(limit = 50, offset = 0) {
  const database = await getDatabase();
  const entries = await database.getAllAsync(
    'SELECT * FROM entries ORDER BY date DESC LIMIT ? OFFSET ?',
    [limit, offset]
  );

  const result = [];
  for (const entry of entries) {
    const photos = await database.getAllAsync(
      'SELECT * FROM photos WHERE entry_id = ? ORDER BY created_at',
      [entry.id]
    );
    result.push({ ...entry, photos });
  }
  return result;
}

export async function getEntriesForMonth(year, month) {
  const database = await getDatabase();
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const entries = await database.getAllAsync(
    "SELECT * FROM entries WHERE date LIKE ? || '%' ORDER BY date DESC",
    [prefix]
  );

  const result = [];
  for (const entry of entries) {
    const photos = await database.getAllAsync(
      'SELECT * FROM photos WHERE entry_id = ? ORDER BY created_at',
      [entry.id]
    );
    result.push({ ...entry, photos });
  }
  return result;
}

export async function exportMonthAsText(year, month) {
  const database = await getDatabase();
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const entries = await database.getAllAsync(
    "SELECT * FROM entries WHERE date LIKE ? || '%' ORDER BY date ASC",
    [prefix]
  );
  if (!entries.length) return null;

  const MOOD_LABELS = { 5: 'Great', 4: 'Good', 3: 'Okay', 2: 'Low', 1: 'Bad' };
  const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  let text = `Mood Journal — ${monthName}\n${'='.repeat(40)}\n\n`;
  for (const entry of entries) {
    const dateObj = new Date(entry.date + 'T00:00:00');
    const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    text += `${dateStr}\n`;
    text += `Mood: ${MOOD_LABELS[entry.mood] || entry.mood}\n`;
    if (entry.note) text += `\n${entry.note}\n`;
    text += `\n${'-'.repeat(30)}\n\n`;
  }
  return text;
}

export async function deleteEntry(id) {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM entries WHERE id = ?', [id]);
}

export async function getStreak() {
  const database = await getDatabase();
  const entries = await database.getAllAsync(
    'SELECT date FROM entries ORDER BY date DESC'
  );
  if (!entries.length) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateSet = new Set(entries.map((e) => e.date));

  let streak = 0;
  const cursor = new Date(today);

  // If today is not logged, start checking from yesterday
  const todayStr = cursor.toISOString().slice(0, 10);
  if (!dateSet.has(todayStr)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (true) {
    const str = cursor.toISOString().slice(0, 10);
    if (!dateSet.has(str)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export async function getMonthStats(year, month) {
  const database = await getDatabase();
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const entries = await database.getAllAsync(
    "SELECT mood FROM entries WHERE date LIKE ? || '%'",
    [prefix]
  );
  if (!entries.length) return null;

  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const e of entries) counts[e.mood] = (counts[e.mood] || 0) + 1;

  const total = entries.length;
  const avgMood = entries.reduce((sum, e) => sum + e.mood, 0) / total;
  const topMood = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

  return { total, counts, avgMood, topMood: parseInt(topMood[0]) };
}

export async function getMoodFocusCorrelation() {
  // Returns { highFocusAvg, lowFocusAvg, highFocusDays, lowFocusDays }
  // "high focus" = days with >= 60 min focused, "low focus" = days with < 60 min (but > 0)
  const database = await getDatabase();
  // Get all mood entries with their dates
  const moodEntries = await database.getAllAsync('SELECT date, mood FROM entries');
  if (moodEntries.length < 5) return null; // not enough data

  // Get focus minutes per day (from same db - pomodoro_sessions table)
  let sessions = [];
  try {
    sessions = await database.getAllAsync(
      'SELECT date, SUM(duration) as mins FROM pomodoro_sessions WHERE completed = 1 GROUP BY date'
    );
  } catch { return null; }

  if (sessions.length < 3) return null;

  const focusMap = {};
  for (const s of sessions) focusMap[s.date] = s.mins;

  const highFocus = [], lowFocus = [];
  for (const e of moodEntries) {
    const mins = focusMap[e.date];
    if (mins === undefined) continue;
    if (mins >= 60) highFocus.push(e.mood);
    else if (mins > 0) lowFocus.push(e.mood);
  }

  if (highFocus.length < 2 || lowFocus.length < 2) return null;

  const avg = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
  return {
    highFocusAvg: avg(highFocus),
    lowFocusAvg: avg(lowFocus),
    highFocusDays: highFocus.length,
    lowFocusDays: lowFocus.length,
  };
}

export async function getEntriesForYear(year) {
  const database = await getDatabase();
  const entries = await database.getAllAsync(
    "SELECT date, mood FROM entries WHERE date LIKE ? || '%'",
    [String(year)]
  );
  const map = {};
  for (const e of entries) map[e.date] = e.mood;
  return map;
}

export async function getLastNDaysMoods(n = 7) {
  const database = await getDatabase();
  const days = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const str = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    days.push(str);
  }
  const entries = await database.getAllAsync(
    `SELECT date, mood FROM entries WHERE date IN (${days.map(() => '?').join(',')})`,
    days
  );
  const map = {};
  for (const e of entries) map[e.date] = e.mood;
  return days.map((date) => ({ date, mood: map[date] || null }));
}

export async function getUnsyncedEntries() {
  const database = await getDatabase();
  return database.getAllAsync('SELECT * FROM entries WHERE synced = 0');
}

export async function markSynced(id) {
  const database = await getDatabase();
  await database.runAsync('UPDATE entries SET synced = 1 WHERE id = ?', [id]);
}
