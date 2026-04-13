import { getDatabase } from './database';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export async function getGoals() {
  const db = await getDatabase();
  return db.getAllAsync('SELECT * FROM goals ORDER BY completed ASC, created_at DESC');
}

export async function createGoal({ title, category, targetValue, unit, deadline }) {
  const db = await getDatabase();
  const id = genId();
  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO goals (id, title, category, target_value, current_value, unit, deadline, completed, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?, 0, ?, ?)',
    [id, title, category || 'personal', targetValue || null, unit || null, deadline || null, now, now]
  );
  return id;
}

export async function updateGoal(id, { title, category, targetValue, unit, deadline }) {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE goals SET title = ?, category = ?, target_value = ?, unit = ?, deadline = ?, updated_at = ? WHERE id = ?',
    [title, category || 'personal', targetValue || null, unit || null, deadline || null, new Date().toISOString(), id]
  );
}

export async function updateGoalProgress(id, currentValue) {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE goals SET current_value = ?, updated_at = ? WHERE id = ?',
    [currentValue, new Date().toISOString(), id]
  );
}

export async function toggleGoalComplete(id, completed) {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE goals SET completed = ?, updated_at = ? WHERE id = ?',
    [completed ? 0 : 1, new Date().toISOString(), id]
  );
}

export async function deleteGoal(id) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM goals WHERE id = ?', [id]);
}
