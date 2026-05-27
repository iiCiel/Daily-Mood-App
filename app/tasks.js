import React, { useState, useCallback, useRef } from 'react';
import {
  Animated, View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../src/context/ThemeContext';
import AestheticBackground from '../src/components/AestheticBackground';
import {
  getTaskLists, createTaskList, archiveTaskList,
  getPlanningTasks, createPlanningTask, togglePlanningTask,
  deletePlanningTask, updatePlanningTask, updateTaskStatus,
} from '../src/db/plannerDatabase';

const LIST_COLORS = ['#4A7856', '#89B4D4', '#C5A8E8', '#F4A56A', '#F9C74F', '#6CC97C', '#D9713E'];

const STATUS_LABEL = { todo: 'Planning', doing: 'In Progress', waiting: 'Waiting', done: 'Done' };
const STATUS_ICON  = { todo: 'radio-button-off-outline', doing: 'ellipse', waiting: 'time-outline', done: 'checkmark-circle' };

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

// Mutually exclusive groups — each task appears in exactly one section.
function groupTasksToday(tasks, today) {
  const week7 = shiftDate(today, 7);

  // 1. Today & Overdue: due today or in the past
  const todayOverdue = tasks.filter(t => !t.completed && t.due_date && t.due_date <= today);

  // 2. In Progress: status='doing' but NOT already captured above
  const inProgress = tasks.filter(
    t => !t.completed && t.status === 'doing' && !(t.due_date && t.due_date <= today),
  );

  const placed = new Set([...todayOverdue, ...inProgress].map(t => t.id));

  // 3. This Week: due in the next 1–7 days
  const thisWeek = tasks.filter(
    t => !t.completed && !placed.has(t.id) && t.due_date && t.due_date > today && t.due_date <= week7,
  );
  thisWeek.forEach(t => placed.add(t.id));

  // 4. Backlog: everything remaining (no due date, or far future)
  const backlog = tasks.filter(t => !t.completed && !placed.has(t.id));

  // 5. Done: capped at 10 most recent
  const done = tasks.filter(t => !!t.completed).slice(0, 10);

  return { todayOverdue, inProgress, thisWeek, backlog, done };
}

export default function TasksScreen({ isTab = false }) {
  const C = useTheme();
  const today = todayStr();

  const [lists, setLists]               = useState([]);
  const [selectedListId, setSelectedListId] = useState('all');
  const [tasks, setTasks]               = useState([]);

  // Which collapsible sections are open (Today & In Progress are always open)
  const [expandedSections, setExpandedSections] = useState({
    thisWeek: false,
    backlog:  false,
    done:     false,
  });

  // Task whose status is being changed via the picker sheet
  const [statusPickerTask, setStatusPickerTask] = useState(null);

  const [showAdd,   setShowAdd]   = useState(false);
  const [addTitle,  setAddTitle]  = useState('');
  const [addListId, setAddListId] = useState('focus-list');
  const [addDue,    setAddDue]    = useState('');
  const [addNotes,  setAddNotes]  = useState('');
  const [addPoms,   setAddPoms]   = useState('1');
  const [saving,    setSaving]    = useState(false);

  const [editingTask, setEditingTask] = useState(null);
  const [editTitle,   setEditTitle]   = useState('');
  const [editListId,  setEditListId]  = useState('');
  const [editDue,     setEditDue]     = useState('');
  const [editNotes,   setEditNotes]   = useState('');
  const [editPoms,    setEditPoms]    = useState('1');

  const [showManage,    setShowManage]    = useState(false);
  const [newListName,   setNewListName]   = useState('');
  const [newListColor,  setNewListColor]  = useState(LIST_COLORS[0]);

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
    Alert.alert('Delete task', `"${task.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deletePlanningTask(task.id); await load(); } },
    ]);
  }

  async function handleAddTask() {
    if (!addTitle.trim()) { Alert.alert('Title required', ''); return; }
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
    } finally { setSaving(false); }
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

  function toggleSection(key) {
    Haptics.selectionAsync?.().catch(() => {});
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  const grouped    = groupTasksToday(tasks, today);
  const openTasks  = tasks.filter(t => !t.completed);
  const dueToday   = grouped.todayOverdue.length;
  const doneCount  = tasks.filter(t => !!t.completed).length;
  const selectedList = selectedListId === 'all' ? null : lists.find(l => l.id === selectedListId);
  const heroColor    = selectedList?.color || C.primary;

  // Shared section props
  const sectionHandlers = {
    selectedListId,
    onPress:             openEditTask,
    onToggle:            handleToggle,
    onDelete:            confirmDelete,
    onStatusChange:      handleStatusChange,
    onOpenStatusPicker:  setStatusPickerTask,
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.container, { backgroundColor: C.background }]}>
        <AestheticBackground />

        {/* ── Header ── */}
        <View style={s.header}>
          {!isTab && (
            <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
              <Text style={[s.back, { color: C.text }]}>←</Text>
            </TouchableOpacity>
          )}
          <Text style={[s.title, { color: C.text }]}>Tasks</Text>
          <View style={s.headerRight}>
            <TouchableOpacity
              style={[s.iconBtn, { backgroundColor: C.card }]}
              onPress={() => setShowManage(true)}
              activeOpacity={0.75}
            >
              <Ionicons name="folder-open-outline" size={18} color={C.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.addBtn, { backgroundColor: C.accent }]}
              onPress={() => setShowAdd(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={18} color={C.background} />
              <Text style={[s.addBtnText, { color: C.background }]}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Hero card ── */}
        <View style={[s.heroCard, { backgroundColor: heroColor }]}>
          <View style={s.heroGlow} />
          <View>
            <Text style={s.heroKicker}>{selectedList?.title || 'All lists'}</Text>
            <Text style={s.heroTitle}>{openTasks.length}</Text>
            <Text style={s.heroSub}>{openTasks.length === 1 ? 'open task' : 'open tasks'}</Text>
          </View>
          <View style={s.heroStats}>
            <View style={s.heroPill}>
              <Text style={s.heroPillValue}>{dueToday}</Text>
              <Text style={s.heroPillLabel}>due</Text>
            </View>
            <View style={s.heroPill}>
              <Text style={s.heroPillValue}>{doneCount}</Text>
              <Text style={s.heroPillLabel}>done</Text>
            </View>
          </View>
        </View>

        {/* ── List filter chips ── */}
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
              <Text style={[s.chipText, { color: selectedListId === list.id ? '#FFF' : C.textSecondary }]}>
                {list.title}
              </Text>
              {list.task_count > 0 && (
                <Text style={[s.chipCount, { color: selectedListId === list.id ? 'rgba(255,255,255,0.8)' : C.textSecondary }]}>
                  {' '}{list.task_count}
                </Text>
              )}
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[s.chip, { backgroundColor: C.card, borderStyle: 'dashed', borderColor: C.border }]}
            onPress={() => setShowManage(true)}
          >
            <Text style={[s.chipText, { color: C.textSecondary }]}>+ list</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.projectsLink} onPress={() => router.push('/projects')}>
            <Text style={[s.projectsLinkText, { color: C.accent }]}>Projects →</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* ── Today list ── */}
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Today & Overdue — always expanded */}
          <CollapsibleSection
            C={C}
            title="Today & Overdue"
            iconName="alert-circle"
            color={C.danger}
            tasks={grouped.todayOverdue}
            expanded
            alwaysExpanded
            empty="All clear for today 🎉"
            {...sectionHandlers}
          />

          {/* In Progress — only shown when non-empty, always expanded */}
          {grouped.inProgress.length > 0 && (
            <CollapsibleSection
              C={C}
              title="In Progress"
              iconName="ellipse"
              color={C.accent}
              tasks={grouped.inProgress}
              expanded
              alwaysExpanded
              empty=""
              {...sectionHandlers}
            />
          )}

          {/* This Week — collapsible */}
          <CollapsibleSection
            C={C}
            title="This Week"
            iconName="calendar-outline"
            color={C.primary}
            tasks={grouped.thisWeek}
            expanded={expandedSections.thisWeek}
            onToggleExpand={() => toggleSection('thisWeek')}
            empty="Nothing due this week."
            {...sectionHandlers}
          />

          {/* Backlog — collapsible */}
          <CollapsibleSection
            C={C}
            title="Backlog"
            iconName="archive-outline"
            color={C.teal || '#0D9488'}
            tasks={grouped.backlog}
            expanded={expandedSections.backlog}
            onToggleExpand={() => toggleSection('backlog')}
            empty="Backlog is empty."
            {...sectionHandlers}
          />

          {/* Done — collapsible, muted */}
          <CollapsibleSection
            C={C}
            title="Done"
            iconName="checkmark-circle"
            color={C.success}
            tasks={grouped.done}
            expanded={expandedSections.done}
            onToggleExpand={() => toggleSection('done')}
            empty="Nothing completed yet."
            muted
            {...sectionHandlers}
          />
        </ScrollView>

        {/* ── Status Picker Sheet ── */}
        <StatusPickerSheet
          visible={!!statusPickerTask}
          C={C}
          task={statusPickerTask}
          onClose={() => setStatusPickerTask(null)}
          onStatusChange={async (task, status) => {
            setStatusPickerTask(null);
            await handleStatusChange(task, status);
          }}
        />

        {/* ── Add Task Modal ── */}
        <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
          <View style={s.modalOverlay}>
            <View style={[s.modalSheet, { backgroundColor: C.card }]}>
              <View style={[s.modalHeader, { borderBottomColor: C.border }]}>
                <Text style={[s.modalTitle, { color: C.text }]}>New task</Text>
                <TouchableOpacity onPress={() => setShowAdd(false)}>
                  <Text style={[s.modalCancel, { color: C.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
                <TextInput
                  style={[s.input, { color: C.text, borderColor: C.border, backgroundColor: C.background }]}
                  placeholder="What needs to happen?"
                  placeholderTextColor={C.textSecondary}
                  value={addTitle}
                  onChangeText={setAddTitle}
                  autoFocus
                />

                <Text style={[s.fieldLabel, { color: C.textSecondary }]}>List</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                  {lists.map(list => (
                    <TouchableOpacity
                      key={list.id}
                      style={[s.listChip, { borderColor: list.color || C.border, backgroundColor: addListId === list.id ? (list.color || C.accent) : C.background }]}
                      onPress={() => setAddListId(list.id)}
                    >
                      <Text style={[s.listChipText, { color: addListId === list.id ? '#FFF' : C.textSecondary }]}>{list.title}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={[s.fieldLabel, { color: C.textSecondary }]}>Due date</Text>
                <View style={s.dueRow}>
                  {[['Today', today], ['Tomorrow', shiftDate(today, 1)], ['Next week', shiftDate(today, 7)], ['None', '']].map(([label, val]) => (
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
                  placeholder="Notes (optional)"
                  placeholderTextColor={C.textSecondary}
                  value={addNotes}
                  onChangeText={setAddNotes}
                  multiline
                />
                <View style={s.pomRow}>
                  <Text style={[s.fieldLabel, { color: C.textSecondary, marginBottom: 0 }]}>Focus blocks</Text>
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
                  <Text style={[s.saveBtnText, { color: C.background }]}>{saving ? 'Saving…' : 'Add task'}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ── Edit Task Modal ── */}
        <Modal visible={!!editingTask} transparent animationType="slide" onRequestClose={() => setEditingTask(null)}>
          <View style={s.modalOverlay}>
            <View style={[s.modalSheet, { backgroundColor: C.card }]}>
              <View style={[s.modalHeader, { borderBottomColor: C.border }]}>
                <Text style={[s.modalTitle, { color: C.text }]}>Edit task</Text>
                <TouchableOpacity onPress={() => setEditingTask(null)}>
                  <Text style={[s.modalCancel, { color: C.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
                <TextInput
                  style={[s.input, { color: C.text, borderColor: C.border, backgroundColor: C.background }]}
                  placeholder="Task title"
                  placeholderTextColor={C.textSecondary}
                  value={editTitle}
                  onChangeText={setEditTitle}
                />
                <Text style={[s.fieldLabel, { color: C.textSecondary }]}>List</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                  {lists.map(list => (
                    <TouchableOpacity
                      key={list.id}
                      style={[s.listChip, { borderColor: list.color || C.border, backgroundColor: editListId === list.id ? (list.color || C.accent) : C.background }]}
                      onPress={() => setEditListId(list.id)}
                    >
                      <Text style={[s.listChipText, { color: editListId === list.id ? '#FFF' : C.textSecondary }]}>{list.title}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Text style={[s.fieldLabel, { color: C.textSecondary }]}>Due date</Text>
                <View style={s.dueRow}>
                  {[['Today', today], ['Tomorrow', shiftDate(today, 1)], ['Next week', shiftDate(today, 7)], ['None', '']].map(([label, val]) => (
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
                  placeholder="Notes (optional)"
                  placeholderTextColor={C.textSecondary}
                  value={editNotes}
                  onChangeText={setEditNotes}
                  multiline
                />
                <View style={s.pomRow}>
                  <Text style={[s.fieldLabel, { color: C.textSecondary, marginBottom: 0 }]}>Focus blocks</Text>
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
                  <Text style={[s.saveBtnText, { color: C.background }]}>{saving ? 'Saving…' : 'Save task'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.deleteTaskBtn, { borderColor: C.danger }]}
                  onPress={() => { setEditingTask(null); confirmDelete(editingTask); }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trash-outline" size={15} color={C.danger} />
                  <Text style={[s.deleteTaskBtnText, { color: C.danger }]}>Delete task</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ── Manage Lists Modal ── */}
        <Modal visible={showManage} transparent animationType="slide" onRequestClose={() => setShowManage(false)}>
          <View style={s.modalOverlay}>
            <View style={[s.modalSheet, { backgroundColor: C.card }]}>
              <View style={[s.modalHeader, { borderBottomColor: C.border }]}>
                <Text style={[s.modalTitle, { color: C.text }]}>Manage lists</Text>
                <TouchableOpacity onPress={() => setShowManage(false)}>
                  <Text style={[s.modalCancel, { color: C.textSecondary }]}>Done</Text>
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
                {lists.map(list => (
                  <View key={list.id} style={[s.listManageRow, { borderBottomColor: C.border }]}>
                    <View style={[s.listDot, { backgroundColor: list.color || C.primary }]} />
                    <Text style={[s.listManageName, { color: C.text }]}>{list.title}</Text>
                    <Text style={[s.listManageCount, { color: C.textSecondary }]}>{list.task_count || 0}</Text>
                    {list.id !== 'focus-list' && (
                      <TouchableOpacity onPress={() => Alert.alert('Archive list', `Archive "${list.title}"? Tasks will be kept.`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Archive', style: 'destructive', onPress: async () => { await archiveTaskList(list.id); await load(); } },
                      ])}>
                        <Text style={[s.listManageArchive, { color: C.danger }]}>Archive</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <Text style={[s.fieldLabel, { color: C.textSecondary, marginTop: 16 }]}>New list</Text>
                <TextInput
                  style={[s.input, { color: C.text, borderColor: C.border, backgroundColor: C.background }]}
                  placeholder="List name"
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
                  <Text style={[s.saveBtnText, { color: C.background }]}>Create list</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

// ─────────────────────────────────────────────
// CollapsibleSection
// ─────────────────────────────────────────────
function CollapsibleSection({
  C, title, iconName, color, tasks, expanded, alwaysExpanded,
  empty, onToggleExpand, selectedListId, muted,
  onPress, onToggle, onDelete, onStatusChange, onOpenStatusPicker,
}) {
  // Animate maxHeight + opacity (no reanimated — useNativeDriver: false required for layout props)
  const anim = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.timing(anim, {
      toValue: expanded ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [expanded]);

  return (
    <View style={s.sectionBlock}>
      {/* Header row */}
      <TouchableOpacity
        style={[s.sectionHeader, { backgroundColor: `${color}10` }]}
        onPress={alwaysExpanded ? undefined : onToggleExpand}
        activeOpacity={alwaysExpanded ? 1 : 0.72}
        disabled={!!alwaysExpanded}
      >
        <View style={[s.sectionMark, { backgroundColor: color }]} />
        <Ionicons name={iconName} size={14} color={color} style={{ marginRight: 6 }} />
        <Text style={[s.sectionLabel, { color, flex: 1 }]}>{title}</Text>
        <View style={[s.sectionCountBadge, { backgroundColor: `${color}1C` }]}>
          <Text style={[s.sectionCountText, { color }]}>{tasks.length}</Text>
        </View>
        {!alwaysExpanded && (
          <Animated.View style={[
            s.chevronWrap,
            { transform: [{ rotate: anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] },
          ]}>
            <Ionicons name="chevron-down" size={15} color={color} />
          </Animated.View>
        )}
      </TouchableOpacity>

      {/* Body — collapses via maxHeight + opacity */}
      <Animated.View style={{
        maxHeight: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 2000] }),
        opacity:   anim,
        overflow: 'hidden',
      }}>
        <View style={s.sectionBody}>
          {tasks.length === 0 ? (
            <Text style={[s.emptyText, { color: C.textSecondary }]}>{empty}</Text>
          ) : (
            tasks.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                C={C}
                selectedListId={selectedListId}
                muted={muted}
                onPress={() => onPress(task)}
                onToggle={() => onToggle(task)}
                onLongPress={() => onDelete(task)}
                onStatusPillPress={() => onOpenStatusPicker?.(task)}
              />
            ))
          )}
        </View>
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────
// TaskRow
// ─────────────────────────────────────────────
function TaskRow({ task, C, selectedListId, onPress, onToggle, onLongPress, muted, onStatusPillPress }) {
  const due        = fmtDue(task.due_date);
  const isOverdue  = task.due_date && task.due_date < todayStr() && !task.completed;
  const accentColor = task.list_color || C.primary;
  const dueColor   = isOverdue ? C.danger : due === 'today' ? C.success : C.textSecondary;
  const dueBg      = isOverdue ? `${C.danger}18` : due === 'today' ? `${C.success}18` : `${C.border}80`;
  const status     = task.completed ? 'done' : (task.status || 'todo');

  const pillColors = { todo: C.textSecondary, doing: C.accent, waiting: C.primary, done: C.success };
  const pillColor  = pillColors[status] || C.textSecondary;

  return (
    <TouchableOpacity
      style={[s.taskCard, { backgroundColor: C.card, borderColor: C.border }, muted && { opacity: 0.68 }]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.72}
    >
      <View style={[s.taskAccent, { backgroundColor: task.completed ? C.border : accentColor }]} />

      <TouchableOpacity onPress={onToggle} hitSlop={12} style={s.circleWrap}>
        <View style={[
          s.circle,
          { borderColor: task.completed ? `${C.textSecondary}60` : accentColor },
          task.completed && { backgroundColor: `${accentColor}30` },
        ]}>
          {task.completed && <Ionicons name="checkmark" size={12} color={accentColor} />}
        </View>
      </TouchableOpacity>

      <View style={s.taskBody}>
        <Text
          style={[
            s.taskTitle,
            { color: task.completed ? C.textSecondary : C.text },
            task.completed && { textDecorationLine: 'line-through', opacity: 0.5 },
          ]}
          numberOfLines={2}
        >
          {task.title}
        </Text>

        {!!task.notes && (
          <Text style={[s.taskNotes, { color: C.textSecondary }]} numberOfLines={1}>{task.notes}</Text>
        )}

        {/* Due + list badges */}
        {(!task.completed && (!!due || (selectedListId === 'all' && !!task.list_title))) && (
          <View style={s.taskMetaRow}>
            {!!due && (
              <View style={[s.dueBadge, { backgroundColor: dueBg }]}>
                <Text style={[s.dueLabel, { color: dueColor }]}>{due}</Text>
              </View>
            )}
            {selectedListId === 'all' && !!task.list_title && (
              <View style={[s.listBadge, { backgroundColor: `${accentColor}18` }]}>
                <Text style={[s.listBadgeText, { color: accentColor }]} numberOfLines={1}>{task.list_title}</Text>
              </View>
            )}
          </View>
        )}

        {/* Status pill — tap to open status picker */}
        {!task.completed && (
          <TouchableOpacity
            style={[s.statusPill, { backgroundColor: `${pillColor}14` }]}
            onPress={onStatusPillPress}
            hitSlop={6}
            activeOpacity={0.75}
          >
            <Ionicons name={STATUS_ICON[status] || 'radio-button-off-outline'} size={9} color={pillColor} />
            <Text style={[s.statusPillText, { color: pillColor }]}>{STATUS_LABEL[status] || status}</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────
// StatusPickerSheet
// ─────────────────────────────────────────────
function StatusPickerSheet({ visible, C, task, onClose, onStatusChange }) {
  if (!task) return null;
  const currentStatus = task.completed ? 'done' : (task.status || 'todo');

  const tiles = [
    { key: 'todo',    icon: 'radio-button-off-outline', label: 'Planning',    color: C.textSecondary },
    { key: 'doing',   icon: 'ellipse',                  label: 'In Progress', color: C.accent },
    { key: 'waiting', icon: 'time-outline',             label: 'Waiting',     color: C.primary },
    { key: 'done',    icon: 'checkmark-circle',         label: 'Done',        color: C.success },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
        <View style={[s.statusSheet, { backgroundColor: C.card }]}>
          <View style={s.statusSheetHandle} />
          <Text style={[s.statusSheetTitle, { color: C.text }]} numberOfLines={2}>{task.title}</Text>
          <View style={s.statusTileGrid}>
            {tiles.map(tile => {
              const isActive = tile.key === currentStatus;
              return (
                <TouchableOpacity
                  key={tile.key}
                  style={[
                    s.statusTile,
                    {
                      backgroundColor: isActive ? `${tile.color}18` : C.background,
                      borderColor:     isActive ? tile.color : C.border,
                    },
                  ]}
                  onPress={() => { if (!isActive) onStatusChange(task, tile.key); else onClose(); }}
                  activeOpacity={0.75}
                >
                  <Ionicons name={tile.icon} size={24} color={tile.color} />
                  <Text style={[s.statusTileLabel, { color: isActive ? tile.color : C.text }]}>{tile.label}</Text>
                  {isActive && (
                    <Ionicons name="checkmark-circle" size={14} color={tile.color} style={{ position: 'absolute', top: 8, right: 8 }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const s = StyleSheet.create({
  container:   { flex: 1, position: 'relative' },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 58, paddingBottom: 12 },
  back:        { fontSize: 24, fontWeight: '800' },
  title:       { flex: 1, fontSize: 26, fontWeight: '900' },
  headerRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  iconBtn:     { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', elevation: 2 },
  addBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, elevation: 2 },
  addBtnText:  { fontSize: 13, fontWeight: '900' },

  heroCard: {
    marginHorizontal: 20, marginBottom: 14, borderRadius: 26,
    padding: 20, minHeight: 116, overflow: 'hidden',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 4,
  },
  heroGlow: { position: 'absolute', top: -42, right: -42, width: 156, height: 156, borderRadius: 78, backgroundColor: 'rgba(255,255,255,0.16)' },
  heroKicker:    { color: 'rgba(255,255,255,0.70)', fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  heroTitle:     { color: '#FFF', fontSize: 44, fontWeight: '900', marginTop: 2 },
  heroSub:       { color: 'rgba(255,255,255,0.86)', fontSize: 12, fontWeight: '800' },
  heroStats:     { flexDirection: 'row', gap: 8 },
  heroPill:      { minWidth: 56, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center' },
  heroPillValue: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  heroPillLabel: { color: 'rgba(255,255,255,0.72)', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },

  chipsWrap: { maxHeight: 58, flexGrow: 0 },
  chipsRow:  { paddingHorizontal: 16, paddingVertical: 8, gap: 8, flexDirection: 'row', alignItems: 'center' },
  chip:      { borderRadius: 999, paddingHorizontal: 15, paddingVertical: 9, borderWidth: 1, borderColor: 'transparent', flexDirection: 'row', alignItems: 'center', elevation: 1 },
  chipText:  { fontSize: 13, fontWeight: '800' },
  chipCount: { fontSize: 11, fontWeight: '700' },
  projectsLink:     { paddingHorizontal: 10, justifyContent: 'center' },
  projectsLinkText: { fontSize: 13, fontWeight: '900' },

  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 50, gap: 12 },

  // Section
  sectionBlock: {},
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
  },
  sectionMark: { width: 4, height: 18, borderRadius: 2, marginRight: 8 },
  sectionLabel: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionCountBadge: { minWidth: 24, height: 22, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  sectionCountText:  { fontSize: 11, fontWeight: '900' },
  chevronWrap: { marginLeft: 6 },
  sectionBody: { paddingTop: 6, gap: 0 },
  emptyText: { fontSize: 13, fontWeight: '600', textAlign: 'center', paddingVertical: 18, paddingHorizontal: 12, opacity: 0.7 },

  // Task card
  taskCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 18, marginBottom: 8, borderWidth: 1,
    elevation: 2, overflow: 'hidden', minHeight: 64,
    shadowColor: '#1A0A00', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  taskAccent:  { width: 4, alignSelf: 'stretch' },
  circleWrap:  { paddingHorizontal: 14 },
  circle:      { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  taskBody:    { flex: 1, paddingVertical: 12, paddingRight: 14 },
  taskTitle:   { fontSize: 15, fontWeight: '700', lineHeight: 21 },
  taskNotes:   { fontSize: 12, fontWeight: '400', marginTop: 2, opacity: 0.7 },
  taskMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' },
  dueBadge:    { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  dueLabel:    { fontSize: 11, fontWeight: '700' },
  listBadge:   { maxWidth: 120, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  listBadgeText: { fontSize: 11, fontWeight: '800' },

  // Status pill on each task row
  statusPill:     { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 6 },
  statusPillText: { fontSize: 10, fontWeight: '900' },

  // Status picker sheet
  statusSheet:       { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 32 },
  statusSheetHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#DDD', alignSelf: 'center', marginTop: 10, marginBottom: 16 },
  statusSheetTitle:  { fontSize: 16, fontWeight: '800', marginBottom: 16 },
  statusTileGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statusTile:        { width: '47%', borderRadius: 16, borderWidth: 1.5, padding: 16, alignItems: 'center', gap: 8 },
  statusTileLabel:   { fontSize: 13, fontWeight: '900' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet:   { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1 },
  modalTitle:   { fontSize: 17, fontWeight: '900' },
  modalCancel:  { fontSize: 13, fontWeight: '800' },
  modalContent: { padding: 18, paddingBottom: 40 },
  fieldLabel:   { fontSize: 11, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.3 },
  input:        { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 14 },
  listChip:     { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  listChipText: { fontSize: 13, fontWeight: '800' },
  dueRow:       { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  dueChip:      { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  dueChipText:  { fontSize: 12, fontWeight: '800' },
  pomRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  pomInput:     { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, fontWeight: '800', width: 70, textAlign: 'center' },
  saveBtn:      { borderRadius: 999, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  saveBtnText:  { fontSize: 15, fontWeight: '800' },
  deleteTaskBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 999, borderWidth: 1, paddingVertical: 13, marginTop: 10 },
  deleteTaskBtnText: { fontSize: 14, fontWeight: '800' },
  listManageRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1 },
  listDot:          { width: 12, height: 12, borderRadius: 6 },
  listManageName:   { flex: 1, fontSize: 15, fontWeight: '700' },
  listManageCount:  { fontSize: 13, fontWeight: '700' },
  listManageArchive: { fontSize: 12, fontWeight: '800' },
  colorRow:         { flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
  colorDot:         { width: 28, height: 28, borderRadius: 14 },
  colorDotSelected: { borderWidth: 3, borderColor: '#FFF', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
});
