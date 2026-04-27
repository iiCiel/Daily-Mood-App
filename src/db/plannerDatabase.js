import { getDatabase } from './database';

const DEFAULT_PROJECT_ID = 'default-project';
const DEFAULT_LIST_ID = 'focus-list';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function nowIso() {
  return new Date().toISOString();
}

function parsePriorities(entry) {
  let priorities = [];
  try { priorities = JSON.parse(entry.priorities || '[]'); } catch {}
  return { ...entry, priorities };
}

function normalizeTask(task) {
  if (!task) return null;
  return {
    ...task,
    completed: task.completed ? 1 : 0,
    target_pomodoros: task.target_pomodoros || 1,
  };
}

async function getListProject(db, listId) {
  if (!listId) return DEFAULT_PROJECT_ID;
  const row = await db.getFirstAsync('SELECT project_id FROM task_lists WHERE id = ?', [listId]);
  return row?.project_id || DEFAULT_PROJECT_ID;
}

export async function getPlannerEntry(date) {
  const db = await getDatabase();
  const entry = await db.getFirstAsync('SELECT * FROM planner_entries WHERE date = ?', [date]);
  return entry ? parsePriorities(entry) : null;
}

export async function savePlannerEntry(date, { intention, priorities, eveningNote, eveningRating }) {
  const db = await getDatabase();
  const existing = await db.getFirstAsync('SELECT id FROM planner_entries WHERE date = ?', [date]);
  const now = nowIso();
  const prioritiesJson = JSON.stringify(priorities || []);
  if (existing) {
    await db.runAsync(
      'UPDATE planner_entries SET intention = ?, priorities = ?, evening_note = ?, evening_rating = ?, updated_at = ? WHERE date = ?',
      [intention || null, prioritiesJson, eveningNote || null, eveningRating || null, now, date]
    );
  } else {
    await db.runAsync(
      'INSERT INTO planner_entries (id, date, intention, priorities, evening_note, evening_rating, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [genId(), date, intention || null, prioritiesJson, eveningNote || null, eveningRating || null, now, now]
    );
  }
}

export async function getRecentPlanner(n = 7) {
  const db = await getDatabase();
  const entries = await db.getAllAsync(
    'SELECT * FROM planner_entries ORDER BY date DESC LIMIT ?', [n]
  );
  return entries.map(parsePriorities);
}

export async function getProjects() {
  const db = await getDatabase();
  return db.getAllAsync(`
    SELECT p.*,
      COUNT(DISTINCT t.id) as task_count,
      SUM(CASE WHEN t.completed = 1 THEN 1 ELSE 0 END) as completed_count
    FROM projects p
    LEFT JOIN tasks t ON t.project_id = p.id
    WHERE p.archived = 0
    GROUP BY p.id
    ORDER BY CASE p.id WHEN ? THEN 0 ELSE 1 END, p.created_at ASC
  `, [DEFAULT_PROJECT_ID]);
}

export async function createProject({ name, color = '#4A7856', notes = '' }) {
  const db = await getDatabase();
  const id = genId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO projects (id, name, color, status, notes, archived, sync_status, created_at, updated_at)
     VALUES (?, ?, ?, 'active', ?, 0, 'local', ?, ?)`,
    [id, name.trim(), color, notes || null, now, now]
  );
  await createTaskList({ title: 'Tasks', projectId: id, color });
  return id;
}

export async function updateProject(id, { name, color, status, notes }) {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE projects
     SET name = ?, color = ?, status = ?, notes = ?, sync_status = 'pending', updated_at = ?
     WHERE id = ?`,
    [name.trim(), color, status || 'active', notes || null, nowIso(), id]
  );
}

export async function archiveProject(id) {
  if (id === DEFAULT_PROJECT_ID) return;
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE projects SET archived = 1, sync_status = 'pending', updated_at = ? WHERE id = ?",
    [nowIso(), id]
  );
}

export async function getTaskLists(projectId = null) {
  const db = await getDatabase();
  const params = [];
  let where = 'l.archived = 0 AND (p.archived = 0 OR p.id IS NULL)';
  if (projectId) {
    where += ' AND l.project_id = ?';
    params.push(projectId);
  }
  return db.getAllAsync(`
    SELECT l.*, p.name as project_name,
      COUNT(t.id) as task_count,
      SUM(CASE WHEN t.completed = 1 THEN 1 ELSE 0 END) as completed_count
    FROM task_lists l
    LEFT JOIN projects p ON p.id = l.project_id
    LEFT JOIN tasks t ON t.list_id = l.id
    WHERE ${where}
    GROUP BY l.id
    ORDER BY l.position ASC, l.created_at ASC
  `, params);
}

export async function createTaskList({ title, projectId = DEFAULT_PROJECT_ID, color = '#4A7856' }) {
  const db = await getDatabase();
  const pos = await db.getFirstAsync(
    'SELECT COALESCE(MAX(position), -1) + 1 as next_position FROM task_lists WHERE project_id = ?',
    [projectId]
  );
  const id = genId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO task_lists (id, project_id, title, color, position, archived, sync_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, 'local', ?, ?)`,
    [id, projectId, title.trim(), color, pos?.next_position || 0, now, now]
  );
  return id;
}

export async function updateTaskList(id, { title, projectId, color }) {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE task_lists
     SET title = ?, project_id = ?, color = ?, sync_status = 'pending', updated_at = ?
     WHERE id = ?`,
    [title.trim(), projectId || DEFAULT_PROJECT_ID, color || '#4A7856', nowIso(), id]
  );
}

export async function archiveTaskList(id) {
  if (id === DEFAULT_LIST_ID) return;
  const db = await getDatabase();
  await db.runAsync("UPDATE tasks SET list_id = ?, project_id = ?, sync_status = 'pending', updated_at = ? WHERE list_id = ?", [
    DEFAULT_LIST_ID,
    DEFAULT_PROJECT_ID,
    nowIso(),
    id,
  ]);
  await db.runAsync(
    "UPDATE task_lists SET archived = 1, sync_status = 'pending', updated_at = ? WHERE id = ?",
    [nowIso(), id]
  );
}

export async function getPlanningTasks({ listId = null, projectId = null, includeCompleted = true } = {}) {
  const db = await getDatabase();
  const params = [];
  const filters = ['(l.archived = 0 OR l.id IS NULL)', '(p.archived = 0 OR p.id IS NULL)'];
  if (listId) {
    filters.push('t.list_id = ?');
    params.push(listId);
  }
  if (projectId) {
    filters.push('t.project_id = ?');
    params.push(projectId);
  }
  if (!includeCompleted) filters.push('t.completed = 0');
  const rows = await db.getAllAsync(`
    SELECT t.*, l.title as list_title, l.color as list_color, p.name as project_name, p.color as project_color
    FROM tasks t
    LEFT JOIN task_lists l ON l.id = t.list_id
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE ${filters.join(' AND ')}
    ORDER BY t.completed ASC, CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date ASC, t.position ASC, t.created_at DESC
  `, params);
  return rows.map(normalizeTask);
}

export async function getTaskById(id) {
  const db = await getDatabase();
  const row = await db.getFirstAsync('SELECT * FROM tasks WHERE id = ?', [id]);
  return normalizeTask(row);
}

export async function createPlanningTask({
  title,
  listId = DEFAULT_LIST_ID,
  projectId = null,
  notes = '',
  dueDate = null,
  targetPomodoros = 1,
}) {
  const db = await getDatabase();
  const finalProjectId = projectId || await getListProject(db, listId);
  const pos = await db.getFirstAsync(
    'SELECT COALESCE(MAX(position), -1) + 1 as next_position FROM tasks WHERE list_id = ?',
    [listId]
  );
  const id = genId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO tasks
      (id, project_id, list_id, title, notes, due_date, completed, target_pomodoros, position, sync_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 'local', ?, ?)`,
    [
      id,
      finalProjectId,
      listId,
      title.trim(),
      notes || null,
      dueDate || null,
      Math.max(1, parseInt(targetPomodoros, 10) || 1),
      pos?.next_position || 0,
      now,
      now,
    ]
  );
  return id;
}

export async function updatePlanningTask(id, fields) {
  const db = await getDatabase();
  const existing = await getTaskById(id);
  if (!existing) return;
  const listId = fields.listId ?? existing.list_id ?? DEFAULT_LIST_ID;
  const projectId = fields.projectId ?? await getListProject(db, listId);
  await db.runAsync(
    `UPDATE tasks
     SET title = ?, notes = ?, due_date = ?, list_id = ?, project_id = ?, target_pomodoros = ?,
         sync_status = 'pending', updated_at = ?
     WHERE id = ?`,
    [
      (fields.title ?? existing.title).trim(),
      fields.notes ?? existing.notes ?? null,
      fields.dueDate ?? existing.due_date ?? null,
      listId,
      projectId,
      Math.max(1, parseInt(fields.targetPomodoros ?? existing.target_pomodoros, 10) || 1),
      nowIso(),
      id,
    ]
  );
}

export async function togglePlanningTask(id) {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE tasks
     SET completed = CASE WHEN completed = 1 THEN 0 ELSE 1 END,
         sync_status = 'pending',
         updated_at = ?
     WHERE id = ?`,
    [nowIso(), id]
  );
}

export async function deletePlanningTask(id) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM tasks WHERE id = ?', [id]);
}

export async function moveTask(id, direction) {
  const db = await getDatabase();
  const task = await db.getFirstAsync('SELECT id, list_id, position FROM tasks WHERE id = ?', [id]);
  if (!task) return;
  const operator = direction === 'up' ? '<' : '>';
  const order = direction === 'up' ? 'DESC' : 'ASC';
  const other = await db.getFirstAsync(
    `SELECT id, position FROM tasks WHERE list_id = ? AND position ${operator} ? ORDER BY position ${order} LIMIT 1`,
    [task.list_id, task.position || 0]
  );
  if (!other) return;
  const now = nowIso();
  await db.runAsync('UPDATE tasks SET position = ?, sync_status = ?, updated_at = ? WHERE id = ?', [
    other.position || 0,
    'pending',
    now,
    task.id,
  ]);
  await db.runAsync('UPDATE tasks SET position = ?, sync_status = ?, updated_at = ? WHERE id = ?', [
    task.position || 0,
    'pending',
    now,
    other.id,
  ]);
}

export async function setTaskOrder(listId, orderedIds = []) {
  if (!listId || !orderedIds.length) return;
  const db = await getDatabase();
  const now = nowIso();
  for (let i = 0; i < orderedIds.length; i++) {
    await db.runAsync(
      `UPDATE tasks
       SET position = ?, sync_status = 'pending', updated_at = ?
       WHERE id = ? AND list_id = ?`,
      [i, now, orderedIds[i], listId]
    );
  }
}

export async function getTodayPlan(date) {
  const db = await getDatabase();
  const tasks = await db.getAllAsync(`
    SELECT t.*, l.title as list_title, p.name as project_name
    FROM tasks t
    LEFT JOIN task_lists l ON l.id = t.list_id
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.completed = 0 AND t.due_date IS NOT NULL AND t.due_date <= ?
      AND (l.archived = 0 OR l.id IS NULL)
      AND (p.archived = 0 OR p.id IS NULL)
    ORDER BY t.due_date ASC, t.position ASC
  `, [date]);
  const events = await db.getAllAsync(`
    SELECT e.*, p.name as project_name, p.color as project_color
    FROM calendar_events e
    LEFT JOIN projects p ON p.id = e.project_id
    WHERE e.event_date = ? AND (p.archived = 0 OR p.id IS NULL)
    ORDER BY e.all_day DESC, e.start_at ASC, e.created_at ASC
  `, [date]);
  return { tasks: tasks.map(normalizeTask), events };
}

export async function getCalendarItemsForMonth(year, month) {
  const db = await getDatabase();
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const tasks = await db.getAllAsync(`
    SELECT t.*, l.title as list_title, p.name as project_name, p.color as project_color
    FROM tasks t
    LEFT JOIN task_lists l ON l.id = t.list_id
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.due_date LIKE ? || '%' AND (l.archived = 0 OR l.id IS NULL) AND (p.archived = 0 OR p.id IS NULL)
    ORDER BY t.due_date ASC, t.completed ASC, t.position ASC
  `, [prefix]);
  const events = await db.getAllAsync(`
    SELECT e.*, p.name as project_name, p.color as project_color
    FROM calendar_events e
    LEFT JOIN projects p ON p.id = e.project_id
    WHERE e.event_date LIKE ? || '%' AND (p.archived = 0 OR p.id IS NULL)
    ORDER BY e.event_date ASC, e.all_day DESC, e.start_at ASC
  `, [prefix]);
  return { tasks: tasks.map(normalizeTask), events };
}

export async function createCalendarEvent({
  title,
  projectId = DEFAULT_PROJECT_ID,
  eventDate,
  startAt = null,
  endAt = null,
  allDay = true,
  notes = '',
}) {
  const db = await getDatabase();
  const id = genId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO calendar_events
      (id, project_id, title, notes, event_date, start_at, end_at, all_day, sync_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'local', ?, ?)`,
    [id, projectId, title.trim(), notes || null, eventDate, startAt || null, endAt || null, allDay ? 1 : 0, now, now]
  );
  return id;
}

export async function deleteCalendarEvent(id) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM calendar_events WHERE id = ?', [id]);
}

export async function getAllPlannerEntries(limit = 2000) {
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    'SELECT * FROM planner_entries ORDER BY date DESC LIMIT ?',
    [limit]
  );
  return rows.map(parsePriorities);
}

export async function getPlanningSummary(date) {
  const db = await getDatabase();
  const row = await db.getFirstAsync(`
    SELECT
      (SELECT COUNT(*) FROM tasks WHERE completed = 0) as open_tasks,
      (SELECT COUNT(*) FROM tasks WHERE completed = 0 AND due_date IS NOT NULL AND due_date <= ?) as due_tasks,
      (SELECT COUNT(*) FROM calendar_events WHERE event_date = ?) as today_events,
      (SELECT COUNT(*) FROM projects WHERE archived = 0 AND status = 'active') as active_projects
  `, [date, date]);
  return {
    openTasks: row?.open_tasks || 0,
    dueTasks: row?.due_tasks || 0,
    todayEvents: row?.today_events || 0,
    activeProjects: row?.active_projects || 0,
  };
}
