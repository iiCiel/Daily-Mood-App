import * as SQLite from 'expo-sqlite';

let dbPromise = null;

export function getDatabase() {
  if (!dbPromise) {
    dbPromise = _initDatabase();
  }
  return dbPromise;
}

async function _initDatabase() {
  const database = await SQLite.openDatabaseAsync('mood_journal.db');
  // Run pragmas separately — mixing them into execAsync with DDL can fail on Android
  await database.runAsync('PRAGMA journal_mode = WAL');
  await database.runAsync('PRAGMA foreign_keys = ON');
  await database.execAsync(`
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
      target_pomodoros INTEGER DEFAULT 1,
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
    CREATE TABLE IF NOT EXISTS sleep_entries (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      bedtime TEXT,
      wake_time TEXT,
      quality INTEGER,
      note TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT,
      body TEXT,
      pinned INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT DEFAULT 'personal',
      target_value REAL,
      current_value REAL DEFAULT 0,
      unit TEXT,
      deadline TEXT,
      completed INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS planner_entries (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      intention TEXT,
      priorities TEXT DEFAULT '[]',
      evening_note TEXT,
      evening_rating INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS calorie_entries (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      meal TEXT DEFAULT 'snack',
      name TEXT NOT NULL,
      calories INTEGER NOT NULL,
      protein REAL,
      carbs REAL,
      fat REAL,
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
    CREATE INDEX IF NOT EXISTS idx_photos_entry ON photos(entry_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_date ON pomodoro_sessions(date);
    CREATE INDEX IF NOT EXISTS idx_sessions_task ON pomodoro_sessions(task_id);
    CREATE INDEX IF NOT EXISTS idx_sleep_date ON sleep_entries(date);
    CREATE INDEX IF NOT EXISTS idx_planner_date ON planner_entries(date);
    CREATE INDEX IF NOT EXISTS idx_calories_date ON calorie_entries(date);
    CREATE TABLE IF NOT EXISTS weight_entries (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      weight REAL NOT NULL,
      unit TEXT NOT NULL DEFAULT 'kg',
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_weight_date ON weight_entries(date);
  `);
  // Migrations for existing installs
  try { await database.runAsync('ALTER TABLE tasks ADD COLUMN target_pomodoros INTEGER DEFAULT 1'); } catch {}
  try { await database.runAsync("ALTER TABLE entries ADD COLUMN tags TEXT DEFAULT '[]'"); } catch {}
  try { await database.runAsync("ALTER TABLE entries ADD COLUMN gratitude TEXT DEFAULT '[]'"); } catch {}
  return database;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export async function saveEntry(date, mood, note, photoUris = [], tags = [], gratitude = []) {
  const database = await getDatabase();
  const existing = await database.getFirstAsync(
    'SELECT id FROM entries WHERE date = ?',
    [date]
  );

  const entryId = existing?.id || generateId();
  const now = new Date().toISOString();
  const tagsJson = JSON.stringify(tags || []);
  const gratitudeJson = JSON.stringify(gratitude || []);

  if (existing) {
    await database.runAsync(
      'UPDATE entries SET mood = ?, note = ?, tags = ?, gratitude = ?, updated_at = ?, synced = 0 WHERE id = ?',
      [mood, note, tagsJson, gratitudeJson, now, entryId]
    );
  } else {
    await database.runAsync(
      'INSERT INTO entries (id, date, mood, note, tags, gratitude, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [entryId, date, mood, note, tagsJson, gratitudeJson, now, now]
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
  let parsedTags = [];
  try { parsedTags = JSON.parse(entry.tags || '[]'); } catch {}
  let parsedGratitude = [];
  try { parsedGratitude = JSON.parse(entry.gratitude || '[]'); } catch {}
  return { ...entry, photos, tags: parsedTags, gratitude: parsedGratitude };
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

export async function importFromText(text) {
  const MOOD_MAP = { 'Great': 5, 'Good': 4, 'Okay': 3, 'Low': 2, 'Bad': 1 };

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const headerMatch = text.match(/Mood Journal[^—]*—[^\w]*(\w+)[,\s]+(\d{4})/);
  if (!headerMatch) return { imported: 0, skipped: 0, error: 'unrecognized format — make sure you copied a month from the mood journal' };

  const monthIdx = MONTH_NAMES.findIndex(m => m.toLowerCase() === headerMatch[1].toLowerCase());
  const year = parseInt(headerMatch[2]);
  if (monthIdx === -1 || isNaN(year)) return { imported: 0, skipped: 0, error: 'could not parse the month/year from the text' };

  const month = monthIdx; // 0-indexed

  const afterHeader = text.split(/={10,}/)[1] || '';
  const blocks = afterHeader.split(/-{20,}/).map(b => b.trim()).filter(Boolean);

  let imported = 0;
  let skipped = 0;

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    const moodLineIdx = lines.findIndex(l => /^Mood:\s*\w+$/i.test(l));
    if (moodLineIdx < 0) { skipped++; continue; }

    const moodMatch = lines[moodLineIdx].match(/^Mood:\s*(\w+)$/i);
    const moodValue = MOOD_MAP[moodMatch[1]];
    if (!moodValue) { skipped++; continue; }

    const dateLine = lines[0];
    const dayMatch = dateLine.match(/(\d+)$/);
    if (!dayMatch) { skipped++; continue; }

    const dayNum = parseInt(dayMatch[1]);
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

    const note = lines.slice(moodLineIdx + 1).join('\n').trim() || null;

    const database = await getDatabase();
    const existing = await database.getFirstAsync('SELECT id FROM entries WHERE date = ?', [dateStr]);
    if (existing) { skipped++; continue; }

    await saveEntry(dateStr, moodValue, note, [], [], []);
    imported++;
  }

  return { imported, skipped };
}

export async function deleteEntry(date) {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM entries WHERE date = ?', [date]);
}

export async function getStreak() {
  const database = await getDatabase();
  const entries = await database.getAllAsync(
    'SELECT date FROM entries ORDER BY date DESC LIMIT 400'
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

export async function searchEntries(query) {
  const database = await getDatabase();
  const rows = await database.getAllAsync(
    "SELECT * FROM entries WHERE note LIKE ? OR tags LIKE ? ORDER BY date DESC LIMIT 50",
    [`%${query}%`, `%${query}%`]
  );
  return rows.map(e => {
    let tags = [];
    try { tags = JSON.parse(e.tags || '[]'); } catch {}
    return { ...e, tags };
  });
}

export async function getMoodInsights() {
  const database = await getDatabase();
  const all = await database.getAllAsync('SELECT date, mood FROM entries ORDER BY date ASC');
  if (!all.length) return null;

  const today = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateStr = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

  const d7 = new Date(today); d7.setDate(today.getDate() - 7);
  const d30 = new Date(today); d30.setDate(today.getDate() - 30);

  const last7 = all.filter(e => e.date > dateStr(d7));
  const last30 = all.filter(e => e.date > dateStr(d30));

  const avg = arr => arr.length ? Math.round((arr.reduce((s,v)=>s+v,0)/arr.length)*10)/10 : null;

  const dayMoods = [[], [], [], [], [], [], []];
  for (const e of all) {
    const dow = new Date(e.date + 'T00:00:00').getDay();
    dayMoods[dow].push(e.mood);
  }
  const dayAvgs = dayMoods.map(m => avg(m));

  const validIdxs = dayAvgs.map((v, i) => v !== null ? i : -1).filter(i => i >= 0);
  const bestDow = validIdxs.length ? validIdxs.reduce((b, i) => dayAvgs[i] > dayAvgs[b] ? i : b) : 0;
  const worstDow = validIdxs.length ? validIdxs.reduce((w, i) => dayAvgs[i] < dayAvgs[w] ? i : w) : 0;

  const dist = {1:0, 2:0, 3:0, 4:0, 5:0};
  for (const e of all) dist[e.mood] = (dist[e.mood] || 0) + 1;

  let bestStreak = 0, cur = 0, prev = null;
  for (const e of all) {
    if (!prev) { cur = 1; }
    else {
      const diff = Math.round((new Date(e.date+'T00:00:00') - new Date(prev+'T00:00:00')) / 86400000);
      cur = diff === 1 ? cur + 1 : 1;
    }
    if (cur > bestStreak) bestStreak = cur;
    prev = e.date;
  }

  const streak = await getStreak();

  return {
    total: all.length,
    avgAll: avg(all.map(e => e.mood)),
    avg7: avg(last7.map(e => e.mood)),
    avg30: avg(last30.map(e => e.mood)),
    logged7: last7.length,
    logged30: last30.length,
    dayAvgs,
    bestDow,
    worstDow,
    distribution: dist,
    bestStreak,
    currentStreak: streak,
  };
}
