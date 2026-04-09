import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { MOODS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import MoodFace from './MoodFace';

export default function MoodPicker({ selected, onSelect }) {
  const COLORS = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: COLORS.textSecondary }]}>how are you feeling?</Text>
      <View style={styles.row}>
        {MOODS.map((mood) => (
          <TouchableOpacity
            key={mood.value}
            style={styles.item}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(mood.value);
            }}
            activeOpacity={0.75}
          >
            <View style={[styles.ring, selected === mood.value && { borderColor: COLORS.text }]}>
              <MoodFace color={mood.color} moodValue={mood.value} size={50} />
            </View>
            <Text style={[styles.moodLabel, { color: selected === mood.value ? COLORS.text : COLORS.textSecondary }, selected === mood.value && styles.moodLabelActive]}>
              {mood.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 28,
  },
  label: {
    fontSize: 13,
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  item: {
    alignItems: 'center',
    gap: 7,
  },
  ring: {
    padding: 3,
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: 'transparent',
  },
  moodLabel: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
  moodLabelActive: {
    fontWeight: '600',
  },
});
