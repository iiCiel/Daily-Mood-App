import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { getEntry, deleteEntry } from '../src/db/database';
import { MOODS, COLORS } from '../src/constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function EntryScreen() {
  const { date } = useLocalSearchParams();
  const [entry, setEntry] = useState(null);

  useEffect(() => {
    loadEntry();
  }, [date]);

  async function loadEntry() {
    if (!date) return;
    const data = await getEntry(date);
    setEntry(data);
  }

  function handleDelete() {
    Alert.alert('Delete Entry', 'Are you sure you want to delete this entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteEntry(entry.id);
          router.back();
        },
      },
    ]);
  }

  if (!entry) {
    return (
      <>
        <Stack.Screen options={{ title: 'Entry' }} />
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </>
    );
  }

  const mood = MOODS.find((m) => m.value === entry.mood) || MOODS[2];
  const dateObj = new Date(entry.date + 'T00:00:00');
  const dateDisplay = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <>
      <Stack.Screen
        options={{
          title: dateObj.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
          headerRight: () => (
            <TouchableOpacity onPress={handleDelete}>
              <Text style={{ color: COLORS.danger, fontSize: 16, fontWeight: '600' }}>
                Delete
              </Text>
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <View style={[styles.moodCard, { backgroundColor: mood.color + '12' }]}>
          <Text style={styles.moodEmoji}>{mood.emoji}</Text>
          <Text style={[styles.moodLabel, { color: mood.color }]}>{mood.label}</Text>
          <Text style={styles.dateText}>{dateDisplay}</Text>
        </View>

        {entry.note ? (
          <View style={styles.noteCard}>
            <Text style={styles.noteTitle}>What happened</Text>
            <Text style={styles.noteText}>{entry.note}</Text>
          </View>
        ) : null}

        {entry.photos && entry.photos.length > 0 && (
          <View style={styles.photosSection}>
            <Text style={styles.photosTitle}>
              Photos ({entry.photos.length})
            </Text>
            {entry.photos.map((photo, i) => (
              <Image
                key={photo.id || i}
                source={{ uri: photo.uri }}
                style={styles.fullPhoto}
                resizeMode="cover"
              />
            ))}
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  moodCard: {
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginBottom: 20,
  },
  moodEmoji: {
    fontSize: 56,
    marginBottom: 8,
  },
  moodLabel: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  noteCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 10,
  },
  noteText: {
    fontSize: 16,
    color: COLORS.text,
    lineHeight: 24,
  },
  photosSection: {
    marginBottom: 20,
  },
  photosTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  fullPhoto: {
    width: SCREEN_WIDTH - 40,
    height: SCREEN_WIDTH - 40,
    borderRadius: 16,
    marginBottom: 12,
  },
});
