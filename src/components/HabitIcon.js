import React from 'react';
import { Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HABIT_ICONS, DEFAULT_HABIT_ICON } from '../constants/habitIcons';

// Habits created before the icon picker store an emoji string in this field.
// Render those as text so old habits keep working until edited.
export default function HabitIcon({ name, size = 20, color = '#000' }) {
  if (HABIT_ICONS.includes(name)) {
    return <Ionicons name={name} size={size} color={color} />;
  }
  if (!name) {
    return <Ionicons name={DEFAULT_HABIT_ICON} size={size} color={color} />;
  }
  return <Text style={{ fontSize: size }}>{name}</Text>;
}
