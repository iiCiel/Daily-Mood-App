import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { MOODS } from '../constants/theme';
import { getLastNDaysMoods } from '../db/database';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const BAR_MAX_H = 48;

export default function MoodTrend() {
  const C = useTheme();
  const [days, setDays] = useState([]);

  useEffect(() => {
    getLastNDaysMoods(7).then(setDays);
  }, []);

  if (days.length === 0) return null;

  return (
    <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
      <Text style={[styles.label, { color: C.textSecondary }]}>this week</Text>
      <View style={styles.bars}>
        {days.map(({ date, mood }) => {
          const moodObj = mood ? MOODS.find((m) => m.value === mood) : null;
          const barH = mood ? (mood / 5) * BAR_MAX_H : 4;
          const dayOfWeek = new Date(date + 'T00:00:00').getDay();
          const isToday = date === (() => {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          })();

          return (
            <TouchableOpacity
              key={date}
              style={styles.barCol}
              onPress={() => router.push({ pathname: '/entry', params: { date } })}
              activeOpacity={0.7}
            >
              <View style={[styles.barTrack, { height: BAR_MAX_H }]}>
                <View style={[
                  styles.bar,
                  {
                    height: barH,
                    backgroundColor: moodObj ? moodObj.color : C.border,
                    opacity: mood ? 1 : 0.4,
                  }
                ]} />
              </View>
              <Text style={[
                styles.dayLabel,
                { color: isToday ? C.text : C.textSecondary },
                isToday && { fontWeight: '700' },
              ]}>
                {DAY_LABELS[dayOfWeek]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  bars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  barCol: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  barTrack: {
    justifyContent: 'flex-end',
    width: 20,
  },
  bar: {
    width: 20,
    borderRadius: 6,
    minHeight: 4,
  },
  dayLabel: {
    fontSize: 10,
    letterSpacing: 0.3,
  },
});
