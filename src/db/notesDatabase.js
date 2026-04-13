import { getDatabase } from './database';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export async function getNotes() {
  const db = await getDatabase();
  return db.getAllAsync('SELECT * FROM notes ORDER BY pinned DESC, updated_at DESC');
}

export async function saveNote(id, title, body, pinned = 0) {
  const db = await getDatabase();
  const now = new Date().toISOString();
  if (id) {
    await db.runAsync(
      'UPDATE notes SET title = ?, body = ?, pinned = ?, updated_at = ? WHERE id = ?',
      [title || '', body || '', pinned, now, id]
    );
    return id;
  }
  const newId = genId();
  await db.runAsync(
    'INSERT INTO notes (id, title, body, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [newId, title || '', body || '', pinned, now, now]
  );
  return newId;
}

export async function deleteNote(id) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM notes WHERE id = ?', [id]);
}

export async function togglePinNote(id, currentPinned) {
  const db = await getDatabase();
  await db.runAsync('UPDATE notes SET pinned = ?, updated_at = ? WHERE id = ?',
    [currentPinned ? 0 : 1, new Date().toISOString(), id]);
}

export async function searchNotes(query) {
  const db = await getDatabase();
  return db.getAllAsync(
    'SELECT * FROM notes WHERE title LIKE ? OR body LIKE ? ORDER BY pinned DESC, updated_at DESC LIMIT 30',
    [`%${query}%`, `%${query}%`]
  );
}
