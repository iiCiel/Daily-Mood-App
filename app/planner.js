import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Stack, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../src/context/ThemeContext';
import AestheticBackground from '../src/components/AestheticBackground';
import { getPlannerEntry, savePlannerEntry } from '../src/db/plannerDatabase';
import { COLORS } from '../src/constants/theme';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

const EVENING_LABELS = { 1: 'rough', 2: 'so-so', 3: 'okay', 4: 'good', 5: 'great' };
const EVENING_COLORS = { 1: '#89B4D4', 2: '#F4A56A', 3: '#C5A8E8', 4: '#F9C74F', 5: '#6CC97C' };

export default function PlannerScreen() {
  const C = useTheme();
  const today = todayStr();
  const hour = new Date().getHours();
  const isEvening = hour >= 17;

  const [intention, setIntention] = useState('');
  const [priorities, setPriorities] = useState(['', '', '']);
  const [eveningNote, setEveningNote] = useState('');
  const [eveningRating, setEveningRating] = useState(null);
  const [saving, setSaving] = useState(false);

  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  useEffect(() => { loadEntry(); }, []);

  async function loadEntry() {
    const entry = await getPlannerEntry(today);
    if (entry) {
      setIntention(entry.intention || '');
      const p = [...(entry.priorities || []), '', '', ''].slice(0, 3);
      setPriorities(p);
      setEveningNote(entry.evening_note || '');
      setEveningRating(entry.evening_rating || null);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const filteredPriorities = priorities.filter(p => p.trim());
      await savePlannerEntry(today, {
        intention,
        priorities: filteredPriorities,
        eveningNote,
        eveningRating,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('saved', 'plan updated.');
    } catch (e) {
      Alert.alert('error', 'could not save.');
    } finally {
      setSaving(false);
    }
  }

  function updatePriority(i, val) {
    const updated = [...priorities];
    updated[i] = val;
    setPriorities(updated);
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView style={[s.flex, { backgroundColor: C.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={[s.flex, { backgroundColor: C.background }]} contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <AestheticBackground />

          <View style={s.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={[s.back, { color: C.text }]}>←</Text>
            </TouchableOpacity>
            <View>
              <Text style={[s.title, { color: C.text }]}>daily plan</Text>
              <Text style={[s.dateLabel, { color: C.textSecondary }]}>{dateLabel.toLowerCase()}</Text>
            </View>
          </View>

          {/* Morning section */}
          <View style={[s.section, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[s.sectionTitle, { color: C.textSecondary }]}>morning intention</Text>
            <TextInput
              style={[s.intentionInput, { color: C.text, borderColor: C.border }]}
              placeholder="what do you want to focus on today?"
              placeholderTextColor={C.textSecondary}
              value={intention}
              onChangeText={setIntention}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Priorities */}
          <View style={[s.section, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[s.sectionTitle, { color: C.textSecondary }]}>top 3 priorities</Text>
            {priorities.map((p, i) => (
              <View key={i} style={[s.priorityRow, { borderColor: C.border }]}>
                <View style={[s.priorityNum, { backgroundColor: p.trim() ? C.text : C.border }]}>
                  <Text style={[s.priorityNumText, { color: p.trim() ? C.background : C.card }]}>{i + 1}</Text>
                </View>
                <TextInput
                  style={[s.priorityInput, { color: C.text }]}
                  placeholder={`priority ${i + 1}...`}
                  placeholderTextColor={C.textSecondary}
                  value={p}
                  onChangeText={val => updatePriority(i, val)}
                  returnKeyType={i < 2 ? 'next' : 'done'}
                />
              </View>
            ))}
          </View>

          {/* Evening review */}
          {isEvening && (
            <View style={[s.section, { backgroundColor: C.card, borderColor: C.border }]}>
              <Text style={[s.sectionTitle, { color: C.textSecondary }]}>evening review</Text>
              <Text style={[s.prompt, { color: C.textSecondary }]}>how did today go?</Text>
              <View style={s.ratingRow}>
                {[1, 2, 3, 4, 5].map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[s.ratingBtn, {
                      backgroundColor: eveningRating === r ? EVENING_COLORS[r] : C.background,
                      borderColor: eveningRating === r ? EVENING_COLORS[r] : C.border,
                    }]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setEveningRating(r); }}
                  >
                    <Text style={[s.ratingText, { color: eveningRating === r ? '#fff' : C.textSecondary }]}>
                      {EVENING_LABELS[r]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[s.eveningInput, { color: C.text, borderColor: C.border }]}
                placeholder="reflect on the day..."
                placeholderTextColor={C.textSecondary}
                value={eveningNote}
                onChangeText={setEveningNote}
                multiline
                textAlignVertical="top"
              />
            </View>
          )}

          {!isEvening && (
            <Text style={[s.eveningHint, { color: C.textSecondary }]}>evening review unlocks after 5pm</Text>
          )}

          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: C.text }, saving && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            <Text style={[s.saveBtnText, { color: C.background }]}>{saving ? 'saving...' : 'save plan'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 24, paddingTop: 60, paddingBottom: 50 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 28 },
  back: { fontSize: 24 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  dateLabel: { fontSize: 13, letterSpacing: 0.2, marginTop: 2 },
  section: { borderRadius: 20, borderWidth: 1, padding: 18, marginBottom: 16, gap: 12 },
  sectionTitle: { fontSize: 11, letterSpacing: 0.6, fontWeight: '600' },
  intentionInput: {
    fontSize: 15, lineHeight: 22, minHeight: 80,
    borderWidth: 1, borderRadius: 12, padding: 12, textAlignVertical: 'top',
  },
  priorityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, paddingBottom: 10 },
  priorityNum: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  priorityNumText: { fontSize: 12, fontWeight: '700' },
  priorityInput: { flex: 1, fontSize: 15, paddingVertical: 4 },
  prompt: { fontSize: 13, letterSpacing: 0.2, marginBottom: 4 },
  ratingRow: { flexDirection: 'row', gap: 6 },
  ratingBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  ratingText: { fontSize: 11, letterSpacing: 0.1 },
  eveningInput: {
    fontSize: 14, lineHeight: 20, minHeight: 70, borderWidth: 1, borderRadius: 12, padding: 12,
  },
  eveningHint: { fontSize: 12, letterSpacing: 0.3, textAlign: 'center', marginBottom: 16 },
  saveBtn: { borderRadius: 999, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { fontSize: 15, fontWeight: '600', letterSpacing: 0.8 },
});
