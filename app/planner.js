import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../src/context/ThemeContext';
import {
  archiveProject,
  archiveTaskList,
  createCalendarEvent,
  createPlanningTask,
  createProject,
  createTaskList,
  deleteCalendarEvent,
  deletePlanningTask,
  getCalendarItemsForMonth,
  getPlannerEntry,
  getPlanningTasks,
  getProjects,
  getTaskLists,
  getTodayPlan,
  savePlannerEntry,
  setTaskOrder,
  togglePlanningTask,
} from '../src/db/plannerDatabase';

const TABS = ['today', 'lists', 'projects', 'calendar'];
const PROJECT_COLORS = ['#4A7856', '#6CC97C', '#89B4D4', '#C5A8E8', '#F4A56A', '#F9C74F'];

function dateStr(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function monthLabel(year, month) {
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toLowerCase();
}

function buildMonthDays(year, month) {
  const first = new Date(year, month - 1, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = [];
  for (let i = 0; i < startDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function shortDate(value) {
  if (!value) return '';
  const d = new Date(`${value}T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase();
}

function reorderItems(items, fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return items;
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export default function PlannerScreen() {
  const C = useTheme();
  const today = dateStr();
  const now = new Date();

  const [activeTab, setActiveTab] = useState('today');
  const [projects, setProjects] = useState([]);
  const [lists, setLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [dragState, setDragState] = useState(null);
  const [todayPlan, setTodayPlan] = useState({ tasks: [], events: [] });
  const [dailyEntry, setDailyEntry] = useState(null);

  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [taskNotes, setTaskNotes] = useState('');
  const [taskTarget, setTaskTarget] = useState('1');

  const [projectName, setProjectName] = useState('');
  const [projectNotes, setProjectNotes] = useState('');
  const [projectColor, setProjectColor] = useState(PROJECT_COLORS[0]);

  const [listTitle, setListTitle] = useState('');
  const [listProjectId, setListProjectId] = useState('default-project');

  const [intention, setIntention] = useState('');
  const [priorityText, setPriorityText] = useState('');

  const [calCursor, setCalCursor] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [calendarItems, setCalendarItems] = useState({ tasks: [], events: [] });
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState(today);
  const [eventStart, setEventStart] = useState('');
  const [eventEnd, setEventEnd] = useState('');
  const [eventProjectId, setEventProjectId] = useState('default-project');
  const dragStartYRef = useRef(0);

  useFocusEffect(useCallback(() => { loadBase(); }, []));

  useEffect(() => {
    if (selectedListId) loadTasks(selectedListId);
  }, [selectedListId]);

  useEffect(() => {
    loadCalendar();
  }, [calCursor.year, calCursor.month]);

  async function loadBase() {
    const [nextProjects, nextLists, nextToday, entry] = await Promise.all([
      getProjects(),
      getTaskLists(),
      getTodayPlan(today),
      getPlannerEntry(today),
    ]);
    setProjects(nextProjects);
    setLists(nextLists);
    setTodayPlan(nextToday);
    setDailyEntry(entry);
    setIntention(entry?.intention || '');
    setPriorityText((entry?.priorities || []).join('\n'));
    if (!selectedListId && nextLists[0]) setSelectedListId(nextLists[0].id);
    if (!listProjectId && nextProjects[0]) setListProjectId(nextProjects[0].id);
    if (!eventProjectId && nextProjects[0]) setEventProjectId(nextProjects[0].id);
    await loadCalendar();
  }

  async function loadTasks(listId = selectedListId) {
    if (!listId) return;
    setTasks(await getPlanningTasks({ listId, includeCompleted: true }));
  }

  async function loadCalendar() {
    setCalendarItems(await getCalendarItemsForMonth(calCursor.year, calCursor.month));
  }

  async function refreshPlanning() {
    const [nextProjects, nextLists, nextToday] = await Promise.all([
      getProjects(),
      getTaskLists(),
      getTodayPlan(today),
    ]);
    setProjects(nextProjects);
    setLists(nextLists);
    setTodayPlan(nextToday);
    if (selectedListId) await loadTasks(selectedListId);
    await loadCalendar();
  }

  async function addTask() {
    if (!taskTitle.trim() || !selectedListId) return;
    await createPlanningTask({
      title: taskTitle,
      listId: selectedListId,
      notes: taskNotes,
      dueDate: taskDue.trim() || null,
      targetPomodoros: taskTarget,
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTaskTitle('');
    setTaskDue('');
    setTaskNotes('');
    setTaskTarget('1');
    await refreshPlanning();
  }

  async function addProject() {
    if (!projectName.trim()) return;
    const id = await createProject({ name: projectName, color: projectColor, notes: projectNotes });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setProjectName('');
    setProjectNotes('');
    setProjectColor(PROJECT_COLORS[0]);
    setListProjectId(id);
    setEventProjectId(id);
    await refreshPlanning();
  }

  async function addList() {
    if (!listTitle.trim()) return;
    const id = await createTaskList({ title: listTitle, projectId: listProjectId, color: projectColor });
    setListTitle('');
    setSelectedListId(id);
    await refreshPlanning();
  }

  async function addEvent() {
    if (!eventTitle.trim() || !eventDate.trim()) return;
    await createCalendarEvent({
      title: eventTitle,
      projectId: eventProjectId,
      eventDate,
      startAt: eventStart.trim() || null,
      endAt: eventEnd.trim() || null,
      allDay: !eventStart.trim(),
    });
    setEventTitle('');
    setEventStart('');
    setEventEnd('');
    await refreshPlanning();
  }

  async function saveDailyNote() {
    await savePlannerEntry(today, {
      intention,
      priorities: priorityText.split('\n').map((p) => p.trim()).filter(Boolean),
      eveningNote: dailyEntry?.evening_note || '',
      eveningRating: dailyEntry?.evening_rating || null,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDailyEntry(await getPlannerEntry(today));
  }

  async function toggleTask(id) {
    await togglePlanningTask(id);
    await refreshPlanning();
  }

  async function removeTask(id) {
    await deletePlanningTask(id);
    await refreshPlanning();
  }

  function beginDrag(taskId, index, pageY) {
    dragStartYRef.current = pageY || 0;
    setDragState({ taskId, fromIndex: index, toIndex: index });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function updateDrag(pageY) {
    setDragState((state) => {
      if (!state) return state;
      const delta = Math.round(((pageY || dragStartYRef.current) - dragStartYRef.current) / 74);
      const toIndex = Math.max(0, Math.min(tasks.length - 1, state.fromIndex + delta));
      return toIndex === state.toIndex ? state : { ...state, toIndex };
    });
  }

  async function finishDrag() {
    const state = dragState;
    setDragState(null);
    if (!state || state.fromIndex === state.toIndex || !selectedListId) return;
    const next = reorderItems(tasks, state.fromIndex, state.toIndex);
    setTasks(next);
    await setTaskOrder(selectedListId, next.map((task) => task.id));
    await refreshPlanning();
  }

  const selectedList = lists.find((list) => list.id === selectedListId);
  const displayTasks = dragState ? reorderItems(tasks, dragState.fromIndex, dragState.toIndex) : tasks;
  const days = useMemo(() => buildMonthDays(calCursor.year, calCursor.month), [calCursor]);
  const itemsByDate = useMemo(() => {
    const map = {};
    for (const task of calendarItems.tasks) {
      if (!map[task.due_date]) map[task.due_date] = { tasks: [], events: [] };
      map[task.due_date].tasks.push(task);
    }
    for (const event of calendarItems.events) {
      if (!map[event.event_date]) map[event.event_date] = { tasks: [], events: [] };
      map[event.event_date].events.push(event);
    }
    return map;
  }, [calendarItems]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView style={[s.flex, { backgroundColor: C.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={s.flex} contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={s.header}>
            <TouchableOpacity onPress={() => router.back()} style={[s.iconBtn, { backgroundColor: C.card }]}>
              <Text style={[s.iconBtnText, { color: C.text }]}>‹</Text>
            </TouchableOpacity>
            <View style={s.headerCopy}>
              <Text style={[s.title, { color: C.text }]}>planning hub</Text>
              <Text style={[s.dateLabel, { color: C.textSecondary }]}>
                {todayPlan.tasks.length} due · {todayPlan.events.length} events today
              </Text>
            </View>
          </View>

          <View style={[s.tabs, { backgroundColor: C.card }]}>
            {TABS.map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[s.tab, activeTab === tab && { backgroundColor: C.primary }]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[s.tabText, { color: activeTab === tab ? '#fff' : C.textSecondary }]}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeTab === 'today' && (
            <View style={s.stack}>
              <View style={[s.hero, { backgroundColor: C.primary }]}>
                <Text style={s.heroKicker}>TODAY</Text>
                <Text style={s.heroTitle}>{todayPlan.tasks.length + todayPlan.events.length}</Text>
                <Text style={s.heroSub}>open items in your day plan</Text>
              </View>

              <Panel C={C} title="daily note">
                <TextInput
                  style={[s.textArea, { color: C.text, borderColor: C.border }]}
                  placeholder="main intention..."
                  placeholderTextColor={C.textSecondary}
                  value={intention}
                  onChangeText={setIntention}
                  multiline
                />
                <TextInput
                  style={[s.textArea, { color: C.text, borderColor: C.border, minHeight: 74 }]}
                  placeholder="priorities, one per line..."
                  placeholderTextColor={C.textSecondary}
                  value={priorityText}
                  onChangeText={setPriorityText}
                  multiline
                />
                <ActionButton C={C} label="save note" onPress={saveDailyNote} />
              </Panel>

              <Panel C={C} title="due now">
                {todayPlan.tasks.length === 0 ? <Empty C={C} text="no due tasks" /> : todayPlan.tasks.map((task) => (
                  <TaskRow key={task.id} C={C} task={task} onToggle={toggleTask} onDelete={removeTask} />
                ))}
              </Panel>

              <Panel C={C} title="events">
                {todayPlan.events.length === 0 ? <Empty C={C} text="no events today" /> : todayPlan.events.map((event) => (
                  <EventRow key={event.id} C={C} event={event} onDelete={async () => { await deleteCalendarEvent(event.id); await refreshPlanning(); }} />
                ))}
              </Panel>
            </View>
          )}

          {activeTab === 'lists' && (
            <View style={s.stack}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.listChips}>
                {lists.map((list) => (
                  <TouchableOpacity
                    key={list.id}
                    style={[s.chip, { backgroundColor: selectedListId === list.id ? C.primary : C.card }]}
                    onPress={() => setSelectedListId(list.id)}
                  >
                    <Text style={[s.chipText, { color: selectedListId === list.id ? '#fff' : C.text }]}>{list.title}</Text>
                    <Text style={[s.chipMeta, { color: selectedListId === list.id ? 'rgba(255,255,255,0.75)' : C.textSecondary }]}>
                      {(list.task_count || 0) - (list.completed_count || 0)} open
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Panel C={C} title={`add to ${selectedList?.title || 'list'}`}>
                <TextInput style={[s.input, { color: C.text, borderColor: C.border }]} placeholder="task title..." placeholderTextColor={C.textSecondary} value={taskTitle} onChangeText={setTaskTitle} />
                <View style={s.row}>
                  <TextInput style={[s.input, s.rowInput, { color: C.text, borderColor: C.border }]} placeholder="due YYYY-MM-DD" placeholderTextColor={C.textSecondary} value={taskDue} onChangeText={setTaskDue} />
                  <TextInput style={[s.input, s.targetInput, { color: C.text, borderColor: C.border }]} placeholder="◉" placeholderTextColor={C.textSecondary} value={taskTarget} onChangeText={setTaskTarget} keyboardType="number-pad" />
                </View>
                <TextInput style={[s.textArea, { color: C.text, borderColor: C.border }]} placeholder="notes..." placeholderTextColor={C.textSecondary} value={taskNotes} onChangeText={setTaskNotes} multiline />
                <ActionButton C={C} label="add task" onPress={addTask} />
              </Panel>

              <Panel C={C} title="tasks">
                {displayTasks.length === 0 ? <Empty C={C} text="no tasks in this list" /> : displayTasks.map((task, index) => (
                  <TaskRow
                    key={task.id}
                    C={C}
                    task={task}
                    onToggle={toggleTask}
                    onDelete={removeTask}
                    draggable
                    isDragging={dragState?.taskId === task.id}
                    onDragStart={(pageY) => beginDrag(task.id, index, pageY)}
                    onDragMove={updateDrag}
                    onDragEnd={finishDrag}
                  />
                ))}
              </Panel>

              <Panel C={C} title="new list">
                <TextInput style={[s.input, { color: C.text, borderColor: C.border }]} placeholder="list name..." placeholderTextColor={C.textSecondary} value={listTitle} onChangeText={setListTitle} />
                <ProjectPicker C={C} projects={projects} value={listProjectId} onChange={setListProjectId} />
                <View style={s.row}>
                  <ActionButton C={C} label="create list" onPress={addList} />
                  {selectedListId !== 'focus-list' && (
                    <TouchableOpacity style={[s.secondaryBtn, { borderColor: C.border }]} onPress={() => Alert.alert('archive list', 'move tasks to Focus and hide this list?', [
                      { text: 'cancel', style: 'cancel' },
                      { text: 'archive', style: 'destructive', onPress: async () => { await archiveTaskList(selectedListId); setSelectedListId('focus-list'); await refreshPlanning(); } },
                    ])}>
                      <Text style={[s.secondaryBtnText, { color: C.danger }]}>archive current</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Panel>
            </View>
          )}

          {activeTab === 'projects' && (
            <View style={s.stack}>
              <Panel C={C} title="new project">
                <TextInput style={[s.input, { color: C.text, borderColor: C.border }]} placeholder="project name..." placeholderTextColor={C.textSecondary} value={projectName} onChangeText={setProjectName} />
                <TextInput style={[s.textArea, { color: C.text, borderColor: C.border }]} placeholder="project notes..." placeholderTextColor={C.textSecondary} value={projectNotes} onChangeText={setProjectNotes} multiline />
                <View style={s.swatches}>
                  {PROJECT_COLORS.map((color) => (
                    <TouchableOpacity key={color} style={[s.swatch, { backgroundColor: color }, projectColor === color && { borderColor: C.text, borderWidth: 2 }]} onPress={() => setProjectColor(color)} />
                  ))}
                </View>
                <ActionButton C={C} label="create project" onPress={addProject} />
              </Panel>

              {projects.map((project) => (
                <View key={project.id} style={[s.projectCard, { backgroundColor: C.card }]}>
                  <View style={s.projectTop}>
                    <View style={[s.projectDot, { backgroundColor: project.color || C.primary }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.projectName, { color: C.text }]}>{project.name}</Text>
                      <Text style={[s.projectMeta, { color: C.textSecondary }]}>
                        {(project.task_count || 0) - (project.completed_count || 0)} open · {project.completed_count || 0} done
                      </Text>
                    </View>
                    {project.id !== 'default-project' && (
                      <TouchableOpacity onPress={() => Alert.alert('archive project', `"${project.name}"?`, [
                        { text: 'cancel', style: 'cancel' },
                        { text: 'archive', style: 'destructive', onPress: async () => { await archiveProject(project.id); await refreshPlanning(); } },
                      ])}>
                        <Text style={[s.deleteText, { color: C.danger }]}>archive</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {!!project.notes && <Text style={[s.projectNotes, { color: C.textSecondary }]}>{project.notes}</Text>}
                </View>
              ))}
            </View>
          )}

          {activeTab === 'calendar' && (
            <View style={s.stack}>
              <View style={s.calendarHeader}>
                <TouchableOpacity style={[s.iconBtn, { backgroundColor: C.card }]} onPress={() => setCalCursor((c) => c.month === 1 ? { year: c.year - 1, month: 12 } : { ...c, month: c.month - 1 })}>
                  <Text style={[s.iconBtnText, { color: C.text }]}>‹</Text>
                </TouchableOpacity>
                <Text style={[s.calendarTitle, { color: C.text }]}>{monthLabel(calCursor.year, calCursor.month)}</Text>
                <TouchableOpacity style={[s.iconBtn, { backgroundColor: C.card }]} onPress={() => setCalCursor((c) => c.month === 12 ? { year: c.year + 1, month: 1 } : { ...c, month: c.month + 1 })}>
                  <Text style={[s.iconBtnText, { color: C.text }]}>›</Text>
                </TouchableOpacity>
              </View>

              <View style={[s.monthGrid, { backgroundColor: C.card }]}>
                {['s', 'm', 't', 'w', 't', 'f', 's'].map((d, i) => <Text key={`${d}-${i}`} style={[s.weekday, { color: C.textSecondary }]}>{d}</Text>)}
                {days.map((day, i) => {
                  const item = day ? itemsByDate[day] : null;
                  const count = (item?.tasks.length || 0) + (item?.events.length || 0);
                  return (
                    <View key={day || `blank-${i}`} style={[s.dayCell, day === today && { borderColor: C.primary, borderWidth: 1.5 }]}>
                      <Text style={[s.dayNum, { color: day ? C.text : 'transparent' }]}>{day ? Number(day.slice(-2)) : '-'}</Text>
                      {count > 0 && <View style={[s.dayBadge, { backgroundColor: C.primary }]}><Text style={s.dayBadgeText}>{count}</Text></View>}
                    </View>
                  );
                })}
              </View>

              <Panel C={C} title="new event">
                <TextInput style={[s.input, { color: C.text, borderColor: C.border }]} placeholder="event title..." placeholderTextColor={C.textSecondary} value={eventTitle} onChangeText={setEventTitle} />
                <View style={s.row}>
                  <TextInput style={[s.input, s.rowInput, { color: C.text, borderColor: C.border }]} placeholder="YYYY-MM-DD" placeholderTextColor={C.textSecondary} value={eventDate} onChangeText={setEventDate} />
                  <TextInput style={[s.input, s.timeInput, { color: C.text, borderColor: C.border }]} placeholder="start" placeholderTextColor={C.textSecondary} value={eventStart} onChangeText={setEventStart} />
                  <TextInput style={[s.input, s.timeInput, { color: C.text, borderColor: C.border }]} placeholder="end" placeholderTextColor={C.textSecondary} value={eventEnd} onChangeText={setEventEnd} />
                </View>
                <ProjectPicker C={C} projects={projects} value={eventProjectId} onChange={setEventProjectId} />
                <ActionButton C={C} label="add event" onPress={addEvent} />
              </Panel>

              <Panel C={C} title="agenda">
                {Object.keys(itemsByDate).length === 0 ? <Empty C={C} text="nothing scheduled this month" /> : Object.entries(itemsByDate).map(([day, item]) => (
                  <View key={day} style={[s.agendaDay, { borderColor: C.border }]}>
                    <Text style={[s.agendaDate, { color: C.text }]}>{shortDate(day)}</Text>
                    {item.events.map((event) => <EventRow key={event.id} C={C} event={event} onDelete={async () => { await deleteCalendarEvent(event.id); await refreshPlanning(); }} />)}
                    {item.tasks.map((task) => <TaskRow key={task.id} C={C} task={task} onToggle={toggleTask} onDelete={removeTask} compact />)}
                  </View>
                ))}
              </Panel>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

function Panel({ C, title, children }) {
  return (
    <View style={[s.panel, { backgroundColor: C.card }]}>
      <Text style={[s.panelTitle, { color: C.textSecondary }]}>{title}</Text>
      {children}
    </View>
  );
}

function ActionButton({ C, label, onPress }) {
  return (
    <TouchableOpacity style={[s.actionBtn, { backgroundColor: C.accent }]} onPress={onPress} activeOpacity={0.8}>
      <Text style={s.actionBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

function Empty({ C, text }) {
  return <Text style={[s.empty, { color: C.textSecondary }]}>{text}</Text>;
}

function ProjectPicker({ C, projects, value, onChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.projectPicker}>
      {projects.map((project) => (
        <TouchableOpacity
          key={project.id}
          style={[s.projectPill, { backgroundColor: value === project.id ? project.color || C.primary : C.background, borderColor: C.border }]}
          onPress={() => onChange(project.id)}
        >
          <Text style={[s.projectPillText, { color: value === project.id ? '#fff' : C.text }]}>{project.name}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function TaskRow({
  C,
  task,
  onToggle,
  onDelete,
  compact = false,
  draggable = false,
  isDragging = false,
  onDragStart,
  onDragMove,
  onDragEnd,
}) {
  return (
    <View style={[s.taskRow, compact && s.compactTask, isDragging && s.draggingTask, { backgroundColor: C.background }]}>
      {draggable && (
        <View
          style={[s.dragHandle, { borderColor: C.border }]}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(event) => onDragStart?.(event.nativeEvent.pageY)}
          onResponderMove={(event) => onDragMove?.(event.nativeEvent.pageY)}
          onResponderRelease={onDragEnd}
          onResponderTerminate={onDragEnd}
        >
          <Text style={[s.dragHandleText, { color: C.textSecondary }]}>≡</Text>
        </View>
      )}
      <TouchableOpacity style={[s.check, { borderColor: task.completed ? C.success : C.border, backgroundColor: task.completed ? C.success : 'transparent' }]} onPress={() => onToggle(task.id)}>
        {task.completed ? <Text style={s.checkText}>✓</Text> : null}
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={[s.taskTitle, { color: task.completed ? C.textSecondary : C.text }, task.completed && s.doneText]} numberOfLines={2}>{task.title}</Text>
        <Text style={[s.taskMeta, { color: C.textSecondary }]} numberOfLines={1}>
          {[task.project_name, task.list_title, task.due_date ? `due ${shortDate(task.due_date)}` : null, `${task.target_pomodoros || 1} ◉`].filter(Boolean).join(' · ')}
        </Text>
        {!!task.notes && <Text style={[s.taskNotes, { color: C.textSecondary }]} numberOfLines={2}>{task.notes}</Text>}
      </View>
      <TouchableOpacity onPress={() => onDelete(task.id)} style={s.rowIcon}><Text style={[s.rowIconText, { color: C.danger }]}>×</Text></TouchableOpacity>
    </View>
  );
}

function EventRow({ C, event, onDelete }) {
  const time = event.all_day ? 'all day' : [event.start_at, event.end_at].filter(Boolean).join(' - ');
  return (
    <View style={[s.eventRow, { backgroundColor: C.background }]}>
      <View style={[s.eventStripe, { backgroundColor: event.project_color || C.primary }]} />
      <View style={{ flex: 1 }}>
        <Text style={[s.taskTitle, { color: C.text }]}>{event.title}</Text>
        <Text style={[s.taskMeta, { color: C.textSecondary }]}>{[event.project_name, shortDate(event.event_date), time].filter(Boolean).join(' · ')}</Text>
      </View>
      <TouchableOpacity onPress={onDelete} style={s.rowIcon}><Text style={[s.rowIconText, { color: C.danger }]}>×</Text></TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 24, paddingTop: 58, paddingBottom: 42 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  headerCopy: { flex: 1 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', elevation: 1 },
  iconBtnText: { fontSize: 30, fontWeight: '300', lineHeight: 34 },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: 0 },
  dateLabel: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  tabs: { flexDirection: 'row', borderRadius: 18, padding: 5, gap: 5, marginBottom: 18, elevation: 2 },
  tab: { flex: 1, borderRadius: 14, paddingVertical: 10, alignItems: 'center' },
  tabText: { fontSize: 11, fontWeight: '900' },
  stack: { gap: 14 },
  hero: { borderRadius: 24, padding: 20, minHeight: 126, justifyContent: 'center' },
  heroKicker: { color: 'rgba(255,255,255,0.68)', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  heroTitle: { color: '#fff', fontSize: 46, fontWeight: '900', letterSpacing: 0, marginTop: 6 },
  heroSub: { color: 'rgba(255,255,255,0.84)', fontSize: 13, fontWeight: '800' },
  panel: { borderRadius: 20, padding: 16, gap: 10, elevation: 2 },
  panelTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 },
  textArea: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 58, fontSize: 14, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  rowInput: { flex: 1 },
  targetInput: { width: 64, textAlign: 'center' },
  timeInput: { width: 72 },
  actionBtn: { borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  secondaryBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center' },
  secondaryBtnText: { fontSize: 12, fontWeight: '900' },
  empty: { textAlign: 'center', fontSize: 13, paddingVertical: 12 },
  listChips: { gap: 10, paddingBottom: 2 },
  chip: { minWidth: 122, borderRadius: 18, paddingHorizontal: 15, paddingVertical: 12, elevation: 1 },
  chipText: { fontSize: 14, fontWeight: '900' },
  chipMeta: { fontSize: 11, fontWeight: '700', marginTop: 3 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 12 },
  draggingTask: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  compactTask: { paddingVertical: 10 },
  dragHandle: { width: 26, height: 34, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dragHandleText: { fontSize: 20, fontWeight: '900', lineHeight: 22 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  taskTitle: { fontSize: 14, fontWeight: '900', lineHeight: 19 },
  doneText: { textDecorationLine: 'line-through', opacity: 0.65 },
  taskMeta: { fontSize: 11, fontWeight: '700', marginTop: 3 },
  taskNotes: { fontSize: 12, lineHeight: 17, marginTop: 5 },
  rowIcon: { minWidth: 26, minHeight: 30, alignItems: 'center', justifyContent: 'center' },
  rowIconText: { fontSize: 19, fontWeight: '800' },
  swatches: { flexDirection: 'row', gap: 10 },
  swatch: { width: 30, height: 30, borderRadius: 15 },
  projectCard: { borderRadius: 18, padding: 15, gap: 10, elevation: 2 },
  projectTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  projectDot: { width: 14, height: 14, borderRadius: 7 },
  projectName: { fontSize: 16, fontWeight: '900' },
  projectMeta: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  projectNotes: { fontSize: 13, lineHeight: 18 },
  deleteText: { fontSize: 12, fontWeight: '900' },
  projectPicker: { gap: 8, paddingVertical: 2 },
  projectPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  projectPillText: { fontSize: 12, fontWeight: '900' },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calendarTitle: { fontSize: 20, fontWeight: '900' },
  monthGrid: { borderRadius: 20, padding: 12, flexDirection: 'row', flexWrap: 'wrap', elevation: 2 },
  weekday: { width: '14.285%', textAlign: 'center', fontSize: 11, fontWeight: '900', marginBottom: 8 },
  dayCell: { width: '14.285%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  dayNum: { fontSize: 13, fontWeight: '800' },
  dayBadge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  dayBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  agendaDay: { borderTopWidth: 1, paddingTop: 10, gap: 8 },
  agendaDate: { fontSize: 13, fontWeight: '900' },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 12 },
  eventStripe: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
});
