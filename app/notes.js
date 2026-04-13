import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Modal, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Stack, useFocusEffect, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../src/context/ThemeContext';
import AestheticBackground from '../src/components/AestheticBackground';
import { getNotes, saveNote, deleteNote, togglePinNote, searchNotes } from '../src/db/notesDatabase';
import { COLORS } from '../src/constants/theme';

function fmtDate(iso) {
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.floor((today - d) / 86400000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'yesterday';
  if (diff < 7) return `${diff}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function NotesScreen() {
  const C = useTheme();
  const [notes, setNotes] = useState([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // null = closed, {} = new, {id,...} = edit
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');

  useFocusEffect(useCallback(() => { load(); }, []));

  useEffect(() => {
    if (search.trim().length > 1) {
      searchNotes(search.trim()).then(setNotes);
    } else if (search === '') {
      load();
    }
  }, [search]);

  async function load() {
    const rows = await getNotes();
    setNotes(rows);
  }

  function openNew() {
    setDraftTitle('');
    setDraftBody('');
    setEditing({});
  }

  function openEdit(note) {
    setDraftTitle(note.title || '');
    setDraftBody(note.body || '');
    setEditing(note);
  }

  async function handleSave() {
    if (!draftTitle.trim() && !draftBody.trim()) {
      setEditing(null);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await saveNote(editing?.id || null, draftTitle.trim(), draftBody.trim(), editing?.pinned || 0);
    setEditing(null);
    load();
  }

  async function handleDelete(id) {
    Alert.alert('delete note', 'are you sure?', [
      { text: 'cancel', style: 'cancel' },
      { text: 'delete', style: 'destructive', onPress: async () => { await deleteNote(id); load(); } },
    ]);
  }

  async function handlePin(note) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await togglePinNote(note.id, note.pinned);
    load();
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.container, { backgroundColor: C.background }]}>
        <AestheticBackground />

        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={s.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={[s.back, { color: C.text }]}>←</Text>
            </TouchableOpacity>
            <Text style={[s.title, { color: C.text }]}>notes</Text>
            <TouchableOpacity
              style={[s.addBtn, { backgroundColor: C.card, borderColor: C.border }]}
              onPress={openNew}
              activeOpacity={0.7}
            >
              <Text style={[s.addBtnText, { color: C.text }]}>+ new</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={[s.searchBar, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={{ color: C.textSecondary, fontSize: 14, marginRight: 8 }}>🔍</Text>
            <TextInput
              style={[s.searchInput, { color: C.text }]}
              placeholder="search notes..."
              placeholderTextColor={C.textSecondary}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Text style={{ color: C.textSecondary }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {notes.length === 0 && (
            <View style={s.empty}>
              <Text style={[s.emptyTitle, { color: C.text }]}>no notes yet</Text>
              <Text style={[s.emptyDesc, { color: C.textSecondary }]}>tap "+ new" to write anything.</Text>
            </View>
          )}

          {notes.map(note => (
            <TouchableOpacity
              key={note.id}
              style={[s.noteCard, { backgroundColor: C.card, borderColor: C.border }]}
              onPress={() => openEdit(note)}
              onLongPress={() => Alert.alert(
                note.title || 'note',
                null,
                [
                  { text: note.pinned ? 'unpin' : 'pin', onPress: () => handlePin(note) },
                  { text: 'delete', style: 'destructive', onPress: () => handleDelete(note.id) },
                  { text: 'cancel', style: 'cancel' },
                ]
              )}
              activeOpacity={0.7}
            >
              <View style={s.noteTop}>
                {note.pinned ? <Text style={{ fontSize: 12 }}>📌</Text> : null}
                <Text style={[s.noteTitle, { color: C.text, flex: 1 }]} numberOfLines={1}>
                  {note.title || note.body?.slice(0, 40) || 'untitled'}
                </Text>
                <Text style={[s.noteDate, { color: C.textSecondary }]}>{fmtDate(note.updated_at)}</Text>
              </View>
              {note.body ? (
                <Text style={[s.noteBody, { color: C.textSecondary }]} numberOfLines={2}>{note.body}</Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Note edit modal */}
        <Modal visible={!!editing} animationType="slide" transparent>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={[s.modalBg, { backgroundColor: 'rgba(0,0,0,0.4)' }]}>
              <View style={[s.modalSheet, { backgroundColor: C.card }]}>
                <View style={s.modalHeader}>
                  <TouchableOpacity onPress={() => setEditing(null)}>
                    <Text style={[s.modalCancel, { color: C.textSecondary }]}>cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSave}>
                    <Text style={[s.modalSave, { color: C.text }]}>save</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[s.modalTitle, { color: C.text, borderBottomColor: C.border }]}
                  placeholder="title"
                  placeholderTextColor={C.textSecondary}
                  value={draftTitle}
                  onChangeText={setDraftTitle}
                  returnKeyType="next"
                />
                <TextInput
                  style={[s.modalBody, { color: C.text }]}
                  placeholder="write anything..."
                  placeholderTextColor={C.textSecondary}
                  value={draftBody}
                  onChangeText={setDraftBody}
                  multiline
                  textAlignVertical="top"
                  autoFocus={!editing?.id}
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 60, paddingBottom: 50 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  back: { fontSize: 24 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, flex: 1 },
  addBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  addBtnText: { fontSize: 13, fontWeight: '600' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 4, marginBottom: 16,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 9 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyDesc: { fontSize: 14 },
  noteCard: {
    borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10, gap: 6,
  },
  noteTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  noteTitle: { fontSize: 15, fontWeight: '600', letterSpacing: 0.1 },
  noteDate: { fontSize: 11 },
  noteBody: { fontSize: 13, lineHeight: 18 },
  modalBg: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 40, minHeight: '60%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  modalCancel: { fontSize: 15, letterSpacing: 0.2 },
  modalSave: { fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  modalTitle: {
    fontSize: 20, fontWeight: '700', letterSpacing: -0.3,
    borderBottomWidth: 1, paddingBottom: 12, marginBottom: 12,
  },
  modalBody: { fontSize: 15, lineHeight: 22, flex: 1, minHeight: 200 },
});
