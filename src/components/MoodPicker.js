import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MOODS, COLORS } from '../constants/theme';

export default function MoodPicker({ selected, onSelect }) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>How are you feeling?</Text>
      <View style={styles.moods}>
        {MOODS.map((mood) => (
          <TouchableOpacity
            key={mood.value}
            style={[
              styles.moodButton,
              selected === mood.value && {
                backgroundColor: mood.color + '20',
                borderColor: mood.color,
              },
            ]}
            onPress={() => onSelect(mood.value)}
            activeOpacity={0.7}
          >
            <Text style={styles.emoji}>{mood.emoji}</Text>
            <Text
              style={[
                styles.moodLabel,
                selected === mood.value && { color: mood.color, fontWeight: '600' },
              ]}
            >
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
    marginBottom: 20,
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  moods: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  moodButton: {
    alignItems: 'center',
    padding: 10,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    flex: 1,
    marginHorizontal: 3,
  },
  emoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  moodLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});
