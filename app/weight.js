import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../src/context/ThemeContext';
import {
  getWeightEntry,
  getWeightEntries,
  saveWeightEntry,
  deleteWeightEntry,
  getWeightUnit,
  saveWeightUnit,
} from '../src/db/weightDatabase';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftDate(date, amount) {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + amount);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDate(date) {
  const today = todayStr();
  const yesterday = shiftDate(today, -1);
  if (date === today) return 'today';
  if (date === yesterday) return 'yesterday';
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function fmtFullDate(date) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  }).toLowerCase();
}

export default function WeightScreen() {
  const C = useTheme();
  const today = todayStr();

  const [selectedDate, setSelectedDate] = useState(today);
  const [existingEntry, setExistingEntry] = useState(null);
  const [weight, setWeight] = useState('');
  const [unit, setUnit] = useState('kg');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);

  useFocusEffect(useCallback(() => {
    load();
  }, [selectedDate]));

  async function load() {
    const [entry, entries, savedUnit] = await Promise.all([
      getWeightEntry(selectedDate),
      getWeightEntries(30),
      getWeightUnit(),
    ]);
    setUnit(savedUnit);
    setHistory(entries);
    if (entry) {
      setExistingEntry(entry);
      setWeight(String(entry.weight));
      setNote(entry.note || '');
    } else {
      setExistingEntry(null);
      setWeight('');
      setNote('');
    }
  }

  async function handleSave() {
    const w = parseFloat(weight);
    if (!weight.trim() || !Number.isFinite(w) || w <= 0) {
      Alert.alert('enter weight', 'please enter a valid weight.');
      return;
    }
    setSaving(true);
    try {
      await saveWeightEntry({ date: selectedDate, weight: w, unit, note });
      await saveWeightUnit(unit);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    } catch {
      Alert.alert('error', 'could not save weight entry.');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!existingEntry) return;
    Alert.alert('delete entry', `remove weight for ${fmtDate(selectedDate)}?`, [
      { text: 'cancel', style: 'cancel' },
      {
        text: 'delete', style: 'destructive',
        onPress: async () => {
          await deleteWeightEntry(existingEntry.id);
          await load();
        },
      },
    ]);
  }

  function switchUnit(u) {
    if (u === unit) return;
    const w = parseFloat(weight);
    if (Number.isFinite(w) && w > 0) {
      if (u === 'lbs') setWeight(String(Math.round(w * 2.20462 * 10) / 10));
      else setWeight(String(Math.round(w / 2.20462 * 10) / 10));
    }
    setUnit(u);
  }

  const canGoForward = selectedDate < today;
  const chartEntries = [...history].reverse().slice(-14);
  const chartWeights = chartEntries.map((e) => e.weight);
  const chartMin = chartWeights.length ? Math.min(...chartWeights) : 0;
  const chartMax = chartWeights.length ? Math.max(...chartWeights) : 1;
  const chartRange = Math.max(chartMax - chartMin, 0.1);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={[s.flex, { backgroundColor: C.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={[s.flex, { backgroundColor: C.background }]}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.header}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
              <Text style={[s.back, { color: C.text }]}>←</Text>
            </TouchableOpacity>
            <View style={s.headerTitleWrap}>
              <Text style={[s.title, { color: C.text }]}>weight</Text>
              <Text style={[s.dateLabel, { color: C.textSecondary }]}>{fmtDate(selectedDate)}</Text>
            </View>
            <TouchableOpacity
              style={[s.todayBtn, { backgroundColor: C.card, borderColor: C.border }]}
              onPress={() => setSelectedDate(today)}
              activeOpacity={0.75}
            >
              <Text style={[s.todayText, { color: C.text }]}>today</Text>
            </TouchableOpacity>
          </View>

          <View style={s.dateNav}>
            <TouchableOpacity
              style={[s.navBtn, { backgroundColor: C.card, borderColor: C.border }]}
              onPress={() => setSelectedDate(shiftDate(selectedDate, -1))}
            >
              <Text style={[s.navText, { color: C.text }]}>{'<'}</Text>
            </TouchableOpacity>
            <Text style={[s.fullDate, { color: C.textSecondary }]}>{fmtFullDate(selectedDate)}</Text>
            <TouchableOpacity
              style={[s.navBtn, { backgroundColor: C.card, borderColor: C.border }, !canGoForward && { opacity: 0.35 }]}
              disabled={!canGoForward}
              onPress={() => setSelectedDate(shiftDate(selectedDate, 1))}
            >
              <Text style={[s.navText, { color: C.text }]}>{'>'}</Text>
            </TouchableOpacity>
          </View>

          <View style={[s.card, { backgroundColor: C.card }]}>
            <View style={s.cardHeader}>
              <Text style={[s.cardTitle, { color: C.text }]}>
                {existingEntry ? 'update entry' : 'log weight'}
              </Text>
              {existingEntry && (
                <TouchableOpacity onPress={handleDelete}>
                  <Text style={[s.deleteText, { color: C.danger }]}>delete</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={[s.unitToggle, { backgroundColor: C.background }]}>
              {['kg', 'lbs'].map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[s.unitBtn, unit === u && { backgroundColor: C.accent }]}
                  onPress={() => switchUnit(u)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.unitText, { color: unit === u ? C.background : C.textSecondary }]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.weightRow}>
              <TextInput
                style={[s.weightInput, { color: C.text, borderColor: C.border, backgroundColor: C.background }]}
                placeholder="0.0"
                placeholderTextColor={C.textSecondary}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
              />
              <Text style={[s.weightUnit, { color: C.textSecondary }]}>{unit}</Text>
            </View>

            <TextInput
              style={[s.noteInput, { color: C.text, borderColor: C.border, backgroundColor: C.background }]}
              placeholder="note (optional)"
              placeholderTextColor={C.textSecondary}
              value={note}
              onChangeText={setNote}
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: C.accent }, saving && { opacity: 0.55 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              <Text style={[s.saveBtnText, { color: C.background }]}>
                {saving ? 'saving...' : existingEntry ? 'update' : 'save'}
              </Text>
            </TouchableOpacity>
          </View>

          {chartEntries.length > 1 && (
            <View style={[s.card, { backgroundColor: C.card }]}>
              <Text style={[s.cardTitle, { color: C.text }]}>trend</Text>
              <View style={s.chartRow}>
                {chartEntries.map((entry) => {
                  const h = Math.round(((entry.weight - chartMin) / chartRange) * 48) + 12;
                  const isSelected = entry.date === selectedDate;
                  return (
                    <TouchableOpacity
                      key={entry.date}
                      style={s.chartCol}
                      onPress={() => setSelectedDate(entry.date)}
                      activeOpacity={0.75}
                    >
                      <View style={[
                        s.chartBar,
                        { height: h, backgroundColor: isSelected ? C.accent : C.primary, opacity: isSelected ? 1 : 0.6 },
                      ]} />
                      <Text style={[s.chartLabel, { color: C.textSecondary }]}>
                        {new Date(entry.date + 'T00:00:00').getDate()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={s.chartStats}>
                <Text style={[s.chartStat, { color: C.textSecondary }]}>min {chartMin} {unit}</Text>
                <Text style={[s.chartStat, { color: C.textSecondary }]}>max {chartMax} {unit}</Text>
              </View>
            </View>
          )}

          {history.length > 0 && (
            <View style={[s.card, { backgroundColor: C.card }]}>
              <Text style={[s.cardTitle, { color: C.text }]}>history</Text>
              {history.map((entry) => {
                const isSelected = entry.date === selectedDate;
                return (
                  <TouchableOpacity
                    key={entry.id}
                    style={[s.historyRow, { backgroundColor: C.background, borderColor: isSelected ? C.accent : 'transparent' }]}
                    onPress={() => setSelectedDate(entry.date)}
                    activeOpacity={0.75}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[s.historyDate, { color: C.text }]}>{fmtDate(entry.date)}</Text>
                      {entry.note ? (
                        <Text style={[s.historyNote, { color: C.textSecondary }]} numberOfLines={1}>{entry.note}</Text>
                      ) : null}
                    </View>
                    <Text style={[s.historyWeight, { color: C.text }]}>
                      {entry.weight}{' '}
                      <Text style={{ color: C.textSecondary, fontSize: 13, fontWeight: '700' }}>{entry.unit}</Text>
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 24, paddingTop: 60, paddingBottom: 50 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  back: { fontSize: 24, fontWeight: '800' },
  headerTitleWrap: { flex: 1 },
  title: { fontSize: 26, fontWeight: '800' },
  dateLabel: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  todayBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  todayText: { fontSize: 12, fontWeight: '800' },
  dateNav: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  navBtn: { width: 38, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 17, fontWeight: '900' },
  fullDate: { flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '700' },
  card: { borderRadius: 22, padding: 18, marginBottom: 16, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  cardTitle: { fontSize: 17, fontWeight: '900' },
  deleteText: { fontSize: 12, fontWeight: '800' },
  unitToggle: { flexDirection: 'row', borderRadius: 14, padding: 3, alignSelf: 'flex-start', gap: 3, marginBottom: 14 },
  unitBtn: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 11 },
  unitText: { fontSize: 13, fontWeight: '900' },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  weightInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
  },
  weightUnit: { fontSize: 18, fontWeight: '800', minWidth: 32 },
  noteInput: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    fontSize: 14,
    minHeight: 60,
    lineHeight: 20,
    marginBottom: 12,
  },
  saveBtn: { borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '800' },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 72, marginTop: 14, marginBottom: 8 },
  chartCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
  chartBar: { width: '100%', borderRadius: 4, minHeight: 4 },
  chartLabel: { fontSize: 9, fontWeight: '700' },
  chartStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  chartStat: { fontSize: 11, fontWeight: '700' },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 13,
    marginTop: 8,
    borderWidth: 1.5,
  },
  historyDate: { fontSize: 14, fontWeight: '800' },
  historyNote: { fontSize: 11, fontWeight: '600', marginTop: 3 },
  historyWeight: { fontSize: 20, fontWeight: '900' },
});
