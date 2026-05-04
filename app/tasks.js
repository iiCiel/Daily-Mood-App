import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Modal, Dimensions,
} from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../src/context/ThemeContext';
import AestheticBackground from '../src/components/AestheticBackground';
import TaskKanbanBoard from '../src/components/TaskKanbanBoard';
import {
  getTaskLists, createTaskList, archiveTaskList,
  getPlanningTasks, createPlanningTask, togglePlanningTask,
  deletePlanningTask, updatePlanningTask, updateTaskStatus,
} from '../src/db/plannerDatabase';

const { width: SCREEN_W } = Dimensions.get('window');
const CELL_W = Math.floor((SCREEN_W - 48) / 7);
const LIST_COLORS = ['#4A7856', '#89B4D4', '#C5A8E8', '#F4A56A', '#F9C74F', '#6CC97C', '#D9713E'];

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

function buildCalGrid(year, month) {
  const first = new Date(year, month - 1, 1);
  const grid = [];
  for (let i = 0; i < first.getDay(); i++) grid.push(null);
  const days = new Date(year, month, 0).getDate();
  for (let d = 1; d <= days; d++)
    grid.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

function groupTasks(tasks, today) {
  const tom = shiftDate(today, 1);
  const week = shiftDate(today, 7);
  return {
    overdue:  tasks.filter(t => !t.completed && t.due_date && t.due_date < today),
    today:    tasks.filter(t => !t.completed && t.due_date === today),
    tomorrow: tasks.filter(t => !t.completed && t.due_date === tom),
    thisWeek: tasks.filter(t => !t.completed && t.due_date > tom && t.due_date <= week),
    later:    tasks.filter(t => !t.completed && t.due_date && t.due_date > week),
    noDue:    tasks.filter(t => !t.completed && !t.due_date),
    done:     tasks.filter(t => !!t.completed),
  };
}

export default function TasksScreen({ isTab = false }) {
  const C = useTheme();
  const today = todayStr();
  const nowD = new Date();

  const [lists, setLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState('all');
  const [tasks, setTasks] = useState([]);
  const [viewMode, setViewMode] = useState('board');

  const [calYear, setCalYear] = useState(nowD.getFullYear());
  const [calMonth, setCalMonth] = useState(nowD.getMonth() + 1);
  const [calSelected, setCalSelected] = useState(today);

  const [showAdd, setShowAdd] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addListId, setAddListId] = useState('focus-list');
  const [addDue, setAddDue] = useState('');
  const [addNotes, setAddNotes] = useState('');
  const [addPoms, setAddPoms] = useState('1');
  const [saving, setSaving] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editListId, setEditListId] = useState('');
  const [editDue, setEditDue] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editPoms, setEditPoms] = useState('1');

  const [showManage, setShowManage] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListColor, setNewListColor] = useState(LIST_COLORS[0]);

  useFocusEffect(useCallback(() => { load(); }, []));

  async function load() {
    const [ls, ts] = await Promise.all([
      getTaskLists(),
      getPlanningTasks({ listId: selectedListId === 'all' ? null : selectedListId, includeCompleted: true, orderByPosition: true }),
    ]);
    setLists(ls);
    setTasks(ts);
    if (ls.length && addListId === 'focus-list' && !ls.find(l => l.id === 'focus-list')) {
      setAddListId(ls[0].id);
    }
  }

  async function selectList(id) {
    setSelectedListId(id);
    const ts = await getPlanningTasks({ listId: id === 'all' ? null : id, includeCompleted: true, orderByPosition: true });
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

  async function handleAddTask() {
    if (!addTitle.trim()) { Alert.alert('title required', ''); return; }
    setSaving(true);
    try {
      await createPlanningTask({
        title: addTitle.trim(),
        listId: addListId,
        dueDate: addDue || null,
        notes: addNotes || '',
        targetPomodoros: parseInt(addPoms) || 1,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAddTitle(''); setAddDue(''); setAddNotes(''); setAddPoms('1');
      setShowAdd(false);
      await load();
    } finally { setSaving(false); }
  }

  function openEditTask(task) {
    setEditingTask(task);
    setEditTitle(task.title || '');
    setEditListId(task.list_id || addListId || lists[0]?.id || 'focus-list');
    setEditDue(task.due_date || '');
    setEditNotes(task.notes || '');
    setEditPoms(String(task.target_pomodoros || 1));
  }

  async function handleSaveEdit() {
    if (!editingTask || !editTitle.trim()) return;
    setSaving(true);
    try {
      await updatePlanningTask(editingTask.id, {
        title: editTitle.trim(),
        listId: editListId,
        dueDate: editDue || null,
        notes: editNotes || '',
        targetPomodoros: parseInt(editPoms) || 1,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditingTask(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(task, status) {
    await updateTaskStatus(task.id, status);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await load();
  }

  async function handleCreateList() {
    if (!newListName.trim()) return;
    await createTaskList({ title: newListName.trim(), color: newListColor });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setNewListName('');
    await load();
  }

  const grouped = groupTasks(tasks, today);

  const calGrid = buildCalGrid(calYear, calMonth);
  const calTaskMap = {};
  tasks.filter(t => t.due_date && !t.completed).forEach(t => {
    if (!calTaskMap[t.due_date]) calTaskMap[t.due_date] = [];
    calTaskMap[t.due_date].push(t);
  });
  const calDayTasks = calTaskMap[calSelected] || [];

  const openTasks = tasks.filter(t => !t.completed);
  const dueToday = openTasks.filter(t => t.due_date && t.due_date <= today).length;
  const selectedList = selectedListId === 'all' ? null : lists.find(list => list.id === selectedListId);
  const heroColor = selectedList?.color || C.primary;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.container, { backgroundColor: C.background }]}>
        <AestheticBackground />

        {/* Header */}
        <View style={s.header}>
          {!isTab && (
            <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
              <Text style={[s.back, { color: C.text }]}>←</Text>
            </TouchableOpacity>
          )}
          <Text style={[s.title, { color: C.text }]}>tasks</Text>
          <View style={s.headerRight}>
            <TouchableOpacity
              style={[s.iconBtn, { backgroundColor: C.card }]}
              onPress={() => setViewMode(v => v === 'board' ? 'calendar' : 'board')}
              activeOpacity={0.75}
            >
              <Text style={{ fontSize: 14 }}>{viewMode === 'board' ? 'cal' : 'kan'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.addBtn, { backgroundColor: C.accent }]}
              onPress={() => setShowAdd(true)}
              activeOpacity={0.8}
            >
              <Text style={[s.addBtnText, { color: C.background }]}>+ add</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[s.heroCard, { backgroundColor: heroColor }]}>
          <View style={s.heroGlow} />
          <View>
            <Text style={s.heroKicker}>{selectedList?.title || 'all lists'}</Text>
            <Text style={s.heroTitle}>{openTasks.length}</Text>
            <Text style={s.heroSub}>{openTasks.length === 1 ? 'open task' : 'open tasks'}</Text>
          </View>
          <View style={s.heroStats}>
            <View style={s.heroPill}>
              <Text style={s.heroPillValue}>{dueToday}</Text>
              <Text style={s.heroPillLabel}>due</Text>
            </View>
            <View style={s.heroPill}>
              <Text style={s.heroPillValue}>{grouped.done.length}</Text>
              <Text style={s.heroPillLabel}>done</Text>
            </View>
          </View>
        </View>

        {/* List chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chipsRow}
          style={s.chipsWrap}
        >
          <TouchableOpacity
            style={[s.chip, { backgroundColor: C.card }, selectedListId === 'all' && { backgroundColor: C.accent }]}
            onPress={() => selectList('all')}
          >
            <Text style={[s.chipText, { color: selectedListId === 'all' ? C.background : C.textSecondary }]}>All</Text>
          </TouchableOpacity>
          {lists.map(list => (
            <TouchableOpacity
              key={list.id}
              style={[s.chip, { backgroundColor: C.card }, selectedListId === list.id && { backgroundColor: list.color || C.accent }]}
              onPress={() => selectList(list.id)}
            >
              <Text style={[s.chipText, { color: selectedListId === list.id ? '#FFFFFF' : C.textSecondary }]}>
                {list.title}
              </Text>
              {list.task_count > 0 && (
                <Text style={[s.chipCount, { color: selectedListId === list.id ? 'rgba(255,255,255,0.8)' : C.textSecondary }]}>
                  {' '}{list.task_count}
                </Text>
              )}
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[s.chip, { backgroundColor: C.card, borderStyle: 'dashed', borderColor: C.border }]} onPress={() => setShowManage(true)}>
            <Text style={[s.chipText, { color: C.textSecondary }]}>+ list</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.projectsLink} onPress={() => router.push('/projects')}>
            <Text style={[s.projectsLinkText, { color: C.accent }]}>Projects →</Text>
          </TouchableOpacity>
        </ScrollView>

        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* --- BOARD VIEW --- */}
          {viewMode !== 'calendar' && (
            <TaskKanbanBoard
              tasks={tasks}
              C={C}
              showList={selectedListId === 'all'}
              emptyText="drop work here"
              onPress={openEditTask}
              onToggle={handleToggle}
              onDelete={confirmDelete}
              onStatusChange={handleStatusChange}
            />
          )}

          {/* --- CALENDAR VIEW --- */}
          {viewMode === 'calendar' && (
            <>
              <View style={[s.calCard, { backgroundColor: C.card }]}>
                <View style={s.calNavRow}>
                  <TouchableOpacity onPress={() => { const d = new Date(calYear, calMonth - 2, 1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth() + 1); }} hitSlop={10}>
                    <Text style={[s.calNavBtn, { color: C.text }]}>‹</Text>
                  </TouchableOpacity>
                  <Text style={[s.calMonthLabel, { color: C.text }]}>
                    {new Date(calYear, calMonth - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toLowerCase()}
                  </Text>
                  <TouchableOpacity onPress={() => { const d = new Date(calYear, calMonth, 1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth() + 1); }} hitSlop={10}>
                    <Text style={[s.calNavBtn, { color: C.text }]}>›</Text>
                  </TouchableOpacity>
                </View>

                <View style={s.calDowRow}>
                  {['S','M','T','W','T','F','S'].map((d, i) => (
                    <Text key={i} style={[s.calDow, { color: C.textSecondary, width: CELL_W }]}>{d}</Text>
                  ))}
                </View>

                <View style={s.calGrid}>
                  {calGrid.map((date, i) => {
                    if (!date) return <View key={i} style={{ width: CELL_W, height: 44 }} />;
                    const isToday = date === today;
                    const isSelected = date === calSelected;
                    const dotTasks = calTaskMap[date] || [];
                    return (
                      <TouchableOpacity
                        key={date}
                        style={[
                          s.calCell,
                          { width: CELL_W, height: 44 },
                          isSelected && { backgroundColor: C.accent, borderRadius: 10 },
                          !isSelected && isToday && { borderWidth: 1, borderColor: C.accent, borderRadius: 10 },
                        ]}
                        onPress={() => setCalSelected(date)}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.calDayNum, { color: isSelected ? C.background : C.text }]}>
                          {parseInt(date.slice(8))}
                        </Text>
                        {dotTasks.length > 0 && (
                          <View style={s.calDots}>
                            {dotTasks.slice(0, 3).map((t, di) => (
                              <View key={di} style={[s.calDot, { backgroundColor: isSelected ? C.background : (lists.find(l => l.id === t.list_id)?.color || C.primary) }]} />
                            ))}
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {calDayTasks.length > 0 ? (
                <View style={s.section}>
                  <Text style={[s.sectionLabel, { color: C.primary }]}>
                    {calSelected === today ? 'today' : new Date(calSelected + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toLowerCase()}
                  </Text>
                  {calDayTasks.map(task => (
                    <TaskRow key={task.id} task={task} C={C} selectedListId={selectedListId} onToggle={() => handleToggle(task)}
                      onPress={() => openEditTask(task)}
                      onLongPress={() => Alert.alert(task.title, null, [
                        { text: 'delete', style: 'destructive', onPress: () => confirmDelete(task) },
                        { text: 'cancel', style: 'cancel' },
                      ])}
                    />
                  ))}
                </View>
              ) : (
                <Text style={[s.emptySub, { color: C.textSecondary, textAlign: 'center', marginTop: 16 }]}>
                  no tasks due on this day
                </Text>
              )}
            </>
          )}
        </ScrollView>

        {/* --- ADD TASK MODAL --- */}
        <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
          <View style={s.modalOverlay}>
            <View style={[s.modalSheet, { backgroundColor: C.card }]}>
              <View style={[s.modalHeader, { borderBottomColor: C.border }]}>
                <Text style={[s.modalTitle, { color: C.text }]}>new task</Text>
                <TouchableOpacity onPress={() => setShowAdd(false)}>
                  <Text style={[s.modalCancel, { color: C.textSecondary }]}>cancel</Text>
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
                <TextInput
                  style={[s.input, { color: C.text, borderColor: C.border, backgroundColor: C.background }]}
                  placeholder="task title"
                  placeholderTextColor={C.textSecondary}
                  value={addTitle}
                  onChangeText={setAddTitle}
                  autoFocus
                />

                <Text style={[s.fieldLabel, { color: C.textSecondary }]}>list</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                  {lists.map(list => (
                    <TouchableOpacity
                      key={list.id}
                      style={[s.listChip, { borderColor: list.color || C.border, backgroundColor: addListId === list.id ? (list.color || C.accent) : C.background }]}
                      onPress={() => setAddListId(list.id)}
                    >
                      <Text style={[s.listChipText, { color: addListId === list.id ? '#fff' : C.textSecondary }]}>{list.title}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={[s.fieldLabel, { color: C.textSecondary }]}>due date</Text>
                <View style={s.dueRow}>
                  {[['today', today], ['tomorrow', shiftDate(today, 1)], ['next week', shiftDate(today, 7)], ['none', '']].map(([label, val]) => (
                    <TouchableOpacity
                      key={label}
                      style={[s.dueChip, { borderColor: C.border, backgroundColor: addDue === val ? C.accent : C.background }]}
                      onPress={() => setAddDue(val)}
                    >
                      <Text style={[s.dueChipText, { color: addDue === val ? C.background : C.textSecondary }]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={[s.input, { color: C.text, borderColor: C.border, backgroundColor: C.background }]}
                  placeholder="or type YYYY-MM-DD"
                  placeholderTextColor={C.textSecondary}
                  value={addDue}
                  onChangeText={setAddDue}
                />

                <TextInput
                  style={[s.input, { color: C.text, borderColor: C.border, backgroundColor: C.background }]}
                  placeholder="notes (optional)"
                  placeholderTextColor={C.textSecondary}
                  value={addNotes}
                  onChangeText={setAddNotes}
                  multiline
                />

                <View style={s.pomRow}>
                  <Text style={[s.fieldLabel, { color: C.textSecondary, marginBottom: 0 }]}>pomodoros target</Text>
                  <TextInput
                    style={[s.pomInput, { color: C.text, borderColor: C.border, backgroundColor: C.background }]}
                    value={addPoms}
                    onChangeText={setAddPoms}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>

                <TouchableOpacity
                  style={[s.saveBtn, { backgroundColor: C.accent }, saving && { opacity: 0.5 }]}
                  onPress={handleAddTask}
                  disabled={saving}
                  activeOpacity={0.8}
                >
                  <Text style={[s.saveBtnText, { color: C.background }]}>{saving ? 'saving...' : 'add task'}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* --- MANAGE LISTS MODAL --- */}
        <Modal visible={showManage} transparent animationType="slide" onRequestClose={() => setShowManage(false)}>
          <View style={s.modalOverlay}>
            <View style={[s.modalSheet, { backgroundColor: C.card }]}>
              <View style={[s.modalHeader, { borderBottomColor: C.border }]}>
                <Text style={[s.modalTitle, { color: C.text }]}>manage lists</Text>
                <TouchableOpacity onPress={() => setShowManage(false)}>
                  <Text style={[s.modalCancel, { color: C.textSecondary }]}>done</Text>
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
                {lists.map(list => (
                  <View key={list.id} style={[s.listManageRow, { borderBottomColor: C.border }]}>
                    <View style={[s.listDot, { backgroundColor: list.color || C.primary }]} />
                    <Text style={[s.listManageName, { color: C.text }]}>{list.title}</Text>
                    <Text style={[s.listManageCount, { color: C.textSecondary }]}>{list.task_count || 0}</Text>
                    {list.id !== 'focus-list' && (
                      <TouchableOpacity onPress={() => Alert.alert('archive list', `archive "${list.title}"? tasks will be kept.`, [
                        { text: 'cancel', style: 'cancel' },
                        { text: 'archive', style: 'destructive', onPress: async () => { await archiveTaskList(list.id); await load(); } },
                      ])}>
                        <Text style={[s.listManageArchive, { color: C.danger }]}>archive</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                <Text style={[s.fieldLabel, { color: C.textSecondary, marginTop: 16 }]}>new list</Text>
                <TextInput
                  style={[s.input, { color: C.text, borderColor: C.border, backgroundColor: C.background }]}
                  placeholder="list name"
                  placeholderTextColor={C.textSecondary}
                  value={newListName}
                  onChangeText={setNewListName}
                />
                <View style={s.colorRow}>
                  {LIST_COLORS.map(c => (
                    <TouchableOpacity key={c} style={[s.colorDot, { backgroundColor: c }, newListColor === c && s.colorDotSelected]} onPress={() => setNewListColor(c)} />
                  ))}
                </View>
                <TouchableOpacity style={[s.saveBtn, { backgroundColor: C.accent }]} onPress={handleCreateList} activeOpacity={0.8}>
                  <Text style={[s.saveBtnText, { color: C.background }]}>create list</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* --- EDIT TASK MODAL --- */}
        <Modal visible={!!editingTask} transparent animationType="slide" onRequestClose={() => setEditingTask(null)}>
          <View style={s.modalOverlay}>
            <View style={[s.modalSheet, { backgroundColor: C.card }]}>
              <View style={[s.modalHeader, { borderBottomColor: C.border }]}>
                <Text style={[s.modalTitle, { color: C.text }]}>edit task</Text>
                <TouchableOpacity onPress={() => setEditingTask(null)}>
                  <Text style={[s.modalCancel, { color: C.textSecondary }]}>cancel</Text>
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
                <TextInput
                  style={[s.input, { color: C.text, borderColor: C.border, backgroundColor: C.background }]}
                  placeholder="task title"
                  placeholderTextColor={C.textSecondary}
                  value={editTitle}
                  onChangeText={setEditTitle}
                />

                <Text style={[s.fieldLabel, { color: C.textSecondary }]}>list</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                  {lists.map(list => (
                    <TouchableOpacity
                      key={list.id}
                      style={[s.listChip, { borderColor: list.color || C.border, backgroundColor: editListId === list.id ? (list.color || C.accent) : C.background }]}
                      onPress={() => setEditListId(list.id)}
                    >
                      <Text style={[s.listChipText, { color: editListId === list.id ? '#fff' : C.textSecondary }]}>{list.title}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={[s.fieldLabel, { color: C.textSecondary }]}>due date</Text>
                <View style={s.dueRow}>
                  {[['today', today], ['tomorrow', shiftDate(today, 1)], ['next week', shiftDate(today, 7)], ['none', '']].map(([label, val]) => (
                    <TouchableOpacity
                      key={label}
                      style={[s.dueChip, { borderColor: C.border, backgroundColor: editDue === val ? C.accent : C.background }]}
                      onPress={() => setEditDue(val)}
                    >
                      <Text style={[s.dueChipText, { color: editDue === val ? C.background : C.textSecondary }]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={[s.input, { color: C.text, borderColor: C.border, backgroundColor: C.background }]}
                  placeholder="or type YYYY-MM-DD"
                  placeholderTextColor={C.textSecondary}
                  value={editDue}
                  onChangeText={setEditDue}
                />

                <TextInput
                  style={[s.input, { color: C.text, borderColor: C.border, backgroundColor: C.background }]}
                  placeholder="notes (optional)"
                  placeholderTextColor={C.textSecondary}
                  value={editNotes}
                  onChangeText={setEditNotes}
                  multiline
                />

                <View style={s.pomRow}>
                  <Text style={[s.fieldLabel, { color: C.textSecondary, marginBottom: 0 }]}>pomodoros target</Text>
                  <TextInput
                    style={[s.pomInput, { color: C.text, borderColor: C.border, backgroundColor: C.background }]}
                    value={editPoms}
                    onChangeText={setEditPoms}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>

                <TouchableOpacity
                  style={[s.saveBtn, { backgroundColor: C.accent }, saving && { opacity: 0.5 }]}
                  onPress={handleSaveEdit}
                  disabled={saving}
                  activeOpacity={0.8}
                >
                  <Text style={[s.saveBtnText, { color: C.background }]}>{saving ? 'saving...' : 'save task'}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

function TaskRow({ task, C, selectedListId, onPress, onToggle, onLongPress, dragEnabled, dragHandlers, isDragging }) {
  const due = fmtDue(task.due_date);
  const isOverdue = task.due_date && task.due_date < todayStr() && !task.completed;
  const accentColor = task.list_color || C.primary;
  const dueColor = isOverdue ? C.danger : due === 'today' ? C.success : C.textSecondary;
  const dueBg = isOverdue ? C.danger + '18' : due === 'today' ? C.success + '18' : C.border + '60';

  return (
    <TouchableOpacity
      style={[
        s.taskCard,
        { backgroundColor: C.card, borderColor: isDragging ? accentColor : C.border },
        isDragging && s.taskCardDragging,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <View style={[s.taskAccent, { backgroundColor: task.completed ? C.border : accentColor }]} />

      <TouchableOpacity onPress={onToggle} hitSlop={12} style={s.circleWrap}>
        <View style={[
          s.circle,
          { borderColor: task.completed ? C.textSecondary + '80' : accentColor },
          task.completed && { backgroundColor: accentColor + '35' },
        ]}>
          {task.completed && <Text style={[s.circleTick, { color: accentColor }]}>✓</Text>}
        </View>
      </TouchableOpacity>

      <View style={s.taskBody}>
        <Text
          style={[s.taskTitle, { color: task.completed ? C.textSecondary : C.text },
            task.completed && { textDecorationLine: 'line-through', opacity: 0.5 }]}
          numberOfLines={2}
        >
          {task.title}
        </Text>
        {!!task.notes && (
          <Text style={[s.taskNotes, { color: C.textSecondary }]} numberOfLines={1}>{task.notes}</Text>
        )}
        {(!!due || (selectedListId === 'all' && !!task.list_title)) && !task.completed && (
          <View style={s.taskMetaRow}>
            {!!due && (
              <View style={[s.dueBadge, { backgroundColor: dueBg }]}>
                <Text style={[s.dueLabel, { color: dueColor }]}>{due}</Text>
              </View>
            )}
            {selectedListId === 'all' && !!task.list_title && (
              <View style={[s.listBadge, { backgroundColor: accentColor + '18' }]}>
                <Text style={[s.listBadgeText, { color: accentColor }]} numberOfLines={1}>{task.list_title}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {dragEnabled && (
        <View {...dragHandlers} style={s.dragHandle}>
          <Text style={[s.dragHandleText, { color: C.textSecondary }]}>☰</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, position: 'relative' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 58, paddingBottom: 12 },
  back: { fontSize: 24, fontWeight: '800' },
  title: { flex: 1, fontSize: 24, fontWeight: '900' },
  headerRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', elevation: 2 },
  addBtn: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, elevation: 2 },
  addBtnText: { fontSize: 13, fontWeight: '900' },
  heroCard: {
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 26,
    padding: 20,
    minHeight: 132,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 4,
  },
  heroGlow: {
    position: 'absolute',
    top: -42,
    right: -42,
    width: 156,
    height: 156,
    borderRadius: 78,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroKicker: { color: 'rgba(255,255,255,0.70)', fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  heroTitle: { color: '#FFFFFF', fontSize: 44, fontWeight: '900', letterSpacing: 0, marginTop: 4 },
  heroSub: { color: 'rgba(255,255,255,0.86)', fontSize: 12, fontWeight: '800' },
  heroStats: { flexDirection: 'row', gap: 8 },
  heroPill: {
    minWidth: 58,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
  },
  heroPillValue: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  heroPillLabel: { color: 'rgba(255,255,255,0.72)', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  chipsWrap: { maxHeight: 58, flexGrow: 0 },
  chipsRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, flexDirection: 'row', alignItems: 'center' },
  chip: { borderRadius: 999, paddingHorizontal: 15, paddingVertical: 9, borderWidth: 1, borderColor: 'transparent', flexDirection: 'row', alignItems: 'center', elevation: 2 },
  chipText: { fontSize: 13, fontWeight: '800' },
  chipCount: { fontSize: 11, fontWeight: '700' },
  projectsLink: { paddingHorizontal: 10, justifyContent: 'center' },
  projectsLinkText: { fontSize: 13, fontWeight: '900' },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 50 },
  section: { marginBottom: 10 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    elevation: 1,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2, flex: 1 },
  sectionCount: { fontSize: 11, fontWeight: '800', opacity: 0.55, backgroundColor: 'rgba(0,0,0,0.06)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9 },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    marginBottom: 10,
    borderWidth: 1,
    elevation: 4,
    overflow: 'hidden',
    minHeight: 66,
    shadowColor: '#1A0A00',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  taskCardDragging: {
    opacity: 0.96,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    transform: [{ scale: 1.01 }],
  },
  taskAccent: { width: 5, alignSelf: 'stretch' },
  circleWrap: { paddingHorizontal: 15 },
  circle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  circleTick: { color: '#fff', fontSize: 12, fontWeight: '900' },
  taskBody: { flex: 1, paddingVertical: 14, paddingRight: 8 },
  taskTitle: { fontSize: 15, fontWeight: '600', lineHeight: 21 },
  taskNotes: { fontSize: 12, fontWeight: '400', marginTop: 3, opacity: 0.7 },
  taskMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  dueBadge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  dueLabel: { fontSize: 11, fontWeight: '700' },
  listBadge: { maxWidth: 120, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  listBadgeText: { fontSize: 11, fontWeight: '800' },
  dragHandle: {
    alignSelf: 'stretch',
    width: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandleText: { fontSize: 20, fontWeight: '900', lineHeight: 22 },
  doneToggle: { paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  doneToggleText: { fontSize: 12, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingTop: 70, gap: 10 },
  emptyTitle: { fontSize: 20, fontWeight: '900' },
  emptySub: { fontSize: 13, fontWeight: '600', opacity: 0.6 },
  calCard: { borderRadius: 22, padding: 16, marginBottom: 16, elevation: 2 },
  calNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  calNavBtn: { fontSize: 26, fontWeight: '700', paddingHorizontal: 8 },
  calMonthLabel: { fontSize: 15, fontWeight: '900' },
  calDowRow: { flexDirection: 'row', marginBottom: 4 },
  calDow: { textAlign: 'center', fontSize: 11, fontWeight: '700' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { alignItems: 'center', justifyContent: 'center', paddingTop: 4 },
  calDayNum: { fontSize: 13, fontWeight: '700' },
  calDots: { flexDirection: 'row', gap: 2, marginTop: 2 },
  calDot: { width: 4, height: 4, borderRadius: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: '900' },
  modalCancel: { fontSize: 13, fontWeight: '800' },
  modalContent: { padding: 18, paddingBottom: 40 },
  fieldLabel: { fontSize: 11, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.3 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 14 },
  listChip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  listChipText: { fontSize: 13, fontWeight: '800' },
  dueRow: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  dueChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  dueChipText: { fontSize: 12, fontWeight: '800' },
  pomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  pomInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, fontWeight: '800', width: 70, textAlign: 'center' },
  saveBtn: { borderRadius: 999, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  saveBtnText: { fontSize: 15, fontWeight: '800' },
  listManageRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1 },
  listDot: { width: 12, height: 12, borderRadius: 6 },
  listManageName: { flex: 1, fontSize: 15, fontWeight: '700' },
  listManageCount: { fontSize: 13, fontWeight: '700' },
  listManageArchive: { fontSize: 12, fontWeight: '800' },
  colorRow: { flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  colorDotSelected: { borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
});
