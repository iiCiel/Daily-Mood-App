import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useFocusEffect, router, Stack } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { COLORS } from '../src/constants/theme';
import { getFocusStats, getSessionsForMonth, getTotalFocusMinutes } from '../src/db/focusDatabase';
import AestheticBackground from '../src/components/AestheticBackground';

const SCREEN_W = Dimensions.get('window').width;
const H_PAD = 24;
const CELL_GAP = 8;
const CELL_SIZE = Math.floor((SCREEN_W - H_PAD * 2 - CELL_GAP * 6) / 7);

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function minutesToColor(mins, C) {
  if (!mins) return C.card;
  if (mins >= 100) return '#6CC97C';
  if (mins >= 75)  return '#F9C74F';
  if (mins >= 50)  return '#C5A8E8';
  if (mins >= 25)  return '#F4A56A';
  return '#89B4D4';
}

export default function FocusStatsScreen() {
  const C = useTheme();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [dailyStats, setDailyStats] = useState({});
  const [totalMins, setTotalMins] = useState(0);
  const [monthSessions, setMonthSessions] = useState([]);

  useFocusEffect(useCallback(() => {
    load();
  }, [year, month]));

  async function load() {
    const [stats, sessions, total] = await Promise.all([
      getFocusStats(year, month),
      getSessionsForMonth(year, month),
      getTotalFocusMinutes(),
    ]);
    setDailyStats(stats);
    setMonthSessions(sessions);
    setTotalMins(total);
  }

  function changeMonth(delta) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    else if (m > 12) { m = 1; y += 1; }
    setMonth(m); setYear(y);
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const todayDate = new Date();
  const isCurrentMonth = todayDate.getFullYear() === year && todayDate.getMonth() + 1 === month;
  const todayDay = todayDate.getDate();

  const monthTotal = Object.values(dailyStats).reduce((sum, d) => sum + d.minutes, 0);
  const monthSessions2 = Object.values(dailyStats).reduce((sum, d) => sum + d.count, 0);
  const activeDays = Object.keys(dailyStats).length;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={[styles.container, { backgroundColor: C.background }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <AestheticBackground />
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={[styles.backText, { color: C.text }]}>←</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.title, { color: C.text }]}>focus stats</Text>

        {/* All-time stat */}
        <View style={[styles.allTimeCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.allTimeVal, { color: C.text }]}>{Math.floor(totalMins / 60)}h {totalMins % 60}m</Text>
          <Text style={[styles.allTimeLbl, { color: C.textSecondary }]}>total focused all time</Text>
        </View>

        {/* Month nav */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.navBtn}>
            <Text style={[styles.navArrow, { color: C.textSecondary }]}>‹</Text>
          </TouchableOpacity>
          <View style={styles.monthLabel}>
            <Text style={[styles.yearText, { color: C.textSecondary }]}>{year}</Text>
            <Text style={[styles.monthText, { color: C.text }]}>{MONTH_NAMES[month - 1].toUpperCase()}</Text>
          </View>
          <TouchableOpacity onPress={() => changeMonth(1)} style={styles.navBtn}>
            <Text style={[styles.navArrow, { color: C.textSecondary }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Month stats row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[styles.statVal, { color: C.text }]}>{monthSessions2}</Text>
            <Text style={[styles.statLbl, { color: C.textSecondary }]}>sessions</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[styles.statVal, { color: C.text }]}>{Math.floor(monthTotal / 60)}h {monthTotal % 60}m</Text>
            <Text style={[styles.statLbl, { color: C.textSecondary }]}>focused</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[styles.statVal, { color: C.text }]}>{activeDays}</Text>
            <Text style={[styles.statLbl, { color: C.textSecondary }]}>active days</Text>
          </View>
        </View>

        {/* Day headers */}
        <View style={styles.dayHeaders}>
          {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d) => (
            <Text key={d} style={[styles.dayHeader, { color: C.textSecondary }]}>{d}</Text>
          ))}
        </View>

        {/* Calendar heatmap */}
        <View style={styles.grid}>
          {cells.map((day, i) => {
            if (!day) return <View key={`e-${i}`} style={styles.cell} />;
            const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const stat = dailyStats[dateStr];
            const bgColor = minutesToColor(stat?.minutes, C);
            const isToday = isCurrentMonth && day === todayDay;
            const future = dateStr > new Date().toISOString().slice(0,10);

            return (
              <View key={`d-${day}`} style={styles.cell}>
                <View style={[
                  styles.dayCell,
                  { backgroundColor: bgColor },
                  isToday && { borderWidth: 2, borderColor: C.text },
                  future && { opacity: 0.3 },
                ]}>
                  <Text style={[styles.dayNum, { color: stat ? '#fff' : C.textSecondary }]}>
                    {day}
                  </Text>
                  {stat && (
                    <Text style={styles.dayMins}>{stat.minutes}m</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <Text style={[styles.legendLabel, { color: C.textSecondary }]}>less</Text>
          {[C.card, '#89B4D4', '#F4A56A', '#C5A8E8', '#F9C74F', '#6CC97C'].map((c, i) => (
            <View key={i} style={[styles.legendDot, { backgroundColor: c, borderColor: C.border }]} />
          ))}
          <Text style={[styles.legendLabel, { color: C.textSecondary }]}>more</Text>
        </View>

        {/* Recent sessions */}
        {monthSessions.length > 0 && (
          <View style={styles.sessionsSection}>
            <Text style={[styles.sectionLabel, { color: C.textSecondary }]}>sessions this month</Text>
            {monthSessions.slice(0, 10).map((s) => (
              <View key={s.id} style={[styles.sessionRow, { backgroundColor: C.card, borderColor: C.border }]}>
                <View style={[styles.sessionDot, { backgroundColor: s.completed ? '#6CC97C' : C.border }]} />
                <View style={styles.sessionInfo}>
                  <Text style={[styles.sessionTitle, { color: C.text }]}>
                    {s.task_title || 'no task'}
                  </Text>
                  <Text style={[styles.sessionDate, { color: C.textSecondary }]}>{s.date}</Text>
                </View>
                <Text style={[styles.sessionDur, { color: C.text }]}>{s.duration}m</Text>
              </View>
            ))}
          </View>
        )}

        {monthSessions.length === 0 && (
          <Text style={[styles.emptyText, { color: C.textSecondary }]}>no sessions this month</Text>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: H_PAD, paddingTop: 60, paddingBottom: 50 },
  header: { marginBottom: 8 },
  backBtn: { padding: 4, alignSelf: 'flex-start' },
  backText: { fontSize: 24 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 20 },
  allTimeCard: {
    borderRadius: 18, borderWidth: 1,
    padding: 20, alignItems: 'center',
    marginBottom: 24, gap: 4,
  },
  allTimeVal: { fontSize: 32, fontWeight: '700', letterSpacing: -1 },
  allTimeLbl: { fontSize: 13, letterSpacing: 0.3 },
  monthNav: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 16,
  },
  navBtn: { padding: 8 },
  navArrow: { fontSize: 30, lineHeight: 32 },
  monthLabel: { alignItems: 'center' },
  yearText: { fontSize: 12, letterSpacing: 1.5, fontStyle: 'italic' },
  monthText: { fontSize: 20, fontWeight: '800', letterSpacing: 3 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, borderRadius: 14, paddingVertical: 12,
    alignItems: 'center', gap: 4, borderWidth: 1,
  },
  statVal: { fontSize: 16, fontWeight: '700', letterSpacing: -0.5 },
  statLbl: { fontSize: 10, letterSpacing: 0.3 },
  dayHeaders: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  dayHeader: {
    width: CELL_SIZE, textAlign: 'center',
    fontSize: 10, fontWeight: '500', letterSpacing: 0.5,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: CELL_GAP, marginBottom: 12 },
  cell: { width: CELL_SIZE, height: CELL_SIZE * 1.1 },
  dayCell: {
    width: CELL_SIZE, height: CELL_SIZE * 1.1,
    borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  dayNum: { fontSize: 11, fontWeight: '600' },
  dayMins: { fontSize: 9, color: 'rgba(255,255,255,0.8)', marginTop: 1 },
  legend: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6, marginBottom: 24,
  },
  legendDot: { width: 14, height: 14, borderRadius: 4, borderWidth: 1 },
  legendLabel: { fontSize: 11, letterSpacing: 0.3 },
  sessionsSection: { gap: 8 },
  sectionLabel: { fontSize: 12, letterSpacing: 0.5, marginBottom: 4 },
  sessionRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1,
    padding: 14, gap: 12,
  },
  sessionDot: { width: 10, height: 10, borderRadius: 5 },
  sessionInfo: { flex: 1 },
  sessionTitle: { fontSize: 14, fontWeight: '500' },
  sessionDate: { fontSize: 12, marginTop: 2 },
  sessionDur: { fontSize: 14, fontWeight: '600' },
  emptyText: { fontSize: 13, textAlign: 'center', letterSpacing: 0.3, marginTop: 20 },
});
