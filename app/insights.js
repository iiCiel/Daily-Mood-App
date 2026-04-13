import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { router, Stack } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import AestheticBackground from '../src/components/AestheticBackground';
import { getMoodInsights } from '../src/db/database';
import { getHabitInsights } from '../src/db/habitDatabase';
import { getFocusInsights } from '../src/db/focusDatabase';
import { MOODS } from '../src/constants/theme';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function moodColor(avg) {
  if (avg == null) return null;
  return MOODS.find(m => m.value === Math.round(avg))?.color;
}

export default function InsightsScreen() {
  const C = useTheme();
  const [mood, setMood] = useState(null);
  const [habits, setHabits] = useState(null);
  const [focus, setFocus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getMoodInsights(), getHabitInsights(), getFocusInsights()])
      .then(([m, h, f]) => { setMood(m); setHabits(h); setFocus(f); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.center, { backgroundColor: C.background }]}>
        <Text style={{ color: C.textSecondary }}>loading...</Text>
      </View>
    </>
  );

  if (!mood) return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.center, { backgroundColor: C.background }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backAbs}>
          <Text style={[s.back, { color: C.text }]}>←</Text>
        </TouchableOpacity>
        <Text style={[s.emptyTitle, { color: C.text }]}>no data yet</Text>
        <Text style={[s.emptyDesc, { color: C.textSecondary }]}>log your mood for a few days to see insights.</Text>
      </View>
    </>
  );

  const totalH = focus ? Math.floor(focus.totalMins / 60) : 0;
  const totalM = focus ? focus.totalMins % 60 : 0;
  const weekH = focus ? Math.floor(focus.weekMins / 60) : 0;
  const weekM = focus ? focus.weekMins % 60 : 0;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={[s.container, { backgroundColor: C.background }]} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <AestheticBackground />

        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[s.back, { color: C.text }]}>←</Text>
          </TouchableOpacity>
          <Text style={[s.title, { color: C.text }]}>insights</Text>
        </View>

        {/* Overview */}
        <View style={s.row}>
          <View style={[s.bigCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[s.cardLbl, { color: C.textSecondary }]}>avg mood</Text>
            <Text style={[s.bigNum, { color: moodColor(mood.avgAll) || C.text }]}>{mood.avgAll ?? '—'}</Text>
            <Text style={[s.cardSub, { color: C.textSecondary }]}>{mood.total} entries</Text>
          </View>
          <View style={[s.bigCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[s.cardLbl, { color: C.textSecondary }]}>this week</Text>
            <Text style={[s.bigNum, { color: moodColor(mood.avg7) || C.text }]}>{mood.avg7 ?? '—'}</Text>
            <Text style={[s.cardSub, { color: C.textSecondary }]}>{mood.logged7} logged</Text>
          </View>
          <View style={[s.bigCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[s.cardLbl, { color: C.textSecondary }]}>best streak</Text>
            <Text style={[s.bigNum, { color: C.text }]}>{mood.bestStreak}</Text>
            <Text style={[s.cardSub, { color: C.textSecondary }]}>days</Text>
          </View>
        </View>

        {/* Day of week */}
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.secLbl, { color: C.textSecondary }]}>mood by day of week</Text>
          {mood.bestDow !== mood.worstDow && (
            <Text style={[s.patternTxt, { color: C.text }]}>
              {'best on '}
              <Text style={{ color: '#6CC97C', fontWeight: '700' }}>{DOW[mood.bestDow]}s</Text>
              {'  ·  worst on '}
              <Text style={{ color: '#F4A56A', fontWeight: '700' }}>{DOW[mood.worstDow]}s</Text>
            </Text>
          )}
          <View style={s.dowChart}>
            {DOW.map((d, i) => {
              const val = mood.dayAvgs[i];
              const h = val ? Math.max(6, Math.round((val / 5) * 56)) : 4;
              const col = val ? (moodColor(val) || C.border) : C.border;
              return (
                <View key={d} style={s.dowCol}>
                  <View style={[s.dowBar, { height: h, backgroundColor: col, opacity: i === mood.bestDow ? 1 : 0.6 }]} />
                  <Text style={[s.dowLbl, { color: C.textSecondary }]}>{d[0]}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Distribution */}
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.secLbl, { color: C.textSecondary }]}>mood distribution</Text>
          {[...MOODS].reverse().map(m => {
            const count = mood.distribution[m.value] || 0;
            const pct = mood.total > 0 ? Math.round((count / mood.total) * 100) : 0;
            return (
              <View key={m.value} style={s.distRow}>
                <Text style={[s.distLbl, { color: C.textSecondary }]}>{m.label}</Text>
                <View style={[s.distTrack, { backgroundColor: C.border }]}>
                  <View style={[s.distFill, { width: `${pct}%`, backgroundColor: m.color }]} />
                </View>
                <Text style={[s.distPct, { color: C.textSecondary }]}>{pct}%</Text>
              </View>
            );
          })}
        </View>

        {/* Habits */}
        {habits && habits.total > 0 && (
          <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[s.secLbl, { color: C.textSecondary }]}>habits</Text>
            <View style={s.row}>
              <View style={s.mini}><Text style={[s.miniNum, { color: C.text }]}>{habits.rate30}%</Text><Text style={[s.miniLbl, { color: C.textSecondary }]}>30-day rate</Text></View>
              <View style={s.mini}><Text style={[s.miniNum, { color: C.text }]}>{habits.bestStreak}d</Text><Text style={[s.miniLbl, { color: C.textSecondary }]}>best streak</Text></View>
              <View style={s.mini}><Text style={[s.miniNum, { color: C.text }]}>{habits.todayDone}/{habits.total}</Text><Text style={[s.miniLbl, { color: C.textSecondary }]}>today</Text></View>
            </View>
            <View style={[s.bigTrack, { backgroundColor: C.border }]}>
              <View style={[s.bigFill, { width: `${habits.rate30}%`, backgroundColor: '#6CC97C' }]} />
            </View>
          </View>
        )}

        {/* Focus */}
        {focus && focus.totalMins > 0 && (
          <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[s.secLbl, { color: C.textSecondary }]}>focus</Text>
            <View style={s.row}>
              <View style={s.mini}>
                <Text style={[s.miniNum, { color: C.text }]}>{totalH > 0 ? `${totalH}h ${totalM}m` : `${focus.totalMins}m`}</Text>
                <Text style={[s.miniLbl, { color: C.textSecondary }]}>total</Text>
              </View>
              <View style={s.mini}>
                <Text style={[s.miniNum, { color: C.text }]}>{weekH > 0 ? `${weekH}h ${weekM}m` : `${focus.weekMins}m`}</Text>
                <Text style={[s.miniLbl, { color: C.textSecondary }]}>this week</Text>
              </View>
              <View style={s.mini}>
                <Text style={[s.miniNum, { color: C.text }]}>{focus.totalSessions}</Text>
                <Text style={[s.miniLbl, { color: C.textSecondary }]}>sessions</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 60, paddingBottom: 50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backAbs: { position: 'absolute', top: 60, left: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 28 },
  back: { fontSize: 24 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  bigCard: { flex: 1, borderRadius: 16, borderWidth: 1, paddingVertical: 16, alignItems: 'center', gap: 4 },
  cardLbl: { fontSize: 10, letterSpacing: 0.5 },
  bigNum: { fontSize: 26, fontWeight: '800', letterSpacing: -1 },
  cardSub: { fontSize: 10, letterSpacing: 0.3 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
  secLbl: { fontSize: 12, letterSpacing: 0.5, marginBottom: 12 },
  patternTxt: { fontSize: 13, letterSpacing: 0.2, marginBottom: 12 },
  dowChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 72 },
  dowCol: { flex: 1, alignItems: 'center', gap: 6, justifyContent: 'flex-end' },
  dowBar: { width: '100%', borderRadius: 4 },
  dowLbl: { fontSize: 10, letterSpacing: 0.3 },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  distLbl: { fontSize: 12, width: 44, letterSpacing: 0.3 },
  distTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  distFill: { height: 8, borderRadius: 4 },
  distPct: { fontSize: 11, width: 32, textAlign: 'right' },
  mini: { flex: 1, alignItems: 'center', gap: 4 },
  miniNum: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  miniLbl: { fontSize: 11, letterSpacing: 0.3, textAlign: 'center' },
  bigTrack: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 4 },
  bigFill: { height: 8, borderRadius: 4 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyDesc: { fontSize: 14, textAlign: 'center', marginTop: 8, paddingHorizontal: 40 },
});
