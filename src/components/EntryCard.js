import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { MOODS, COLORS } from '../constants/theme';

export default function EntryCard({ entry, onPress }) {
  const mood = MOODS.find((m) => m.value === entry.mood) || MOODS[2];
  const date = new Date(entry.date + 'T00:00:00');
  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
  const dayNum = date.getDate();
  const monthName = date.toLocaleDateString('en-US', { month: 'short' });

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.dateBox, { backgroundColor: mood.color + '15' }]}>
        <Text style={[styles.dayName, { color: mood.color }]}>{dayName}</Text>
        <Text style={[styles.dayNum, { color: mood.color }]}>{dayNum}</Text>
        <Text style={[styles.monthName, { color: mood.color }]}>{monthName}</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.emoji}>{mood.emoji}</Text>
          <Text style={[styles.moodLabel, { color: mood.color }]}>{mood.label}</Text>
        </View>
        {entry.note ? (
          <Text style={styles.note} numberOfLines={2}>
            {entry.note}
          </Text>
        ) : null}
        {entry.photos && entry.photos.length > 0 && (
          <View style={styles.photoRow}>
            {entry.photos.slice(0, 3).map((photo, i) => (
              <Image
                key={photo.id || i}
                source={{ uri: photo.uri }}
                style={styles.thumbnail}
              />
            ))}
            {entry.photos.length > 3 && (
              <View style={styles.morePhotos}>
                <Text style={styles.moreText}>+{entry.photos.length - 3}</Text>
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
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dateBox: {
    width: 56,
    height: 68,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  dayName: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  dayNum: {
    fontSize: 22,
    fontWeight: '700',
  },
  monthName: {
    fontSize: 11,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  emoji: {
    fontSize: 18,
    marginRight: 6,
  },
  moodLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  note: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 6,
  },
  photoRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  thumbnail: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  morePhotos: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
});
