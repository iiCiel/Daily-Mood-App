import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useFocusEffect, router, Stack } from 'expo-router';
import EntryCard from '../src/components/EntryCard';
import { getEntriesForMonth } from '../src/db/database';
import { COLORS, MOODS } from '../src/constants/theme';

export default function HistoryScreen() {
  const [entries, setEntries] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, [year, month])
  );

  async function loadEntries() {
    try {
      const data = await getEntriesForMonth(year, month);
      setEntries(data);
    } catch (e) {
      console.error('Failed to load entries:', e);
    }
  }

  function changeMonth(delta) {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    } else if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    setMonth(newMonth);
    setYear(newYear);
  }

  const monthName = new Date(year, month - 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  // Build calendar data
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const entryMap = {};
  for (const e of entries) {
    const day = parseInt(e.date.split('-')[2], 10);
    entryMap[day] = e;
  }

  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const todayDate = new Date();
  const isCurrentMonth =
    todayDate.getFullYear() === year && todayDate.getMonth() + 1 === month;
  const todayDay = todayDate.getDate();

  return (
    <>
      <Stack.Screen options={{ title: 'History' }} />
      <View style={styles.container}>
        {/* Month navigator */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.navBtn}>
            <Text style={styles.navText}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{monthName}</Text>
          <TouchableOpacity onPress={() => changeMonth(1)} style={styles.navBtn}>
            <Text style={styles.navText}>{'>'}</Text>
          </TouchableOpacity>
        </View>

        {/* Mini calendar */}
        <View style={styles.calendar}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <Text key={i} style={styles.dayHeader}>
              {d}
            </Text>
          ))}
          {calendarDays.map((day, i) => {
            const entry = day ? entryMap[day] : null;
            const mood = entry ? MOODS.find((m) => m.value === entry.mood) : null;
            const isToday = isCurrentMonth && day === todayDay;

            return (
              <TouchableOpacity
                key={i}
                style={[styles.dayCell, isToday && styles.todayCell]}
                disabled={!entry}
                onPress={() =>
                  entry &&
                  router.push({
                    pathname: '/entry',
                    params: { date: entry.date },
                  })
                }
              >
                {day && (
                  <>
                    <Text
                      style={[
                        styles.dayText,
                        isToday && styles.todayText,
                        !entry && styles.dayTextEmpty,
                      ]}
                    >
                      {day}
                    </Text>
                    {mood && <Text style={styles.dayMood}>{mood.emoji}</Text>}
                  </>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Entry list */}
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <EntryCard
              entry={item}
              onPress={() =>
                router.push({ pathname: '/entry', params: { date: item.date } })
              }
            />
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📝</Text>
              <Text style={styles.emptyText}>No entries this month</Text>
            </View>
          }
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  navBtn: {
    padding: 10,
  },
  navText: {
    fontSize: 20,
    color: COLORS.primary,
    fontWeight: '700',
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  calendar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  dayHeader: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  dayCell: {
    width: '14.28%',
    alignItems: 'center',
    paddingVertical: 4,
    minHeight: 44,
  },
  todayCell: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
  },
  dayText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
  },
  todayText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  dayTextEmpty: {
    color: COLORS.textSecondary,
  },
  dayMood: {
    fontSize: 14,
    marginTop: 1,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  empty: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
});
