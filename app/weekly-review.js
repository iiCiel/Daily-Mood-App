import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Share } from 'react-native';
import { Stack, router } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { getLastNDaysMoods, getStreak } from '../src/db/database';
import { getHabitInsights } from '../src/db/habitDatabase';
import { getFocusInsights } from '../src/db/focusDatabase';
import { getSleepInsights } from '../src/db/sleepDatabase';
import { getRecentCalorieSummaries, getCalorieGoal } from '../src/db/calorieDatabase';
import { getWeightEntries } from '../src/db/weightDatabase';
import { MOODS, COLORS } from '../src/constants/theme';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function moodColor(avg) {
  if (avg == null) return null;
  return MOODS.find(m => m.value === Math.round(avg))?.color;
}

function moodLabel(avg) {
  if (avg == null) return '—';
  const m = MOODS.find(m => m.value === Math.round(avg));
  return m ? m.label : '—';
}

export default function WeeklyReviewScreen() {
  const C = useTheme();
  const [loading, setLoading] = useState(true);
  const [moods, setMoods] = useState([]);
  const [habits, setHabits] = useState(null);
  const [focus, setFocus] = useState(null);
  const [sleep, setSleep] = useState(null);
  const [streak, setStreak] = useState(0);
  const [calories, setCalories] = useState([]);
  const [calorieGoal, setCalorieGoal] = useState(0);
  const [weightEntries, setWeightEntries] = useState([]);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [m, h, f, sl, s, cals, cGoal, wt] = await Promise.all([
        getLastNDaysMoods(7),
        getHabitInsights(),
        getFocusInsights(),
        getSleepInsights(),
        getStreak(),
        getRecentCalorieSummaries(7),
        getCalorieGoal(),
        getWeightEntries(7),
      ]);
      setMoods(m);
      setHabits(h);
      setFocus(f);
      setSleep(sl);
      setStreak(s);
      setCalories(cals);
      setCalorieGoal(cGoal);
      setWeightEntries(wt);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  const loggedMoods = moods.filter(d => d.mood != null);
  const avgMood = loggedMoods.length
    ? Math.round((loggedMoods.reduce((s, d) => s + d.mood, 0) / loggedMoods.length) * 10) / 10
    : null;

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const habitsDueToday = habits?.todayDue ?? habits?.total ?? 0;
  const weekLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  async function handleShare() {
    const focusH = focus ? Math.floor(focus.weekMins / 60) : 0;
    const focusM = focus ? focus.weekMins % 60 : 0;
    let text = `weekly review · ${weekLabel}\n\n`;
    if (avgMood != null) text += `mood: ${avgMood}/5 (${moodLabel(avgMood)}) · logged ${loggedMoods.length}/7 days\n`;
    if (streak > 0) text += `streak: ${streak} days 🔥\n`;
    if (habits) text += `habits: ${habits.rate30}% completion rate\n`;
    if (focus && focus.weekMins > 0) text += `focus: ${focusH > 0 ? focusH + 'h ' : ''}${focusM}m · ${focus.weekSessions} sessions\n`;
    if (sleep) text += `sleep: avg ${sleep.avgHours}h ${sleep.avgMinsRemainder}m · quality ${sleep.avgQuality}/5\n`;
    const loggedCals = calories.filter(d => d.count > 0);
    if (loggedCals.length) {
      const avg = Math.round(loggedCals.reduce((s, d) => s + d.calories, 0) / loggedCals.length);
      text += `nutrition: ${avg} kcal avg · ${loggedCals.length}/7 days logged\n`;
    }
    if (weightEntries.length) text += `weight: ${weightEntries[0].weight} ${weightEntries[0].unit}\n`;
    Share.share({ message: text });
  }

  if (loading) return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.center, { backgroundColor: C.background }]}>
        <Text style={{ color: C.textSecondary }}>loading...</Text>
      </View>
    </>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={[s.container, { backgroundColor: C.background }]} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[s.back, { color: C.text }]}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: C.text }]}>weekly review</Text>
            <Text style={[s.subtitle, { color: C.textSecondary }]}>{weekLabel}</Text>
          </View>
          <TouchableOpacity
            style={[s.shareBtn, { backgroundColor: C.card }]}
            onPress={handleShare}
          >
            <Text style={[s.shareBtnText, { color: C.textSecondary }]}>share</Text>
          </TouchableOpacity>
        </View>

        {/* Mood week strip */}
        <View style={[s.card, { backgroundColor: C.card }]}>
          <Text style={[s.cardLbl, { color: C.textSecondary }]}>mood this week</Text>
          {avgMood != null && (
            <Text style={[s.bigStat, { color: moodColor(avgMood) || C.text }]}>
              {avgMood} <Text style={[s.bigStatSub, { color: C.textSecondary }]}>{moodLabel(avgMood)}</Text>
            </Text>
          )}
          <View style={s.weekStrip}>
            {moods.map((day, i) => {
              const d = new Date(day.date + 'T00:00:00');
              const col = day.mood ? (MOODS.find(m => m.value === day.mood)?.color || C.border) : C.border;
              return (
                <View key={day.date} style={s.weekDay}>
                  <View style={[s.weekDot, {
                    backgroundColor: col,
                    width: day.mood ? 32 : 24,
                    height: day.mood ? 32 : 24,
                    borderRadius: day.mood ? 16 : 12,
                    opacity: day.mood ? 1 : 0.3,
                  }]} />
                  <Text style={[s.weekDayLbl, { color: C.textSecondary }]}>{DOW[d.getDay()][0]}</Text>
                </View>
              );
            })}
          </View>
          <Text style={[s.cardNote, { color: C.textSecondary }]}>
            logged {loggedMoods.length}/7 days · {streak} day streak 🔥
          </Text>
        </View>

        {/* Habits */}
        {habits && habits.total > 0 && (
          <View style={[s.card, { backgroundColor: C.card }]}>
            <Text style={[s.cardLbl, { color: C.textSecondary }]}>habits</Text>
            <Text style={[s.bigStat, { color: C.text }]}>
              {habits.rate30}%
              <Text style={[s.bigStatSub, { color: C.textSecondary }]}> 30-day rate</Text>
            </Text>
            <View style={[s.track, { backgroundColor: C.border }]}>
              <View style={[s.fill, { width: `${habits.rate30}%`, backgroundColor: '#6CC97C' }]} />
            </View>
            <Text style={[s.cardNote, { color: C.textSecondary }]}>
              {habits.todayDone}/{habitsDueToday} due today · best streak {habits.bestStreak}d
            </Text>
          </View>
        )}

        {/* Focus */}
        {focus && focus.weekMins > 0 && (
          <View style={[s.card, { backgroundColor: C.card }]}>
            <Text style={[s.cardLbl, { color: C.textSecondary }]}>focus</Text>
            <Text style={[s.bigStat, { color: C.text }]}>
              {Math.floor(focus.weekMins / 60) > 0
                ? `${Math.floor(focus.weekMins / 60)}h ${focus.weekMins % 60}m`
                : `${focus.weekMins}m`}
              <Text style={[s.bigStatSub, { color: C.textSecondary }]}> this week</Text>
            </Text>
            <Text style={[s.cardNote, { color: C.textSecondary }]}>
              {focus.weekSessions} sessions · {focus.totalSessions} total all time
            </Text>
          </View>
        )}

        {/* Sleep */}
        {sleep && (
          <View style={[s.card, { backgroundColor: C.card }]}>
            <Text style={[s.cardLbl, { color: C.textSecondary }]}>sleep</Text>
            <Text style={[s.bigStat, { color: C.text }]}>
              {sleep.avgHours}h {sleep.avgMinsRemainder > 0 ? `${sleep.avgMinsRemainder}m` : ''}
              <Text style={[s.bigStatSub, { color: C.textSecondary }]}> avg per night</Text>
            </Text>
            <Text style={[s.cardNote, { color: C.textSecondary }]}>
              quality {sleep.avgQuality}/5 · {sleep.totalLogged} nights logged
            </Text>
          </View>
        )}

        {/* Calories */}
        {(() => {
          const logged = calories.filter((d) => d.count > 0);
          if (!logged.length) return null;
          const avgCal = Math.round(logged.reduce((s, d) => s + d.calories, 0) / logged.length);
          const withinGoal = calorieGoal > 0 ? logged.filter((d) => d.calories <= calorieGoal).length : null;
          return (
            <View style={[s.card, { backgroundColor: C.card }]}>
              <Text style={[s.cardLbl, { color: C.textSecondary }]}>nutrition</Text>
              <Text style={[s.bigStat, { color: C.text }]}>
                {avgCal}
                <Text style={[s.bigStatSub, { color: C.textSecondary }]}> kcal avg/day</Text>
              </Text>
              <Text style={[s.cardNote, { color: C.textSecondary }]}>
                {logged.length}/7 days logged
                {withinGoal != null ? ` · ${withinGoal}/${logged.length} within goal` : ''}
              </Text>
            </View>
          );
        })()}

        {/* Weight */}
        {weightEntries.length > 0 && (() => {
          const latest = weightEntries[0];
          const oldest = weightEntries[weightEntries.length - 1];
          const change = weightEntries.length > 1
            ? Math.round((latest.weight - oldest.weight) * 10) / 10
            : null;
          return (
            <View style={[s.card, { backgroundColor: C.card }]}>
              <Text style={[s.cardLbl, { color: C.textSecondary }]}>weight</Text>
              <Text style={[s.bigStat, { color: C.text }]}>
                {latest.weight}
                <Text style={[s.bigStatSub, { color: C.textSecondary }]}> {latest.unit}</Text>
              </Text>
              {change != null && (
                <Text style={[s.cardNote, { color: change > 0 ? C.danger : change < 0 ? C.success : C.textSecondary }]}>
                  {change > 0 ? '+' : ''}{change} {latest.unit} this week
                </Text>
              )}
            </View>
          );
        })()}

        {!avgMood && !habits?.total && !focus?.weekMins && !sleep && !calories.some(d => d.count > 0) && !weightEntries.length && (
          <View style={s.empty}>
            <Text style={[s.emptyTitle, { color: C.text }]}>nothing logged yet</Text>
            <Text style={[s.emptyDesc, { color: C.textSecondary }]}>
              log your mood, habits, focus sessions, and sleep to see your weekly summary here.
            </Text>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 28 },
  back: { fontSize: 24 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 12, letterSpacing: 0.3, marginTop: 2 },
  shareBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, elevation: 1 },
  shareBtnText: { fontSize: 13 },
  card: { borderRadius: 20, elevation: 2, padding: 18, marginBottom: 16, gap: 10 },
  cardLbl: { fontSize: 11, letterSpacing: 0.6 },
  bigStat: { fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  bigStatSub: { fontSize: 15, fontWeight: '400', letterSpacing: 0 },
  weekStrip: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDay: { alignItems: 'center', gap: 6 },
  weekDot: {},
  weekDayLbl: { fontSize: 10, letterSpacing: 0.3 },
  cardNote: { fontSize: 12, letterSpacing: 0.2 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  empty: { alignItems: 'center', paddingTop: 40, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
});
