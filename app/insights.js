import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { router, Stack } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { getMoodInsights } from '../src/db/database';
import { getHabitInsights } from '../src/db/habitDatabase';
import { getFocusInsights } from '../src/db/focusDatabase';
import { getSleepInsights } from '../src/db/sleepDatabase';
import { getCalorieInsights } from '../src/db/calorieDatabase';
import { getWeightInsights } from '../src/db/weightDatabase';
import { MOODS } from '../src/constants/theme';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MEALS = [
  { key: 'breakfast', label: 'Breakfast', color: '#F9C74F' },
  { key: 'lunch', label: 'Lunch', color: '#6CC97C' },
  { key: 'dinner', label: 'Dinner', color: '#89B4D4' },
  { key: 'snack', label: 'Snack', color: '#C5A8E8' },
];

function moodColor(avg) {
  if (avg == null) return null;
  return MOODS.find(m => m.value === Math.round(avg))?.color;
}

export default function InsightsScreen() {
  const C = useTheme();
  const [mood, setMood] = useState(null);
  const [habits, setHabits] = useState(null);
  const [focus, setFocus] = useState(null);
  const [sleep, setSleep] = useState(null);
  const [calories, setCalories] = useState(null);
  const [weight, setWeight] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getMoodInsights(), getHabitInsights(), getFocusInsights(), getSleepInsights(), getCalorieInsights(), getWeightInsights()])
      .then(([m, h, f, sl, cals, wt]) => {
        setMood(m);
        setHabits(h);
        setFocus(f);
        setSleep(sl);
        setCalories(cals);
        setWeight(wt);
      })
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

  const hasInsights = !!mood || (habits && habits.total > 0) || (focus && focus.totalMins > 0) || !!sleep || !!calories || !!weight;

  if (!hasInsights) return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.center, { backgroundColor: C.background }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backAbs}>
          <Text style={[s.back, { color: C.text }]}>←</Text>
        </TouchableOpacity>
        <Text style={[s.emptyTitle, { color: C.text }]}>no data yet</Text>
        <Text style={[s.emptyDesc, { color: C.textSecondary }]}>log a few days to see trends here.</Text>
      </View>
    </>
  );

  const totalH = focus ? Math.floor(focus.totalMins / 60) : 0;
  const totalM = focus ? focus.totalMins % 60 : 0;
  const weekH = focus ? Math.floor(focus.weekMins / 60) : 0;
  const weekM = focus ? focus.weekMins % 60 : 0;
  const calorieBarMax = calories ? Math.max(calories.goal, ...calories.recent.map((day) => day.calories), 1) : 1;
  const maxMealCalories = calories
    ? Math.max(1, ...MEALS.map((meal) => calories.mealTotals[meal.key]?.calories || 0))
    : 1;
  const habitsDueToday = habits?.todayDue ?? habits?.total ?? 0;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={[s.container, { backgroundColor: C.background }]} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[s.back, { color: C.text }]}>←</Text>
          </TouchableOpacity>
          <Text style={[s.title, { color: C.text }]}>insights</Text>
        </View>

        {/* Overview */}
        {mood && (
        <View style={s.row}>
          <View style={[s.bigCard, { backgroundColor: C.card }]}>
            <Text style={[s.cardLbl, { color: C.textSecondary }]}>avg mood</Text>
            <Text style={[s.bigNum, { color: moodColor(mood.avgAll) || C.text }]}>{mood.avgAll ?? '—'}</Text>
            <Text style={[s.cardSub, { color: C.textSecondary }]}>{mood.total} entries</Text>
          </View>
          <View style={[s.bigCard, { backgroundColor: C.card }]}>
            <Text style={[s.cardLbl, { color: C.textSecondary }]}>this week</Text>
            <Text style={[s.bigNum, { color: moodColor(mood.avg7) || C.text }]}>{mood.avg7 ?? '—'}</Text>
            <Text style={[s.cardSub, { color: C.textSecondary }]}>{mood.logged7} logged</Text>
          </View>
          <View style={[s.bigCard, { backgroundColor: C.card }]}>
            <Text style={[s.cardLbl, { color: C.textSecondary }]}>best streak</Text>
            <Text style={[s.bigNum, { color: C.text }]}>{mood.bestStreak}</Text>
            <Text style={[s.cardSub, { color: C.textSecondary }]}>days</Text>
          </View>
        </View>
        )}

        {/* Day of week */}
        {mood && (
        <View style={[s.card, { backgroundColor: C.card }]}>
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
        )}

        {/* Distribution */}
        {mood && (
        <View style={[s.card, { backgroundColor: C.card }]}>
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
        )}

        {/* Nutrition */}
        {calories && (
          <View style={[s.card, { backgroundColor: C.card }]}>
            <Text style={[s.secLbl, { color: C.textSecondary }]}>nutrition</Text>
            <View style={s.row}>
              <View style={s.mini}>
                <Text style={[s.miniNum, { color: C.text }]}>{calories.avgCalories}</Text>
                <Text style={[s.miniLbl, { color: C.textSecondary }]}>avg kcal</Text>
              </View>
              <View style={s.mini}>
                <Text style={[s.miniNum, { color: C.text }]}>{calories.avgCalories7 || '-'}</Text>
                <Text style={[s.miniLbl, { color: C.textSecondary }]}>7-day avg</Text>
              </View>
              <View style={s.mini}>
                <Text style={[s.miniNum, { color: C.text }]}>{calories.goalDays}/{calories.loggedDays}</Text>
                <Text style={[s.miniLbl, { color: C.textSecondary }]}>within goal</Text>
              </View>
            </View>

            <View style={s.calorieBars}>
              <View style={[s.calorieGoalLine, {
                bottom: 18 + Math.round((calories.goal / calorieBarMax) * 58),
                backgroundColor: C.accent,
              }]} />
              {calories.recent.map((day) => {
                const h = day.calories ? Math.max(6, Math.round((day.calories / calorieBarMax) * 58)) : 4;
                const over = day.calories > calories.goal;
                const dow = new Date(day.date + 'T00:00:00').getDay();
                return (
                  <View key={day.date} style={s.calorieCol}>
                    <View style={[s.calorieBar, { height: h, backgroundColor: over ? C.danger : C.primary, opacity: day.calories ? 0.9 : 0.3 }]} />
                    <Text style={[s.dowLbl, { color: C.textSecondary }]}>{DOW[dow][0]}</Text>
                  </View>
                );
              })}
            </View>

            <View style={s.macroInsightRow}>
              <View style={[s.macroPill, { backgroundColor: C.background }]}>
                <Text style={[s.macroPillValue, { color: C.text }]}>{calories.avgProtein}g</Text>
                <Text style={[s.macroPillLabel, { color: C.textSecondary }]}>protein</Text>
              </View>
              <View style={[s.macroPill, { backgroundColor: C.background }]}>
                <Text style={[s.macroPillValue, { color: C.text }]}>{calories.avgCarbs}g</Text>
                <Text style={[s.macroPillLabel, { color: C.textSecondary }]}>carbs</Text>
              </View>
              <View style={[s.macroPill, { backgroundColor: C.background }]}>
                <Text style={[s.macroPillValue, { color: C.text }]}>{calories.avgFat}g</Text>
                <Text style={[s.macroPillLabel, { color: C.textSecondary }]}>fat</Text>
              </View>
            </View>

            {MEALS.map((meal) => {
              const total = calories.mealTotals[meal.key]?.calories || 0;
              return (
                <View key={meal.key} style={s.mealInsightRow}>
                  <Text style={[s.mealInsightLabel, { color: C.textSecondary }]}>{meal.label}</Text>
                  <View style={[s.mealInsightTrack, { backgroundColor: C.border }]}>
                    <View style={[s.mealInsightFill, { width: `${(total / maxMealCalories) * 100}%`, backgroundColor: meal.color }]} />
                  </View>
                  <Text style={[s.mealInsightValue, { color: C.textSecondary }]}>{total}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Habits */}
        {habits && habits.total > 0 && (
          <View style={[s.card, { backgroundColor: C.card }]}>
            <Text style={[s.secLbl, { color: C.textSecondary }]}>habits</Text>
            <View style={s.row}>
              <View style={s.mini}><Text style={[s.miniNum, { color: C.text }]}>{habits.rate30}%</Text><Text style={[s.miniLbl, { color: C.textSecondary }]}>30-day rate</Text></View>
              <View style={s.mini}><Text style={[s.miniNum, { color: C.text }]}>{habits.bestStreak}d</Text><Text style={[s.miniLbl, { color: C.textSecondary }]}>best streak</Text></View>
              <View style={s.mini}><Text style={[s.miniNum, { color: C.text }]}>{habits.todayDone}/{habitsDueToday}</Text><Text style={[s.miniLbl, { color: C.textSecondary }]}>due today</Text></View>
            </View>
            <View style={[s.bigTrack, { backgroundColor: C.border }]}>
              <View style={[s.bigFill, { width: `${habits.rate30}%`, backgroundColor: '#6CC97C' }]} />
            </View>
          </View>
        )}

        {/* Focus */}
        {focus && focus.totalMins > 0 && (
          <View style={[s.card, { backgroundColor: C.card }]}>
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

        {/* Sleep */}
        {sleep && (
          <View style={[s.card, { backgroundColor: C.card }]}>
            <Text style={[s.secLbl, { color: C.textSecondary }]}>sleep</Text>
            <View style={s.row}>
              <View style={s.mini}>
                <Text style={[s.miniNum, { color: C.text }]}>
                  {sleep.avgHours}h{sleep.avgMinsRemainder > 0 ? ` ${sleep.avgMinsRemainder}m` : ''}
                </Text>
                <Text style={[s.miniLbl, { color: C.textSecondary }]}>avg duration</Text>
              </View>
              <View style={s.mini}>
                <Text style={[s.miniNum, { color: C.text }]}>{sleep.avgQuality}/5</Text>
                <Text style={[s.miniLbl, { color: C.textSecondary }]}>avg quality</Text>
              </View>
              <View style={s.mini}>
                <Text style={[s.miniNum, { color: C.text }]}>{sleep.totalLogged}</Text>
                <Text style={[s.miniLbl, { color: C.textSecondary }]}>nights logged</Text>
              </View>
            </View>
          </View>
        )}

        {/* Weight */}
        {weight && (
          <View style={[s.card, { backgroundColor: C.card }]}>
            <Text style={[s.secLbl, { color: C.textSecondary }]}>weight</Text>
            <View style={s.row}>
              <View style={s.mini}>
                <Text style={[s.miniNum, { color: C.text }]}>{weight.latest} {weight.unit}</Text>
                <Text style={[s.miniLbl, { color: C.textSecondary }]}>current</Text>
              </View>
              <View style={s.mini}>
                <Text style={[s.miniNum, { color: weight.change > 0 ? C.danger : weight.change < 0 ? C.success : C.text }]}>
                  {weight.change > 0 ? '+' : ''}{weight.change} {weight.unit}
                </Text>
                <Text style={[s.miniLbl, { color: C.textSecondary }]}>change</Text>
              </View>
              <View style={s.mini}>
                <Text style={[s.miniNum, { color: C.text }]}>{weight.count}</Text>
                <Text style={[s.miniLbl, { color: C.textSecondary }]}>entries</Text>
              </View>
            </View>
            {weight.entries.length > 1 && (() => {
              const wMin = weight.min;
              const wRange = Math.max(weight.max - weight.min, 0.1);
              return (
                <View style={s.calorieBars}>
                  {weight.entries.slice(-14).map((entry) => {
                    const h = Math.round(((entry.weight - wMin) / wRange) * 52) + 10;
                    return (
                      <View key={entry.date} style={s.calorieCol}>
                        <View style={[s.calorieBar, { height: h, backgroundColor: C.primary, opacity: 0.85 }]} />
                        <Text style={[s.dowLbl, { color: C.textSecondary }]}>
                          {new Date(entry.date + 'T00:00:00').getDate()}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              );
            })()}
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
  bigCard: { flex: 1, borderRadius: 16, elevation: 2, paddingVertical: 16, alignItems: 'center', gap: 4 },
  cardLbl: { fontSize: 10, letterSpacing: 0.5 },
  bigNum: { fontSize: 26, fontWeight: '800', letterSpacing: -1 },
  cardSub: { fontSize: 10, letterSpacing: 0.3 },
  card: { borderRadius: 16, elevation: 2, padding: 16, marginBottom: 16 },
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
  calorieBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 82, marginBottom: 14 },
  calorieCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  calorieBar: { width: '100%', borderRadius: 5, minHeight: 4 },
  calorieGoalLine: { position: 'absolute', left: 0, right: 0, height: 1, opacity: 0.55, zIndex: 1 },
  macroInsightRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  macroPill: { flex: 1, borderRadius: 12, paddingVertical: 9, alignItems: 'center' },
  macroPillValue: { fontSize: 14, fontWeight: '800' },
  macroPillLabel: { fontSize: 10, letterSpacing: 0.3, marginTop: 2 },
  mealInsightRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  mealInsightLabel: { fontSize: 11, width: 58 },
  mealInsightTrack: { flex: 1, height: 7, borderRadius: 4, overflow: 'hidden' },
  mealInsightFill: { height: 7, borderRadius: 4 },
  mealInsightValue: { fontSize: 11, width: 42, textAlign: 'right' },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyDesc: { fontSize: 14, textAlign: 'center', marginTop: 8, paddingHorizontal: 40 },
});
