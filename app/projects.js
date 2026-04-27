import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Modal,
} from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../src/context/ThemeContext';
import AestheticBackground from '../src/components/AestheticBackground';
import { getProjects, createProject, updateProject, archiveProject } from '../src/db/plannerDatabase';

const COLORS = ['#4A7856', '#89B4D4', '#C5A8E8', '#F4A56A', '#F9C74F', '#6CC97C', '#D9713E', '#B85B3A'];
const STATUSES = ['active', 'on hold', 'done'];
const STATUS_COLORS = { active: '#6CC97C', 'on hold': '#F9C74F', done: '#89B4D4' };

export default function ProjectsScreen() {
  const C = useTheme();
  const [projects, setProjects] = useState([]);
  const [filter, setFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [status, setStatus] = useState('active');
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => { load(); }, []));

  async function load() {
    setProjects(await getProjects());
  }

  function openAdd() {
    setEditing(null);
    setName(''); setNotes(''); setColor(COLORS[0]); setStatus('active');
    setShowModal(true);
  }

  function openEdit(p) {
    setEditing(p);
    setName(p.name); setNotes(p.notes || ''); setColor(p.color || COLORS[0]); setStatus(p.status || 'active');
    setShowModal(true);
  }

  async function handleSave() {
    if (!name.trim()) { Alert.alert('name required', ''); return; }
    setSaving(true);
    try {
      if (editing) {
        await updateProject(editing.id, { name, color, status, notes });
      } else {
        await createProject({ name, color, notes });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowModal(false);
      await load();
    } finally { setSaving(false); }
  }

  const filtered = filter === 'all' ? projects : projects.filter(p => p.status === filter);
  const activeCount = projects.filter(p => p.status === 'active').length;
  const totalOpen = projects.reduce((sum, p) => sum + Math.max(0, (p.task_count || 0) - (p.completed_count || 0)), 0);
  const doneCount = projects.filter(p => p.status === 'done').length;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.container, { backgroundColor: C.background }]}>
        <AestheticBackground />
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
            <Text style={[s.back, { color: C.text }]}>←</Text>
          </TouchableOpacity>
          <Text style={[s.title, { color: C.text }]}>projects</Text>
          <TouchableOpacity style={[s.addBtn, { backgroundColor: C.accent }]} onPress={openAdd} activeOpacity={0.8}>
            <Text style={[s.addBtnText, { color: C.background }]}>+ new</Text>
          </TouchableOpacity>
        </View>

        <View style={[s.heroCard, { backgroundColor: C.primary }]}>
          <View style={s.heroGlow} />
          <View>
            <Text style={s.heroKicker}>PROJECTS</Text>
            <Text style={s.heroTitle}>{activeCount}</Text>
            <Text style={s.heroSub}>active right now</Text>
          </View>
          <View style={s.heroStats}>
            <View style={s.heroPill}>
              <Text style={s.heroPillValue}>{totalOpen}</Text>
              <Text style={s.heroPillLabel}>open</Text>
            </View>
            <View style={s.heroPill}>
              <Text style={s.heroPillValue}>{doneCount}</Text>
              <Text style={s.heroPillLabel}>done</Text>
            </View>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow} style={s.filterWrap}>
          {['all', ...STATUSES].map(f => (
            <TouchableOpacity
              key={f}
              style={[s.filterChip, { backgroundColor: C.card }, filter === f && { backgroundColor: C.accent }]}
              onPress={() => setFilter(f)}
            >
              <Text style={[s.filterText, { color: filter === f ? C.background : C.textSecondary }]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          {filtered.length === 0 && (
            <View style={s.empty}>
              <Text style={[s.emptyTitle, { color: C.text }]}>no projects</Text>
              <Text style={[s.emptySub, { color: C.textSecondary }]}>create a project to group your task lists</Text>
              <TouchableOpacity style={[s.emptyBtn, { backgroundColor: C.accent }]} onPress={openAdd} activeOpacity={0.8}>
                <Text style={[s.emptyBtnText, { color: C.background }]}>create first project</Text>
              </TouchableOpacity>
            </View>
          )}

          {filtered.map(p => {
            const total = p.task_count || 0;
            const done = p.completed_count || 0;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            return (
              <TouchableOpacity
                key={p.id}
                style={[s.card, { backgroundColor: C.card }]}
                onPress={() => router.push({ pathname: '/project-detail', params: { id: p.id } })}
                onLongPress={() => Alert.alert(p.name, null, [
                  { text: 'edit', onPress: () => openEdit(p) },
                  p.id !== 'default-project' ? { text: 'archive', style: 'destructive', onPress: async () => { await archiveProject(p.id); await load(); } } : null,
                  { text: 'cancel', style: 'cancel' },
                ].filter(Boolean))}
                activeOpacity={0.75}
              >
                <View style={[s.cardGlow, { backgroundColor: p.color || C.primary }]} />
                <View style={s.cardTop}>
                  <View style={[s.projectDot, { backgroundColor: p.color || C.primary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.cardName, { color: C.text }]}>{p.name}</Text>
                    {p.notes ? <Text style={[s.cardNotes, { color: C.textSecondary }]} numberOfLines={1}>{p.notes}</Text> : null}
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: STATUS_COLORS[p.status] + '30' }]}>
                    <Text style={[s.statusText, { color: STATUS_COLORS[p.status] }]}>{p.status}</Text>
                  </View>
                </View>
                {total > 0 && (
                  <>
                    <View style={[s.progressTrack, { backgroundColor: C.background }]}>
                      <View style={[s.progressFill, { width: `${pct}%`, backgroundColor: p.color || C.primary }]} />
                    </View>
                    <Text style={[s.cardMeta, { color: C.textSecondary }]}>{done}/{total} tasks complete</Text>
                  </>
                )}
                {total === 0 && <Text style={[s.cardMeta, { color: C.textSecondary }]}>no tasks yet</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
          <View style={s.modalOverlay}>
            <View style={[s.modalSheet, { backgroundColor: C.card }]}>
              <View style={[s.modalHeader, { borderBottomColor: C.border }]}>
                <Text style={[s.modalTitle, { color: C.text }]}>{editing ? 'edit project' : 'new project'}</Text>
                <TouchableOpacity onPress={() => setShowModal(false)}>
                  <Text style={[s.modalCancel, { color: C.textSecondary }]}>cancel</Text>
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
                <TextInput
                  style={[s.input, { color: C.text, borderColor: C.border, backgroundColor: C.background }]}
                  placeholder="project name"
                  placeholderTextColor={C.textSecondary}
                  value={name}
                  onChangeText={setName}
                  autoFocus
                />
                <TextInput
                  style={[s.input, { color: C.text, borderColor: C.border, backgroundColor: C.background }]}
                  placeholder="description (optional)"
                  placeholderTextColor={C.textSecondary}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                />

                {editing && (
                  <>
                    <Text style={[s.fieldLabel, { color: C.textSecondary }]}>status</Text>
                    <View style={s.statusRow}>
                      {STATUSES.map(st => (
                        <TouchableOpacity
                          key={st}
                          style={[s.statusChip, { borderColor: STATUS_COLORS[st], backgroundColor: status === st ? STATUS_COLORS[st] : C.background }]}
                          onPress={() => setStatus(st)}
                        >
                          <Text style={[s.statusChipText, { color: status === st ? '#fff' : C.textSecondary }]}>{st}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                <Text style={[s.fieldLabel, { color: C.textSecondary }]}>color</Text>
                <View style={s.colorRow}>
                  {COLORS.map(c => (
                    <TouchableOpacity key={c} style={[s.colorDot, { backgroundColor: c }, color === c && s.colorSelected]} onPress={() => setColor(c)} />
                  ))}
                </View>

                <TouchableOpacity
                  style={[s.saveBtn, { backgroundColor: C.accent }, saving && { opacity: 0.5 }]}
                  onPress={handleSave}
                  disabled={saving}
                  activeOpacity={0.8}
                >
                  <Text style={[s.saveBtnText, { color: C.background }]}>{saving ? 'saving...' : editing ? 'save changes' : 'create project'}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, position: 'relative' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 58, paddingBottom: 12 },
  back: { fontSize: 24, fontWeight: '800' },
  title: { flex: 1, fontSize: 24, fontWeight: '900' },
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
  heroGlow: { position: 'absolute', top: -44, right: -44, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.14)' },
  heroKicker: { color: 'rgba(255,255,255,0.70)', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  heroTitle: { color: '#FFFFFF', fontSize: 44, fontWeight: '900', letterSpacing: 0, marginTop: 4 },
  heroSub: { color: 'rgba(255,255,255,0.86)', fontSize: 12, fontWeight: '800' },
  heroStats: { flexDirection: 'row', gap: 8 },
  heroPill: { minWidth: 58, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center' },
  heroPillValue: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  heroPillLabel: { color: 'rgba(255,255,255,0.72)', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  filterWrap: { maxHeight: 56, flexGrow: 0 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  filterChip: { borderRadius: 999, paddingHorizontal: 15, paddingVertical: 9, elevation: 2 },
  filterText: { fontSize: 13, fontWeight: '800' },
  content: { padding: 16, paddingTop: 8, paddingBottom: 50 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '900' },
  emptySub: { fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },
  emptyBtn: { borderRadius: 999, paddingHorizontal: 24, paddingVertical: 14, marginTop: 8 },
  emptyBtnText: { fontSize: 14, fontWeight: '900' },
  card: { borderRadius: 22, padding: 16, marginBottom: 12, elevation: 4, gap: 10, overflow: 'hidden' },
  cardGlow: { position: 'absolute', top: -50, right: -42, width: 130, height: 130, borderRadius: 65, opacity: 0.10 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  projectDot: { width: 14, height: 14, borderRadius: 7, marginTop: 4 },
  cardName: { fontSize: 16, fontWeight: '900' },
  cardNotes: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  cardMeta: { fontSize: 12, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: '900' },
  modalCancel: { fontSize: 13, fontWeight: '800' },
  modalContent: { padding: 18, paddingBottom: 40 },
  fieldLabel: { fontSize: 11, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.3 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 14 },
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statusChip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  statusChipText: { fontSize: 13, fontWeight: '800' },
  colorRow: { flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
  colorDot: { width: 30, height: 30, borderRadius: 15 },
  colorSelected: { borderWidth: 3, borderColor: '#fff', elevation: 4 },
  saveBtn: { borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '800' },
});
