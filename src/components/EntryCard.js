import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { MOODS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import MoodFace from './MoodFace';

export default function EntryCard({ entry, onPress }) {
  const COLORS = useTheme();
  const mood = MOODS.find((m) => m.value === entry.mood) || MOODS[2];
  const date = new Date(entry.date + 'T00:00:00');
  const day = date.getDate();
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <MoodFace color={mood.color} moodValue={mood.value} size={44} />
      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={[styles.dayText, { color: COLORS.text }]}>{weekday} {day}</Text>
          <Text style={[styles.moodLabel, { color: mood.color }]}>{mood.label}</Text>
        </View>
        {entry.note ? (
          <Text style={[styles.note, { color: COLORS.textSecondary }]} numberOfLines={2}>
            {entry.note}
          </Text>
        ) : null}
        {entry.photos && entry.photos.length > 0 && (
          <View style={styles.photoRow}>
            {entry.photos.slice(0, 3).map((photo, i) => (
              <Image key={photo.id || i} source={{ uri: photo.uri }} style={styles.thumbnail} />
            ))}
            {entry.photos.length > 3 && (
              <View style={[styles.morePhotos, { backgroundColor: COLORS.border }]}>
                <Text style={[styles.moreText, { color: COLORS.textSecondary }]}>
                  +{entry.photos.length - 3}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  moodLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  note: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 6,
  },
  photoRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 6,
  },
  thumbnail: {
    width: 34,
    height: 34,
    borderRadius: 8,
  },
  morePhotos: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
