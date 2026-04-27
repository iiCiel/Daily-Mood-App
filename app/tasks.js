import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Modal, Dimensions,
} from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../src/context/ThemeContext';
import {
  getTaskLists, createTaskList, archiveTaskList,
  getPlanningTasks, createPlanningTask, togglePlanningTask,
  deletePlanningTask, updatePlanningTask, setTaskOrder,
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
  const [viewMode, setViewMode] = useState('list');
  const [reorderMode, setReorderMode] = useState(false);
  const [showDone, setShowDone] = useState(false);

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

  const [showManage, setShowManage] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListColor, setNewListColor] = useState(LIST_COLORS[0]);

  useFocusEffect(useCallback(() => { load(); }, []));

  async function load() {
    const [ls, ts] = await Promise.all([
      getTaskLists(),
      getPlanningTasks({ listId: selectedListId === 'all' ? null : selectedListId, includeCompleted: true }),
    ]);
    setLists(ls);
    setTasks(ts);
    if (ls.length && addListId === 'focus-list' && !ls.find(l => l.id === 'focus-list')) {
      setAddListId(ls[0].id);
    }
  }

  async function selectList(id) {
    setSelectedListId(id);
    setReorderMode(false);
    const ts = await getPlanningTasks({ listId: id === 'all' ? null : id, includeCompleted: true });
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

  async function moveUp(task, group) {
    const idx = group.findIndex(t => t.id === task.id);
    if (idx <= 0) return;
    const next = [...group];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    await setTaskOrder(task.list_id, next.map(t => t.id));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await load();
  }

  async function moveDown(task, group) {
    const idx = group.findIndex(t => t.id === task.id);
    if (idx >= group.length - 1) return;
    const next = [...group];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    await setTaskOrder(task.list_id, next.map(t => t.id));
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

  // In "All" view: group incomplete tasks by list so you see each list as a section
  const listSections = selectedListId === 'all'
    ? Object.values(
        tasks
          .filter(t => !t.completed)
          .reduce((acc, t) => {
            const key = t.list_id || 'none';
            if (!acc[key]) acc[key] = { listId: t.list_id, listTitle: t.list_title || 'Tasks', listColor: t.list_color || null, tasks: [] };
            acc[key].tasks.push(t);
            return acc;
          }, {})
      )
    : null;

  const calGrid = buildCalGrid(calYear, calMonth);
  const calTaskMap = {};
  tasks.filter(t => t.due_date && !t.completed).forEach(t => {
    if (!calTaskMap[t.due_date]) calTaskMap[t.due_date] = [];
    calTaskMap[t.due_date].push(t);
  });
  const calDayTasks = calTaskMap[calSelected] || [];

  const sections = [
    { key: 'overdue', label: 'overdue', tasks: grouped.overdue, accent: C.danger },
    { key: 'today', label: 'today', tasks: grouped.today, accent: C.primary },
    { key: 'tomorrow', label: 'tomorrow', tasks: grouped.tomorrow, accent: C.primary },
    { key: 'thisWeek', label: 'this week', tasks: grouped.thisWeek, accent: C.textSecondary },
    { key: 'later', label: 'later', tasks: grouped.later, accent: C.textSecondary },
    { key: 'noDue', label: 'no due date', tasks: grouped.noDue, accent: C.textSecondary },
  ];

  const reorderGroup = selectedListId !== 'all' ? grouped.noDue.concat(grouped.later) : [];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.container, { backgroundColor: C.background }]}>

        {/* Header */}
        <View style={[s.header, { borderBottomColor: C.border }]}>
          {!isTab && (
            <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
              <Text style={[s.back, { color: C.text }]}>←</Text>
            </TouchableOpacity>
          )}
          <Text style={[s.title, { color: C.text }]}>tasks</Text>
          <View style={s.headerRight}>
            <TouchableOpacity
              style={[s.iconBtn, { backgroundColor: C.card }]}
              onPress={() => { setViewMode(v => v === 'list' ? 'calendar' : 'list'); setReorderMode(false); }}
              activeOpacity={0.75}
            >
              <Text style={{ fontSize: 14 }}>{viewMode === 'list' ? '📅' : '☰'}</Text>
            </TouchableOpacity>
            {viewMode === 'list' && selectedListId !== 'all' && (
              <TouchableOpacity
                style={[s.iconBtn, { backgroundColor: reorderMode ? C.accent : C.card }]}
                onPress={() => setReorderMode(r => !r)}
                activeOpacity={0.75}
              >
                <Text style={{ fontSize: 14, color: reorderMode ? C.background : C.text }}>↕</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[s.addBtn, { backgroundColor: C.accent }]}
              onPress={() => setShowAdd(true)}
              activeOpacity={0.8}
            >
              <Text style={[s.addBtnText, { color: C.background }]}>+ add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* List chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chipsRow}
          style={[s.chipsWrap, { borderBottomColor: C.border }]}
        >
          <TouchableOpacity
            style={[s.chip, selectedListId === 'all' && { backgroundColor: C.accent }]}
            onPress={() => selectList('all')}
          >
            <Text style={[s.chipText, { color: selectedListId === 'all' ? C.background : C.textSecondary }]}>All</Text>
          </TouchableOpacity>
          {lists.map(list => (
            <TouchableOpacity
              key={list.id}
              style={[s.chip, selectedListId === list.id && { backgroundColor: list.color || C.accent }]}
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
          <TouchableOpacity style={[s.chip, { borderStyle: 'dashed' }]} onPress={() => setShowManage(true)}>
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
          {/* --- LIST VIEW --- */}
          {viewMode === 'list' && (
            <>
              {selectedListId === 'all' ? (
                /* ALL VIEW: group by list — lets you see School → Math/Physics/CS all together */
                listSections && listSections.length > 0 ? listSections.map(group => (
                  <View key={group.listId || 'none'} style={s.section}>
                    <View style={s.sectionHeader}>
                      <View style={[s.sectionDot, { backgroundColor: group.listColor || C.primary }]} />
                      <Text style={[s.sectionLabel, { color: C.text }]}>{group.listTitle}</Text>
                      <Text style={[s.sectionCount, { color: C.textSecondary }]}>{group.tasks.length}</Text>
                    </View>
                    {group.tasks.map(task => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        C={C}
                        reorderMode={false}
                        selectedListId={selectedListId}
                        onToggle={() => handleToggle(task)}
                        onLongPress={() => Alert.alert(task.title, null, [
                          { text: 'delete', style: 'destructive', onPress: () => confirmDelete(task) },
                          { text: 'cancel', style: 'cancel' },
                        ])}
                      />

                    ))}
                  </View>
                )) : (
                  <View style={s.emptyState}>
                    <Text style={[s.emptyTitle, { color: C.text }]}>no tasks</Text>
                    <Text style={[s.emptySub, { color: C.textSecondary }]}>tap + add to get started</Text>
                  </View>
                )
              ) : (
                /* SPECIFIC LIST VIEW: group by due date */
                <>
                  {sections.map(sec => {
                    if (!sec.tasks.length) return null;
                    return (
                      <View key={sec.key} style={s.section}>
                        <View style={s.sectionHeader}>
                          <Text style={[s.sectionLabel, { color: sec.accent }]}>{sec.label}</Text>
                          <Text style={[s.sectionCount, { color: sec.accent }]}>{sec.tasks.length}</Text>
                        </View>
                        {sec.tasks.map(task => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            C={C}
                            reorderMode={reorderMode}
                            selectedListId={selectedListId}
                            group={sec.tasks}
                            onToggle={() => handleToggle(task)}
                            onLongPress={() => Alert.alert(task.title, null, [
                              { text: 'delete', style: 'destructive', onPress: () => confirmDelete(task) },
                              { text: 'cancel', style: 'cancel' },
                            ])}
                            onMoveUp={() => moveUp(task, sec.tasks)}
                            onMoveDown={() => moveDown(task, sec.tasks)}
                          />
                        ))}
                      </View>
                    );
                  })}
                  {tasks.filter(t => !t.completed).length === 0 && (
                    <View style={s.emptyState}>
                      <Text style={[s.emptyTitle, { color: C.text }]}>no tasks</Text>
                      <Text style={[s.emptySub, { color: C.textSecondary }]}>tap + add to get started</Text>
                    </View>
                  )}
                </>
              )}

              {grouped.done.length > 0 && (
                <TouchableOpacity onPress={() => setShowDone(d => !d)} style={s.doneToggle}>
                  <Text style={[s.doneToggleText, { color: C.textSecondary }]}>
                    {showDone ? '▲' : '▼'} {grouped.done.length} completed
                  </Text>
                </TouchableOpacity>
              )}
              {showDone && grouped.done.map(task => (
                <TaskRow key={task.id} task={task} C={C} selectedListId={selectedListId} onToggle={() => handleToggle(task)}
                  onLongPress={() => Alert.alert(task.title, null, [
                    { text: 'delete', style: 'destructive', onPress: () => confirmDelete(task) },
                    { text: 'cancel', style: 'cancel' },
                  ])}
                />
              ))}
            </>
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
      </View>
    </>
  );
}

function TaskRow({ task, C, reorderMode, selectedListId, onToggle, onLongPress, onMoveUp, onMoveDown }) {
  const due = fmtDue(task.due_date);
  const isOverdue = task.due_date && task.due_date < todayStr() && !task.completed;
  const accentColor = task.list_color || C.primary;
  const dueColor = isOverdue ? C.danger : due === 'today' ? C.success : C.textSecondary;
  const dueBg = isOverdue ? C.danger + '18' : due === 'today' ? C.success + '18' : C.border + '60';

  return (
    <TouchableOpacity
      style={[s.taskCard, { backgroundColor: C.card }]}
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
        {!!due && !task.completed && (
          <View style={[s.dueBadge, { backgroundColor: dueBg }]}>
            <Text style={[s.dueLabel, { color: dueColor }]}>{due}</Text>
          </View>
        )}
      </View>

      {reorderMode && (
        <View style={s.reorderBtns}>
          <TouchableOpacity onPress={onMoveUp} hitSlop={8}><Text style={[s.reorderArrow, { color: C.primary }]}>↑</Text></TouchableOpacity>
          <TouchableOpacity onPress={onMoveDown} hitSlop={8}><Text style={[s.reorderArrow, { color: C.primary }]}>↓</Text></TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 58, paddingBottom: 14, borderBottomWidth: 1 },
  back: { fontSize: 24, fontWeight: '800' },
  title: { flex: 1, fontSize: 24, fontWeight: '900' },
  headerRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  iconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', elevation: 1 },
  addBtn: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { fontSize: 13, fontWeight: '900' },
  chipsWrap: { borderBottomWidth: StyleSheet.hairlineWidth },
  chipsRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, flexDirection: 'row', alignItems: 'center' },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: 'transparent', backgroundColor: 'rgba(0,0,0,0.05)', flexDirection: 'row', alignItems: 'center', elevation: 0 },
  chipText: { fontSize: 13, fontWeight: '800' },
  chipCount: { fontSize: 11, fontWeight: '700' },
  projectsLink: { paddingHorizontal: 10 },
  projectsLinkText: { fontSize: 13, fontWeight: '900' },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 50 },
  section: { marginBottom: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 10 },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2, flex: 1 },
  sectionCount: { fontSize: 11, fontWeight: '700', opacity: 0.45, backgroundColor: 'rgba(0,0,0,0.06)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  taskCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, marginBottom: 8, elevation: 2, overflow: 'hidden', minHeight: 62 },
  taskAccent: { width: 4, alignSelf: 'stretch' },
  circleWrap: { paddingHorizontal: 14 },
  circle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  circleTick: { color: '#fff', fontSize: 12, fontWeight: '900' },
  taskBody: { flex: 1, paddingVertical: 14, paddingRight: 14 },
  taskTitle: { fontSize: 15, fontWeight: '600', lineHeight: 21 },
  taskNotes: { fontSize: 12, fontWeight: '400', marginTop: 3, opacity: 0.7 },
  dueBadge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  dueLabel: { fontSize: 11, fontWeight: '700' },
  reorderBtns: { flexDirection: 'row', gap: 2, paddingRight: 10 },
  reorderArrow: { fontSize: 20, fontWeight: '900', paddingHorizontal: 4 },
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
