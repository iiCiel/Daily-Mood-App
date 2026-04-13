import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Stack, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../src/context/ThemeContext';
import AestheticBackground from '../src/components/AestheticBackground';
import { saveSleep, getSleepEntry, getRecentSleep, deleteSleepEntry, calcDuration } from '../src/db/sleepDatabase';
import { COLORS } from '../src/constants/theme';

const QUALITY_LABELS = { 1: 'terrible', 2: 'poor', 3: 'okay', 4: 'good', 5: 'great' };
const QUALITY_COLORS = { 1: '#89B4D4', 2: '#F4A56A', 3: '#C5A8E8', 4: '#F9C74F', 5: '#6CC97C' };

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmtDuration(mins) {
  if (!mins) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m > 0 ? m + 'm' : ''}`.trim() : `${m}m`;
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = todayStr();
  const yesterday = (() => {
    const y = new Date(); y.setDate(y.getDate() - 1);
    return `${y.getFullYear()}-${String(y.getMonth()+1).padStart(2,'0')}-${String(y.getDate()).padStart(2,'0')}`;
  })();
  if (dateStr === today) return 'today';
  if (dateStr === yesterday) return 'yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function SleepScreen() {
  const C = useTheme();
  const today = todayStr();

  const [bedtime, setBedtime] = useState('');
  const [wakeTime, setWakeTime] = useState('');
  const [quality, setQuality] = useState(null);
  const [note, setNote] = useState('');
  const [recent, setRecent] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadToday();
    loadRecent();
  }, []);

  async function loadToday() {
    const entry = await getSleepEntry(today);
    if (entry) {
      setBedtime(entry.bedtime || '');
      setWakeTime(entry.wake_time || '');
      setQuality(entry.quality || null);
      setNote(entry.note || '');
    }
  }

  async function loadRecent() {
    const rows = await getRecentSleep(10);
    setRecent(rows);
  }

  async function handleSave() {
    if (!bedtime && !wakeTime && !quality) {
      Alert.alert('nothing to save', 'enter at least a bedtime, wake time, or quality rating.');
      return;
    }
    // Validate HH:MM format
    const timeRx = /^\d{1,2}:\d{2}$/;
    if (bedtime && !timeRx.test(bedtime)) { Alert.alert('invalid time', 'use HH:MM format, e.g. 23:00'); return; }
    if (wakeTime && !timeRx.test(wakeTime)) { Alert.alert('invalid time', 'use HH:MM format, e.g. 07:30'); return; }

    setSaving(true);
    try {
      await saveSleep(today, bedtime || null, wakeTime || null, quality, note);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadRecent();
      Alert.alert('saved', 'sleep logged.');
    } catch (e) {
      Alert.alert('error', 'could not save.');
    } finally {
      setSaving(false);
    }
  }

  const duration = calcDuration(bedtime, wakeTime);

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
            <Text style={[s.title, { color: C.text }]}>sleep</Text>
          </View>

          {/* Log today */}
          <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[s.cardTitle, { color: C.text }]}>last night</Text>

            <View style={s.timeRow}>
              <View style={s.timeField}>
                <Text style={[s.timeLabel, { color: C.textSecondary }]}>bedtime</Text>
                <TextInput
                  style={[s.timeInput, { backgroundColor: C.background, borderColor: C.border, color: C.text }]}
                  placeholder="23:00"
                  placeholderTextColor={C.textSecondary}
                  value={bedtime}
                  onChangeText={setBedtime}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
              </View>
              <View style={s.timeSep}>
                <Text style={[s.arrow, { color: C.border }]}>→</Text>
              </View>
              <View style={s.timeField}>
                <Text style={[s.timeLabel, { color: C.textSecondary }]}>wake up</Text>
                <TextInput
                  style={[s.timeInput, { backgroundColor: C.background, borderColor: C.border, color: C.text }]}
                  placeholder="07:30"
                  placeholderTextColor={C.textSecondary}
                  value={wakeTime}
                  onChangeText={setWakeTime}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
              </View>
              {duration !== null && (
                <View style={s.durationBadge}>
                  <Text style={[s.durationText, { color: C.text }]}>{fmtDuration(duration)}</Text>
                </View>
              )}
            </View>

            <Text style={[s.fieldLabel, { color: C.textSecondary }]}>quality</Text>
            <View style={s.qualityRow}>
              {[1, 2, 3, 4, 5].map(q => (
                <TouchableOpacity
                  key={q}
                  style={[s.qualityBtn, {
                    backgroundColor: quality === q ? QUALITY_COLORS[q] : C.background,
                    borderColor: quality === q ? QUALITY_COLORS[q] : C.border,
                  }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setQuality(q); }}
                >
                  <Text style={[s.qualityNum, { color: quality === q ? '#fff' : C.textSecondary }]}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {quality && <Text style={[s.qualityLabel, { color: QUALITY_COLORS[quality] }]}>{QUALITY_LABELS[quality]}</Text>}

            <Text style={[s.fieldLabel, { color: C.textSecondary }]}>notes (optional)</Text>
            <TextInput
              style={[s.noteInput, { backgroundColor: C.background, borderColor: C.border, color: C.text }]}
              placeholder="dreams, how you felt..."
              placeholderTextColor={C.textSecondary}
              value={note}
              onChangeText={setNote}
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: C.text }, saving && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              <Text style={[s.saveBtnText, { color: C.background }]}>{saving ? 'saving...' : 'save'}</Text>
            </TouchableOpacity>
          </View>

          {/* Recent history */}
          {recent.filter(e => e.date !== today).length > 0 && (
            <>
              <Text style={[s.sectionLabel, { color: C.textSecondary }]}>recent</Text>
              {recent.filter(e => e.date !== today).map(entry => {
                const dur = calcDuration(entry.bedtime, entry.wake_time);
                return (
                  <TouchableOpacity
                    key={entry.date}
                    style={[s.histRow, { backgroundColor: C.card, borderColor: C.border }]}
                    onLongPress={() => Alert.alert('delete', `remove sleep log for ${fmtDate(entry.date)}?`, [
                      { text: 'cancel', style: 'cancel' },
                      { text: 'delete', style: 'destructive', onPress: async () => { await deleteSleepEntry(entry.date); loadRecent(); } },
                    ])}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.histDate, { color: C.textSecondary }]}>{fmtDate(entry.date)}</Text>
                    <View style={s.histRight}>
                      {dur !== null && <Text style={[s.histDur, { color: C.text }]}>{fmtDuration(dur)}</Text>}
                      {entry.quality && (
                        <View style={[s.qualityDot, { backgroundColor: QUALITY_COLORS[entry.quality] }]} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
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
  card: { borderRadius: 20, borderWidth: 1, padding: 20, marginBottom: 24, gap: 4 },
  cardTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5, marginBottom: 12 },
  timeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 16 },
  timeField: { flex: 1, gap: 6 },
  timeLabel: { fontSize: 11, letterSpacing: 0.4 },
  timeInput: {
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 20, fontWeight: '700', letterSpacing: 1, textAlign: 'center',
  },
  timeSep: { paddingBottom: 12 },
  arrow: { fontSize: 18 },
  durationBadge: { paddingBottom: 12 },
  durationText: { fontSize: 15, fontWeight: '700', letterSpacing: -0.3 },
  fieldLabel: { fontSize: 11, letterSpacing: 0.4, marginTop: 8, marginBottom: 8 },
  qualityRow: { flexDirection: 'row', gap: 8 },
  qualityBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  qualityNum: { fontSize: 16, fontWeight: '700' },
  qualityLabel: { fontSize: 12, letterSpacing: 0.3, marginTop: 4 },
  noteInput: { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 14, minHeight: 70, lineHeight: 20 },
  saveBtn: { borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  saveBtnText: { fontSize: 15, fontWeight: '600', letterSpacing: 0.8 },
  sectionLabel: { fontSize: 12, letterSpacing: 0.5, marginBottom: 10 },
  histRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 13, marginBottom: 8,
  },
  histDate: { fontSize: 13, letterSpacing: 0.2 },
  histRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  histDur: { fontSize: 14, fontWeight: '600' },
  qualityDot: { width: 10, height: 10, borderRadius: 5 },
});
