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

    CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
    CREATE INDEX IF NOT EXISTS idx_photos_entry ON photos(entry_id);
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

export async function deleteEntry(id) {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM entries WHERE id = ?', [id]);
}

export async function getUnsyncedEntries() {
  const database = await getDatabase();
  return database.getAllAsync('SELECT * FROM entries WHERE synced = 0');
}

export async function markSynced(id) {
  const database = await getDatabase();
  await database.runAsync('UPDATE entries SET synced = 1 WHERE id = ?', [id]);
}
