import { getDatabase } from './database';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export async function getPlannerEntry(date) {
  const db = await getDatabase();
  const entry = await db.getFirstAsync('SELECT * FROM planner_entries WHERE date = ?', [date]);
  if (!entry) return null;
  let priorities = [];
  try { priorities = JSON.parse(entry.priorities || '[]'); } catch {}
  return { ...entry, priorities };
}

export async function savePlannerEntry(date, { intention, priorities, eveningNote, eveningRating }) {
  const db = await getDatabase();
  const existing = await db.getFirstAsync('SELECT id FROM planner_entries WHERE date = ?', [date]);
  const now = new Date().toISOString();
  const prioritiesJson = JSON.stringify(priorities || []);
  if (existing) {
    await db.runAsync(
      'UPDATE planner_entries SET intention = ?, priorities = ?, evening_note = ?, evening_rating = ?, updated_at = ? WHERE date = ?',
      [intention || null, prioritiesJson, eveningNote || null, eveningRating || null, now, date]
    );
  } else {
    const id = genId();
    await db.runAsync(
      'INSERT INTO planner_entries (id, date, intention, priorities, evening_note, evening_rating, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, date, intention || null, prioritiesJson, eveningNote || null, eveningRating || null, now, now]
    );
  }
}

export async function getRecentPlanner(n = 7) {
  const db = await getDatabase();
  const entries = await db.getAllAsync(
    'SELECT * FROM planner_entries ORDER BY date DESC LIMIT ?', [n]
  );
  return entries.map(e => {
    let priorities = [];
    try { priorities = JSON.parse(e.priorities || '[]'); } catch {}
    return { ...e, priorities };
  });
}
