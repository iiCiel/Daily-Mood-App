import React, { useCallback, useState } from 'react';
import {
  Dimensions,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { getFocusStats, getSessionsForMonth, getTotalFocusMinutes } from '../src/db/focusDatabase';

const paperArt = require('../assets/illustrations/storybook-paper-rich.png');

const SCREEN_W = Dimensions.get('window').width;
const H_PAD = 20;
const CELL_GAP = 7;
const CELL_SIZE = Math.floor((SCREEN_W - H_PAD * 2 - CELL_GAP * 6) / 7);

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function minutesToColor(mins, C) {
  if (!mins) return C.card;
  if (mins >= 100) return '#6CC97C';
  if (mins >= 75) return '#F9C74F';
  if (mins >= 50) return '#C5A8E8';
  if (mins >= 25) return '#F4A56A';
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
    setMonth(m);
    setYear(y);
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const todayDate = new Date();
  const isCurrentMonth = todayDate.getFullYear() === year && todayDate.getMonth() + 1 === month;
  const todayDay = todayDate.getDate();
  const todayStr = todayDate.toISOString().slice(0, 10);
  const monthTotal = Object.values(dailyStats).reduce((sum, d) => sum + d.minutes, 0);
  const sessionCount = Object.values(dailyStats).reduce((sum, d) => sum + d.count, 0);
  const activeDays = Object.keys(dailyStats).length;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ImageBackground source={paperArt} style={[styles.container, { backgroundColor: C.background }]} imageStyle={styles.backgroundImage}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            <TouchableOpacity style={[styles.iconButton, { backgroundColor: C.card, borderColor: C.border }]} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={19} color={C.text} />
            </TouchableOpacity>
          </View>

          <View style={[styles.heroCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={[styles.heroIcon, { backgroundColor: C.primaryLight }]}>
              <Ionicons name="stats-chart-outline" size={25} color={C.primary} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={[styles.title, { color: C.text }]}>Focus Stats</Text>
              <Text style={[styles.script, { color: C.text }]}>little moments add up</Text>
            </View>
            <View style={[styles.totalBubble, { backgroundColor: C.primaryLight }]}>
              <Text style={[styles.totalValue, { color: C.primary }]}>{Math.floor(totalMins / 60)}h</Text>
              <Text style={[styles.totalLabel, { color: C.textSecondary }]}>{totalMins % 60}m</Text>
            </View>
          </View>

          <View style={styles.monthNav}>
            <TouchableOpacity style={[styles.monthBtn, { backgroundColor: C.card, borderColor: C.border }]} onPress={() => changeMonth(-1)}>
              <Ionicons name="chevron-back" size={18} color={C.primary} />
            </TouchableOpacity>
            <View style={styles.monthLabel}>
              <Text style={[styles.yearText, { color: C.textSecondary }]}>{year}</Text>
              <Text style={[styles.monthText, { color: C.text }]}>{MONTH_NAMES[month - 1]}</Text>
            </View>
            <TouchableOpacity style={[styles.monthBtn, { backgroundColor: C.card, borderColor: C.border }]} onPress={() => changeMonth(1)}>
              <Ionicons name="chevron-forward" size={18} color={C.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.statsRow}>
            <StatCard C={C} value={sessionCount} label="sessions" icon="play-circle-outline" />
            <StatCard C={C} value={`${Math.floor(monthTotal / 60)}h ${monthTotal % 60}m`} label="focused" icon="timer-outline" />
            <StatCard C={C} value={activeDays} label="active days" icon="sparkles-outline" />
          </View>

          <View style={[styles.calendarCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={styles.dayHeaders}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <Text key={d} style={[styles.dayHeader, { color: C.textSecondary }]}>{d}</Text>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((day, i) => {
                if (!day) return <View key={`empty-${i}`} style={styles.cell} />;
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const stat = dailyStats[dateStr];
                const bgColor = minutesToColor(stat?.minutes, C);
                const isToday = isCurrentMonth && day === todayDay;
                const future = dateStr > todayStr;

                return (
                  <View key={dateStr} style={styles.cell}>
                    <View style={[
                      styles.dayCell,
                      { backgroundColor: bgColor, borderColor: stat ? 'rgba(255,255,255,0.6)' : C.border },
                      isToday && { borderColor: C.primary, borderWidth: 2 },
                      future && { opacity: 0.34 },
                    ]}>
                      <Text style={[styles.dayNum, { color: stat ? '#fff' : C.textSecondary }]}>{day}</Text>
                      {!!stat && <Text style={styles.dayMins}>{stat.minutes}m</Text>}
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.legend}>
              <Text style={[styles.legendLabel, { color: C.textSecondary }]}>less</Text>
              {[C.card, '#89B4D4', '#F4A56A', '#C5A8E8', '#F9C74F', '#6CC97C'].map((color, i) => (
                <View key={`${color}-${i}`} style={[styles.legendDot, { backgroundColor: color, borderColor: C.border }]} />
              ))}
              <Text style={[styles.legendLabel, { color: C.textSecondary }]}>more</Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: C.text }]}>This month's sessions</Text>
          <View style={styles.sessionsSection}>
            {monthSessions.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: C.card, borderColor: C.border }]}>
                <Ionicons name="musical-notes-outline" size={20} color={C.primary} />
                <Text style={[styles.emptyText, { color: C.textSecondary }]}>No focus sessions this month.</Text>
              </View>
            ) : monthSessions.slice(0, 10).map((session) => (
              <View key={session.id} style={[styles.sessionRow, { backgroundColor: C.card, borderColor: C.border }]}>
                <View style={[styles.sessionDot, { backgroundColor: session.completed ? C.success : C.border }]} />
                <View style={styles.sessionInfo}>
                  <Text style={[styles.sessionTitle, { color: C.text }]} numberOfLines={1}>
                    {session.task_title || session.label || 'Focus session'}
                  </Text>
                  <Text style={[styles.sessionDate, { color: C.textSecondary }]}>{session.date}</Text>
                </View>
                <Text style={[styles.sessionDur, { color: C.primary }]}>{session.duration}m</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </ImageBackground>
    </>
  );
}

function StatCard({ C, value, label, icon }) {
  return (
    <View style={[styles.statCard, { backgroundColor: C.card, borderColor: C.border }]}>
      <Ionicons name={icon} size={17} color={C.primary} />
      <Text style={[styles.statVal, { color: C.text }]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.statLbl, { color: C.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundImage: { resizeMode: 'cover' },
  content: { paddingHorizontal: H_PAD, paddingTop: 54, paddingBottom: 122 },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#5B3B2B',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  heroCard: {
    minHeight: 132,
    borderRadius: 30,
    borderWidth: 1,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#5B3B2B',
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
  },
  heroIcon: { width: 58, height: 58, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1 },
  title: { fontFamily: 'Rounded', fontSize: 28, fontWeight: '900', letterSpacing: 0 },
  script: { fontFamily: 'Story', fontSize: 27, lineHeight: 30, marginTop: 1, letterSpacing: 0 },
  totalBubble: { width: 68, height: 68, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  totalValue: { fontFamily: 'Rounded', fontSize: 19, fontWeight: '900' },
  totalLabel: { fontFamily: 'Rounded', fontSize: 10, fontWeight: '900' },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 14 },
  monthBtn: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { alignItems: 'center' },
  yearText: { fontFamily: 'Rounded', fontSize: 11, fontWeight: '900' },
  monthText: { fontFamily: 'Rounded', fontSize: 22, fontWeight: '900', marginTop: 1 },
  statsRow: { flexDirection: 'row', gap: 9, marginBottom: 16 },
  statCard: { flex: 1, minHeight: 92, borderRadius: 22, borderWidth: 1, padding: 11, alignItems: 'center', justifyContent: 'center', gap: 4 },
  statVal: { maxWidth: '100%', fontFamily: 'Rounded', fontSize: 16, fontWeight: '900' },
  statLbl: { fontFamily: 'Rounded', fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  calendarCard: { borderRadius: 26, borderWidth: 1, padding: 13, marginBottom: 22 },
  dayHeaders: { flexDirection: 'row', gap: CELL_GAP, marginBottom: 8 },
  dayHeader: { width: CELL_SIZE, textAlign: 'center', fontFamily: 'Rounded', fontSize: 10, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: CELL_GAP },
  cell: { width: CELL_SIZE, height: CELL_SIZE * 1.08 },
  dayCell: { width: CELL_SIZE, height: CELL_SIZE * 1.08, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dayNum: { fontFamily: 'Rounded', fontSize: 11, fontWeight: '900' },
  dayMins: { fontFamily: 'Rounded', fontSize: 8, color: 'rgba(255,255,255,0.86)', fontWeight: '900', marginTop: 1 },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14 },
  legendDot: { width: 14, height: 14, borderRadius: 5, borderWidth: 1 },
  legendLabel: { fontFamily: 'Rounded', fontSize: 11, fontWeight: '900' },
  sectionTitle: { fontFamily: 'Rounded', fontSize: 18, fontWeight: '900', marginBottom: 10 },
  sessionsSection: { gap: 10 },
  sessionRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 1, padding: 13, gap: 12 },
  sessionDot: { width: 11, height: 11, borderRadius: 6 },
  sessionInfo: { flex: 1 },
  sessionTitle: { fontFamily: 'Rounded', fontSize: 14, fontWeight: '900' },
  sessionDate: { fontFamily: 'Rounded', fontSize: 11, fontWeight: '800', marginTop: 2 },
  sessionDur: { fontFamily: 'Rounded', fontSize: 14, fontWeight: '900' },
  emptyCard: { minHeight: 76, borderRadius: 22, borderWidth: 1, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  emptyText: { flex: 1, fontFamily: 'Rounded', fontSize: 14, fontWeight: '900' },
});
