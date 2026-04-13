import { getDatabase } from './database';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export async function saveSleep(date, bedtime, wakeTime, quality, note = '') {
  const db = await getDatabase();
  const existing = await db.getFirstAsync('SELECT id FROM sleep_entries WHERE date = ?', [date]);
  const now = new Date().toISOString();
  if (existing) {
    await db.runAsync(
      'UPDATE sleep_entries SET bedtime = ?, wake_time = ?, quality = ?, note = ? WHERE date = ?',
      [bedtime, wakeTime, quality, note, date]
    );
    return existing.id;
  }
  const id = genId();
  await db.runAsync(
    'INSERT INTO sleep_entries (id, date, bedtime, wake_time, quality, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, date, bedtime, wakeTime, quality, note, now]
  );
  return id;
}

export async function getSleepEntry(date) {
  const db = await getDatabase();
  return db.getFirstAsync('SELECT * FROM sleep_entries WHERE date = ?', [date]);
}

export async function getRecentSleep(n = 14) {
  const db = await getDatabase();
  return db.getAllAsync('SELECT * FROM sleep_entries ORDER BY date DESC LIMIT ?', [n]);
}

export async function deleteSleepEntry(date) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM sleep_entries WHERE date = ?', [date]);
}

// Returns duration in minutes between bedtime and wake_time strings "HH:MM"
export function calcDuration(bedtime, wakeTime) {
  if (!bedtime || !wakeTime) return null;
  const [bh, bm] = bedtime.split(':').map(Number);
  const [wh, wm] = wakeTime.split(':').map(Number);
  let mins = (wh * 60 + wm) - (bh * 60 + bm);
  if (mins < 0) mins += 24 * 60; // crossed midnight
  return mins;
}

export async function getSleepInsights() {
  const db = await getDatabase();
  const entries = await db.getAllAsync(
    'SELECT * FROM sleep_entries ORDER BY date DESC LIMIT 30'
  );
  if (entries.length < 2) return null;

  let totalMins = 0, durationCount = 0, qualitySum = 0, qualityCount = 0;
  for (const e of entries) {
    const d = calcDuration(e.bedtime, e.wake_time);
    if (d !== null) { totalMins += d; durationCount++; }
    if (e.quality) { qualitySum += e.quality; qualityCount++; }
  }

  const avgMins = durationCount > 0 ? Math.round(totalMins / durationCount) : 0;
  return {
    avgHours: Math.floor(avgMins / 60),
    avgMinsRemainder: avgMins % 60,
    avgQuality: qualityCount > 0 ? Math.round((qualitySum / qualityCount) * 10) / 10 : 0,
    totalLogged: entries.length,
  };
}
