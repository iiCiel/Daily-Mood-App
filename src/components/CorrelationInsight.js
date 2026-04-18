import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { getMoodFocusCorrelation } from '../db/database';
import { MOODS } from '../constants/theme';
import MoodFace from './MoodFace';

function moodLabel(avg) {
  const rounded = Math.round(avg);
  return MOODS.find((m) => m.value === rounded);
}

export default function CorrelationInsight() {
  const C = useTheme();
  const [data, setData] = useState(null);

  useEffect(() => {
    getMoodFocusCorrelation().then(setData);
  }, []);

  if (!data) return null;

  const highMood = moodLabel(data.highFocusAvg);
  const lowMood = moodLabel(data.lowFocusAvg);
  if (!highMood || !lowMood) return null;

  const diff = data.highFocusAvg - data.lowFocusAvg;
  const positive = diff > 0.3;
  const neutral = Math.abs(diff) <= 0.3;

  return (
    <View style={[styles.card, { backgroundColor: C.card }]}>
      <Text style={[styles.title, { color: C.textSecondary }]}>mood × focus</Text>
      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={[styles.focusLabel, { color: C.textSecondary }]}>60m+ focus</Text>
          <MoodFace color={highMood.color} moodValue={highMood.value} size={36} />
          <Text style={[styles.moodName, { color: C.text }]}>{highMood.label}</Text>
          <Text style={[styles.count, { color: C.textSecondary }]}>{data.highFocusDays} days</Text>
        </View>
        <View style={styles.divider}>
          <Text style={[styles.vsText, { color: positive ? C.success : neutral ? C.textSecondary : C.danger }]}>
            {positive ? '↑ better' : neutral ? '≈ same' : '↓ lower'}
          </Text>
        </View>
        <View style={styles.col}>
          <Text style={[styles.focusLabel, { color: C.textSecondary }]}>low focus</Text>
          <MoodFace color={lowMood.color} moodValue={lowMood.value} size={36} />
          <Text style={[styles.moodName, { color: C.text }]}>{lowMood.label}</Text>
          <Text style={[styles.count, { color: C.textSecondary }]}>{data.lowFocusDays} days</Text>
        </View>
      </View>
      <Text style={[styles.caption, { color: C.textSecondary }]}>
        {positive
          ? `on high-focus days your mood tends to be ${highMood.label.toLowerCase()}`
          : neutral
          ? 'your mood stays consistent regardless of focus time'
          : `your mood tends to be lower on high-focus days`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    elevation: 2,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  title: { fontSize: 12, letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  col: { alignItems: 'center', gap: 5 },
  focusLabel: { fontSize: 11, letterSpacing: 0.2 },
  moodName: { fontSize: 13, fontWeight: '600' },
  count: { fontSize: 11 },
  divider: { alignItems: 'center' },
  vsText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  caption: { fontSize: 12, letterSpacing: 0.2, lineHeight: 18, fontStyle: 'italic' },
});
