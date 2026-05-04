import React from 'react';
import { Dimensions, PanResponder, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width: SCREEN_W } = Dimensions.get('window');
const COLUMN_WIDTH = Math.max(260, Math.min(330, Math.floor(SCREEN_W * 0.78)));

const COLUMNS = [
  { key: 'todo', label: 'To do' },
  { key: 'doing', label: 'Doing' },
  { key: 'done', label: 'Done' },
];

function taskStatus(task) {
  if (task?.completed) return 'done';
  return task?.status || 'todo';
}

function formatDue(dateStr) {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase();
}

export default function TaskKanbanBoard({
  tasks,
  C,
  showList = false,
  compact = false,
  emptyText = 'no tasks',
  onPress,
  onToggle,
  onDelete,
  onStatusChange,
}) {
  const safeTasks = tasks || [];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.board}
    >
      {COLUMNS.map((column) => {
        const columnTasks = safeTasks.filter((task) => taskStatus(task) === column.key);
        return (
          <View
            key={column.key}
            style={[
              styles.column,
              { width: compact ? Math.min(COLUMN_WIDTH, 286) : COLUMN_WIDTH, backgroundColor: C.card, borderColor: C.border },
            ]}
          >
            <View style={styles.columnHeader}>
              <Text style={[styles.columnTitle, { color: C.text }]}>{column.label}</Text>
              <View style={[styles.countPill, { backgroundColor: C.background }]}>
                <Text style={[styles.countText, { color: C.textSecondary }]}>{columnTasks.length}</Text>
              </View>
            </View>

            {columnTasks.length === 0 ? (
              <Text style={[styles.empty, { color: C.textSecondary }]}>{emptyText}</Text>
            ) : (
              columnTasks.map((task) => (
                <KanbanCard
                  key={task.id}
                  task={task}
                  C={C}
                  showList={showList}
                  onPress={() => onPress?.(task)}
                  onToggle={() => onToggle?.(task)}
                  onDelete={() => onDelete?.(task)}
                  onStatusChange={(status) => onStatusChange?.(task, status)}
                />
              ))
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

function KanbanCard({ task, C, showList, onPress, onToggle, onDelete, onStatusChange }) {
  const status = taskStatus(task);
  const accent = task.list_color || task.project_color || C.primary;
  const due = formatDue(task.due_date);
  const panHandlers = React.useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 16 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderRelease: (_, gesture) => {
      if (Math.abs(gesture.dx) < 72) return;
      const index = COLUMNS.findIndex((column) => column.key === status);
      const nextIndex = Math.max(0, Math.min(COLUMNS.length - 1, index + (gesture.dx > 0 ? 1 : -1)));
      const nextStatus = COLUMNS[nextIndex]?.key;
      if (nextStatus && nextStatus !== status) onStatusChange(nextStatus);
    },
  }).panHandlers, [status, onStatusChange]);

  return (
    <View {...panHandlers} style={[styles.card, { backgroundColor: C.background, borderColor: C.border }]}>
      <View style={[styles.accent, { backgroundColor: status === 'done' ? C.border : accent }]} />
      <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={styles.cardBody}>
        <Text
          style={[styles.cardTitle, { color: status === 'done' ? C.textSecondary : C.text }, status === 'done' && styles.doneTitle]}
          numberOfLines={3}
        >
          {task.title}
        </Text>

        {!!task.notes && (
          <Text style={[styles.notes, { color: C.textSecondary }]} numberOfLines={2}>
            {task.notes}
          </Text>
        )}

        <View style={styles.metaRow}>
          {showList && !!task.list_title && (
            <View style={[styles.metaPill, { backgroundColor: accent + '1A' }]}>
              <Text style={[styles.metaText, { color: accent }]} numberOfLines={1}>{task.list_title}</Text>
            </View>
          )}
          {!!due && (
            <View style={[styles.metaPill, { backgroundColor: C.card }]}>
              <Text style={[styles.metaText, { color: C.textSecondary }]}>due {due}</Text>
            </View>
          )}
          <View style={[styles.metaPill, { backgroundColor: C.card }]}>
            <Text style={[styles.metaText, { color: C.textSecondary }]}>{task.target_pomodoros || 1} pom</Text>
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.smallBtn, { borderColor: C.border }]} onPress={onToggle}>
          <Text style={[styles.smallBtnText, { color: C.textSecondary }]}>{status === 'done' ? 'reopen' : 'done'}</Text>
        </TouchableOpacity>
        {COLUMNS.filter((column) => column.key !== status && (status === 'done' || column.key !== 'done')).map((column) => (
          <TouchableOpacity key={column.key} style={[styles.smallBtn, { borderColor: C.border }]} onPress={() => onStatusChange(column.key)}>
            <Text style={[styles.smallBtnText, { color: C.textSecondary }]}>{column.label.toLowerCase()}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[styles.deleteBtn, { borderColor: C.border }]} onPress={onDelete}>
          <Text style={[styles.deleteText, { color: C.danger }]}>delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  board: { gap: 12, paddingVertical: 4, paddingRight: 8 },
  column: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    minHeight: 320,
    gap: 10,
  },
  columnHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  columnTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 0 },
  countPill: { minWidth: 28, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 12, fontWeight: '900' },
  empty: { fontSize: 13, fontWeight: '700', paddingVertical: 16, textAlign: 'center' },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  accent: { height: 4 },
  cardBody: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: '900', lineHeight: 20 },
  doneTitle: { textDecorationLine: 'line-through', opacity: 0.72 },
  notes: { fontSize: 12, lineHeight: 17, marginTop: 5 },
  metaRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 10 },
  metaPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, maxWidth: 132 },
  metaText: { fontSize: 10, fontWeight: '900' },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  smallBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  smallBtnText: { fontSize: 10, fontWeight: '900' },
  deleteBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  deleteText: { fontSize: 10, fontWeight: '900' },
});
