import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase } from './database';

const UNIT_KEY = 'weight_unit';

export async function getWeightUnit() {
  const u = await AsyncStorage.getItem(UNIT_KEY);
  return u === 'lbs' ? 'lbs' : 'kg';
}

export async function saveWeightUnit(unit) {
  await AsyncStorage.setItem(UNIT_KEY, unit === 'lbs' ? 'lbs' : 'kg');
}

export async function getWeightEntry(date) {
  const db = await getDatabase();
  return db.getFirstAsync('SELECT * FROM weight_entries WHERE date = ?', [date]);
}

export async function getWeightEntries(limit = 90) {
  const db = await getDatabase();
  return db.getAllAsync(
    'SELECT * FROM weight_entries ORDER BY date DESC LIMIT ?',
    [limit]
  );
}

export async function saveWeightEntry({ date, weight, unit, note }) {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const existing = await getWeightEntry(date);

  if (existing) {
    await db.runAsync(
      'UPDATE weight_entries SET weight = ?, unit = ?, note = ?, updated_at = ? WHERE date = ?',
      [weight, unit, note || null, now, date]
    );
    return existing.id;
  }

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  await db.runAsync(
    'INSERT INTO weight_entries (id, date, weight, unit, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, date, weight, unit, note || null, now, now]
  );
  return id;
}

export async function deleteWeightEntry(id) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM weight_entries WHERE id = ?', [id]);
}

export async function getLatestWeight() {
  const db = await getDatabase();
  return db.getFirstAsync('SELECT * FROM weight_entries ORDER BY date DESC LIMIT 1');
}

export async function getWeightInsights(days = 30) {
  const db = await getDatabase();
  const entries = await db.getAllAsync(
    'SELECT * FROM weight_entries ORDER BY date DESC LIMIT ?',
    [days]
  );
  if (!entries.length) return null;

  const weights = entries.map((e) => e.weight);
  const latest = entries[0];
  const oldest = entries[entries.length - 1];
  const change = entries.length > 1
    ? Math.round((latest.weight - oldest.weight) * 10) / 10
    : 0;

  return {
    latest: latest.weight,
    unit: latest.unit,
    change,
    min: Math.min(...weights),
    max: Math.max(...weights),
    avg: Math.round((weights.reduce((a, b) => a + b, 0) / weights.length) * 10) / 10,
    count: entries.length,
    entries: [...entries].reverse(),
  };
}
