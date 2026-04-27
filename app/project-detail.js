import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Modal,
} from 'react-native';
import { Stack, router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../src/context/ThemeContext';
import AestheticBackground from '../src/components/AestheticBackground';
import {
  getProjects, getTaskLists, getPlanningTasks,
  createPlanningTask, togglePlanningTask, deletePlanningTask, setTaskOrder,
  updateProject,
} from '../src/db/plannerDatabase';

const STATUSES = ['active', 'on hold', 'done'];
const STATUS_COLORS = { active: '#6CC97C', 'on hold': '#F9C74F', done: '#89B4D4' };

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftDate(s, days) {
  const d = new Date(s + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDue(dateStr) {
  if (!dateStr) return '';
  const today = todayStr();
  if (dateStr === today) return 'today';
  if (dateStr === shiftDate(today, 1)) return 'tomorrow';
  if (dateStr < today) return 'overdue';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ProjectDetailScreen() {
  const C = useTheme();
  const { id } = useLocalSearchParams();
  const today = todayStr();

  const [project, setProject] = useState(null);
  const [lists, setLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [reorderMode, setReorderMode] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addListId, setAddListId] = useState(null);
  const [addDue, setAddDue] = useState('');
  const [addNotes, setAddNotes] = useState('');
  const [addPoms, setAddPoms] = useState('1');
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => { load(); }, [id]));

  async function load() {
    const [allProjects, projectLists] = await Promise.all([
      getProjects(),
      getTaskLists(id),
    ]);
    const p = allProjects.find(x => x.id === id);
    setProject(p || null);
    setLists(projectLists);
    const firstList = projectLists[0];
    const listId = selectedListId || firstList?.id || null;
    if (!selectedListId && firstList) setSelectedListId(firstList.id);
    if (!addListId && firstList) setAddListId(firstList.id);
    const ts = await getPlanningTasks({ projectId: id, listId: listId !== 'all-lists' ? listId : null, includeCompleted: true });
    setTasks(ts);
  }

  async function selectList(lid) {
    setSelectedListId(lid);
    setReorderMode(false);
    const ts = await getPlanningTasks({ projectId: id, listId: lid !== 'all-lists' ? lid : null, includeCompleted: true });
    setTasks(ts);
  }

  async function handleToggle(task) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await togglePlanningTask(task.id);
    await load();
  }

  function confirmDelete(task) {
    Alert.alert('delete task', `"${task.title}"?`, [
      { text: 'cancel', style: 'cancel' },
      { text: 'delete', style: 'destructive', onPress: async () => { await deletePlanningTask(task.id); await load(); } },
    ]);
  }

  async function handleAdd() {
    if (!addTitle.trim()) { Alert.alert('title required', ''); return; }
    setSaving(true);
    try {
      await createPlanningTask({
        title: addTitle.trim(),
        listId: addListId || lists[0]?.id,
        projectId: id,
        dueDate: addDue || null,
        notes: addNotes,
        targetPomodoros: parseInt(addPoms) || 1,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAddTitle(''); setAddDue(''); setAddNotes(''); setAddPoms('1');
      setShowAdd(false);
      await load();
    } finally { setSaving(false); }
  }

  async function moveUp(task) {
    const incomplete = tasks.filter(t => !t.completed);
    const idx = incomplete.findIndex(t => t.id === task.id);
    if (idx <= 0) return;
    const next = [...incomplete];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    await setTaskOrder(task.list_id, next.map(t => t.id));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await load();
  }

  async function moveDown(task) {
    const incomplete = tasks.filter(t => !t.completed);
    const idx = incomplete.findIndex(t => t.id === task.id);
    if (idx >= incomplete.length - 1) return;
    const next = [...incomplete];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    await setTaskOrder(task.list_id, next.map(t => t.id));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await load();
  }

  const incomplete = tasks.filter(t => !t.completed);
  const done = tasks.filter(t => !!t.completed);
  const total = project?.task_count || 0;
  const completedCount = project?.completed_count || 0;
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.container, { backgroundColor: C.background }]}>
        <AestheticBackground />

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
            <Text style={[s.back, { color: C.text }]}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: C.text }]} numberOfLines={1}>{project?.name || '…'}</Text>
            {project?.notes ? <Text style={[s.subtitle, { color: C.textSecondary }]} numberOfLines={1}>{project.notes}</Text> : null}
          </View>
          <TouchableOpacity
            style={[s.statusBadge, { backgroundColor: STATUS_COLORS[project?.status || 'active'] + '25' }]}
            onPress={() => setShowStatusPicker(true)}
          >
            <Text style={[s.statusText, { color: STATUS_COLORS[project?.status || 'active'] }]}>{project?.status || 'active'}</Text>
          </TouchableOpacity>
        </View>

        <View style={[s.heroCard, { backgroundColor: project?.color || C.primary }]}>
          <View style={s.heroGlow} />
          <View style={{ flex: 1 }}>
            <Text style={s.heroKicker}>{project?.status || 'active'}</Text>
            <Text style={s.heroTitle}>{project?.name || 'project'}</Text>
            {project?.notes ? <Text style={s.heroSub} numberOfLines={2}>{project.notes}</Text> : <Text style={s.heroSub}>project workspace</Text>}
          </View>
          <View style={s.heroPill}>
            <Text style={s.heroPillValue}>{pct}%</Text>
            <Text style={s.heroPillLabel}>done</Text>
          </View>
        </View>

        {/* Progress bar */}
        {total > 0 && (
          <View style={[s.progressWrap, { backgroundColor: C.card }]}>
            <View style={[s.progressTrack, { backgroundColor: C.background }]}>
              <View style={[s.progressFill, { width: `${pct}%`, backgroundColor: project?.color || C.primary }]} />
            </View>
            <Text style={[s.progressLabel, { color: C.textSecondary }]}>{completedCount}/{total} tasks · {pct}%</Text>
          </View>
        )}

        {/* List chips + actions */}
        <View style={s.listBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.listChipsRow}>
            {lists.length > 1 && (
              <TouchableOpacity
                style={[s.listChip, { backgroundColor: C.card }, selectedListId === 'all-lists' && { backgroundColor: project?.color || C.accent }]}
                onPress={() => selectList('all-lists')}
              >
                <Text style={[s.listChipText, { color: selectedListId === 'all-lists' ? '#fff' : C.textSecondary }]}>All</Text>
              </TouchableOpacity>
            )}
            {lists.map(list => (
              <TouchableOpacity
                key={list.id}
                style={[s.listChip, { backgroundColor: C.card }, selectedListId === list.id && { backgroundColor: list.color || C.accent }]}
                onPress={() => selectList(list.id)}
              >
                <Text style={[s.listChipText, { color: selectedListId === list.id ? '#fff' : C.textSecondary }]}>{list.title}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={s.listActions}>
            {selectedListId && selectedListId !== 'all-lists' && (
              <TouchableOpacity style={[s.iconBtn, { backgroundColor: reorderMode ? C.accent : C.card }]} onPress={() => setReorderMode(r => !r)}>
                <Text style={{ fontSize: 13, color: reorderMode ? C.background : C.text }}>↕</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[s.addBtn, { backgroundColor: C.accent }]} onPress={() => setShowAdd(true)}>
              <Text style={[s.addBtnText, { color: C.background }]}>+ add</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          {incomplete.map(task => (
            <TaskRow key={task.id} task={task} C={C} today={today}
              reorderMode={reorderMode}
              onToggle={() => handleToggle(task)}
              onLongPress={() => Alert.alert(task.title, null, [
                { text: 'delete', style: 'destructive', onPress: () => confirmDelete(task) },
                { text: 'cancel', style: 'cancel' },
              ])}
              onMoveUp={() => moveUp(task)}
              onMoveDown={() => moveDown(task)}
            />
          ))}

          {done.length > 0 && (
            <TouchableOpacity onPress={() => setShowDone(d => !d)} style={s.doneToggle}>
              <Text style={[s.doneToggleText, { color: C.textSecondary }]}>{showDone ? '▲' : '▼'} {done.length} completed</Text>
            </TouchableOpacity>
          )}
          {showDone && done.map(task => (
            <TaskRow key={task.id} task={task} C={C} today={today}
              onToggle={() => handleToggle(task)}
              onLongPress={() => Alert.alert(task.title, null, [
                { text: 'delete', style: 'destructive', onPress: () => confirmDelete(task) },
                { text: 'cancel', style: 'cancel' },
              ])}
            />
          ))}

          {tasks.length === 0 && (
            <View style={s.empty}>
              <Text style={[s.emptyText, { color: C.textSecondary }]}>no tasks yet — tap + add</Text>
            </View>
          )}
        </ScrollView>

        {/* Add task modal */}
        <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
          <View style={s.overlay}>
            <View style={[s.sheet, { backgroundColor: C.card }]}>
              <View style={[s.sheetHeader, { borderBottomColor: C.border }]}>
                <Text style={[s.sheetTitle, { color: C.text }]}>new task</Text>
                <TouchableOpacity onPress={() => setShowAdd(false)}><Text style={[s.sheetCancel, { color: C.textSecondary }]}>cancel</Text></TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={s.sheetContent} keyboardShouldPersistTaps="handled">
                <TextInput style={[s.input, { color: C.text, borderColor: C.border, backgroundColor: C.background }]} placeholder="task title" placeholderTextColor={C.textSecondary} value={addTitle} onChangeText={setAddTitle} autoFocus />
                {lists.length > 1 && (
                  <>
                    <Text style={[s.label, { color: C.textSecondary }]}>list</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                      {lists.map(list => (
                        <TouchableOpacity key={list.id} style={[s.listChip, { marginRight: 8, borderColor: list.color || C.border, backgroundColor: addListId === list.id ? (list.color || C.accent) : C.background }]} onPress={() => setAddListId(list.id)}>
                          <Text style={[s.listChipText, { color: addListId === list.id ? '#fff' : C.textSecondary }]}>{list.title}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )}
                <Text style={[s.label, { color: C.textSecondary }]}>due date</Text>
                <View style={s.dueRow}>
                  {[['today', todayStr()], ['tomorrow', shiftDate(todayStr(), 1)], ['none', '']].map(([label, val]) => (
                    <TouchableOpacity key={label} style={[s.dueChip, { borderColor: C.border, backgroundColor: addDue === val ? C.accent : C.background }]} onPress={() => setAddDue(val)}>
                      <Text style={[s.dueChipText, { color: addDue === val ? C.background : C.textSecondary }]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput style={[s.input, { color: C.text, borderColor: C.border, backgroundColor: C.background }]} placeholder="notes (optional)" placeholderTextColor={C.textSecondary} value={addNotes} onChangeText={setAddNotes} multiline />
                <TouchableOpacity style={[s.saveBtn, { backgroundColor: C.accent }, saving && { opacity: 0.5 }]} onPress={handleAdd} disabled={saving}>
                  <Text style={[s.saveBtnText, { color: C.background }]}>{saving ? 'saving...' : 'add task'}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Status picker */}
        <Modal visible={showStatusPicker} transparent animationType="fade" onRequestClose={() => setShowStatusPicker(false)}>
          <TouchableOpacity style={s.overlay} onPress={() => setShowStatusPicker(false)} activeOpacity={1}>
            <View style={[s.statusSheet, { backgroundColor: C.card }]}>
              <Text style={[s.sheetTitle, { color: C.text, marginBottom: 16 }]}>project status</Text>
              {STATUSES.map(st => (
                <TouchableOpacity key={st} style={[s.statusOption, { borderColor: STATUS_COLORS[st] }]} onPress={async () => {
                  await updateProject(id, { name: project.name, color: project.color, status: st, notes: project.notes || '' });
                  setShowStatusPicker(false);
                  await load();
                }}>
                  <Text style={[s.statusOptionText, { color: STATUS_COLORS[st] }]}>{st}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </>
  );
}

function TaskRow({ task, C, today, reorderMode, onToggle, onLongPress, onMoveUp, onMoveDown }) {
  const due = fmtDue(task.due_date);
  const isOverdue = task.due_date && task.due_date < today && !task.completed;
  return (
    <TouchableOpacity style={[s.taskRow, { backgroundColor: C.card }]} onLongPress={onLongPress} activeOpacity={0.75}>
      <TouchableOpacity onPress={onToggle} hitSlop={8}>
        <View style={[s.check, { borderColor: task.completed ? C.success : C.border, backgroundColor: task.completed ? C.success : 'transparent' }]}>
          {task.completed && <Text style={s.checkMark}>✓</Text>}
        </View>
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={[s.taskTitle, { color: task.completed ? C.textSecondary : C.text }, task.completed && { textDecorationLine: 'line-through', opacity: 0.5 }]} numberOfLines={1}>{task.title}</Text>
        {task.notes ? <Text style={[s.taskNotes, { color: C.textSecondary }]} numberOfLines={1}>{task.notes}</Text> : null}
      </View>
      {!!due && !task.completed && (
        <View style={[s.duePill, { backgroundColor: isOverdue ? C.danger + '22' : C.primaryLight }]}>
          <Text style={[s.dueText, { color: isOverdue ? C.danger : C.primary }]}>{due}</Text>
        </View>
      )}
      {reorderMode && (
        <View style={{ flexDirection: 'row', gap: 2 }}>
          <TouchableOpacity onPress={onMoveUp} hitSlop={6}><Text style={[s.arrow, { color: C.primary }]}>↑</Text></TouchableOpacity>
          <TouchableOpacity onPress={onMoveDown} hitSlop={6}><Text style={[s.arrow, { color: C.primary }]}>↓</Text></TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, position: 'relative' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 58, paddingBottom: 12 },
  back: { fontSize: 24, fontWeight: '800' },
  title: { fontSize: 20, fontWeight: '900' },
  subtitle: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  heroCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 26,
    padding: 20,
    minHeight: 138,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    elevation: 4,
  },
  heroGlow: { position: 'absolute', top: -44, right: -44, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.14)' },
  heroKicker: { color: 'rgba(255,255,255,0.70)', fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  heroTitle: { color: '#FFFFFF', fontSize: 25, lineHeight: 30, fontWeight: '900', letterSpacing: 0, marginTop: 6 },
  heroSub: { color: 'rgba(255,255,255,0.86)', fontSize: 12, lineHeight: 17, fontWeight: '800', marginTop: 6 },
  heroPill: { width: 72, height: 72, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  heroPillValue: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  heroPillLabel: { color: 'rgba(255,255,255,0.72)', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  progressWrap: { marginHorizontal: 20, marginBottom: 10, borderRadius: 18, padding: 14, gap: 7, elevation: 2 },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  progressLabel: { fontSize: 11, fontWeight: '700' },
  listBar: { flexDirection: 'row', alignItems: 'center', paddingRight: 12 },
  listChipsRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  listChip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: 'transparent', elevation: 2 },
  listChipText: { fontSize: 13, fontWeight: '800' },
  listActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  iconBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', elevation: 1 },
  addBtn: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { fontSize: 13, fontWeight: '900' },
  content: { padding: 16, paddingTop: 8, paddingBottom: 50 },
  taskRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, padding: 13, marginBottom: 10, gap: 10, elevation: 3 },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '900' },
  taskTitle: { fontSize: 14, fontWeight: '700' },
  taskNotes: { fontSize: 11, marginTop: 2 },
  duePill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  dueText: { fontSize: 11, fontWeight: '800' },
  arrow: { fontSize: 20, fontWeight: '900', paddingHorizontal: 4 },
  doneToggle: { paddingVertical: 10, alignItems: 'center' },
  doneToggleText: { fontSize: 12, fontWeight: '800' },
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: 13, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1 },
  sheetTitle: { fontSize: 17, fontWeight: '900' },
  sheetCancel: { fontSize: 13, fontWeight: '800' },
  sheetContent: { padding: 18, paddingBottom: 40 },
  label: { fontSize: 11, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.3 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 14 },
  dueRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  dueChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  dueChipText: { fontSize: 12, fontWeight: '800' },
  saveBtn: { borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '800' },
  statusSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, gap: 12 },
  statusOption: { borderWidth: 1.5, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  statusOptionText: { fontSize: 15, fontWeight: '900' },
});
