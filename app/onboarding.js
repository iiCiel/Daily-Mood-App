import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
} from 'react-native';
import { router, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import MoodFace from '../src/components/MoodFace';
import { COLORS, MOODS } from '../src/constants/theme';
import { useTheme } from '../src/context/ThemeContext';

const { width: SCREEN_W } = Dimensions.get('window');

const SLIDES = [
  {
    title: 'your daily mood,\ncaptured.',
    body: 'a simple place to track how you feel each day. no pressure, just a moment for you.',
    visual: 'faces',
  },
  {
    title: 'look back,\nsee patterns.',
    body: 'your calendar fills up with color as you log each day. watch your mood story unfold.',
    visual: 'calendar',
  },
  {
    title: 'takes 10 seconds.\nfeels good.',
    body: 'tap a mood, write a note if you feel like it. that\'s it. you\'re done.',
    visual: 'streak',
  },
];

export default function OnboardingScreen() {
  const C = useTheme();
  const [page, setPage] = useState(0);
  const slide = SLIDES[page];
  const isLast = page === SLIDES.length - 1;

  async function handleNext() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isLast) {
      await AsyncStorage.setItem('onboarding_done', 'true');
      router.replace('/');
    } else {
      setPage(page + 1);
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: C.background }]}>
        {/* Visual */}
        <View style={styles.visual}>
          {slide.visual === 'faces' && (
            <View style={styles.facesGrid}>
              {[
                [5, 4, 3],
                [2, 1, 4],
                [3, 5, 2],
              ].map((row, r) => (
                <View key={r} style={styles.faceRow}>
                  {row.map((v, i) => (
                    <MoodFace
                      key={i}
                      color={MOODS.find((m) => m.value === v).color}
                      moodValue={v}
                      size={64}
                    />
                  ))}
                </View>
              ))}
            </View>
          )}
          {slide.visual === 'calendar' && (
            <View style={styles.calendarPreview}>
              {[5,3,4,2,5,1,4,3,5,4,2,3,1,5,4].map((v, i) => (
                <MoodFace
                  key={i}
                  color={MOODS.find((m) => m.value === v).color}
                  moodValue={v}
                  size={44}
                />
              ))}
            </View>
          )}
          {slide.visual === 'streak' && (
            <View style={styles.streakVisual}>
              <Text style={[styles.streakNum, { color: C.text }]}>7</Text>
              <Text style={[styles.streakLabel, { color: C.textSecondary }]}>day streak 🔥</Text>
              <View style={styles.streakDots}>
                {[5,4,3,5,4,5,5].map((v, i) => (
                  <MoodFace
                    key={i}
                    color={MOODS.find((m) => m.value === v).color}
                    moodValue={v}
                    size={36}
                  />
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Text */}
        <View style={styles.textBlock}>
          <Text style={[styles.title, { color: C.text }]}>{slide.title}</Text>
          <Text style={[styles.body, { color: C.textSecondary }]}>{slide.body}</Text>
        </View>

        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: C.border }, i === page && [styles.dotActive, { backgroundColor: C.primary }]]} />
          ))}
        </View>

        {/* Button */}
        <TouchableOpacity style={[styles.btn, { backgroundColor: C.accent }]} onPress={handleNext} activeOpacity={0.8}>
          <Text style={[styles.btnText, { color: C.white }]}>{isLast ? 'get started' : 'next'}</Text>
        </TouchableOpacity>

        {/* Skip */}
        {!isLast && (
          <TouchableOpacity
            style={styles.skip}
            onPress={async () => {
              await AsyncStorage.setItem('onboarding_done', 'true');
              router.replace('/');
            }}
          >
            <Text style={[styles.skipText, { color: C.textSecondary }]}>skip</Text>
          </TouchableOpacity>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 50,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  visual: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  facesGrid: {
    gap: 12,
    alignItems: 'center',
  },
  faceRow: {
    flexDirection: 'row',
    gap: 12,
  },
  calendarPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    maxWidth: SCREEN_W - 80,
  },
  streakVisual: {
    alignItems: 'center',
    gap: 8,
  },
  streakNum: {
    fontSize: 80,
    fontWeight: '800',
    letterSpacing: -4,
    lineHeight: 88,
  },
  streakLabel: {
    fontSize: 18,
    letterSpacing: 0.3,
  },
  streakDots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  textBlock: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  body: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    letterSpacing: 0.2,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 24,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 18,
  },
  btn: {
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignItems: 'center',
    width: '100%',
  },
  btnText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  skip: {
    marginTop: 16,
    padding: 8,
  },
  skipText: {
    fontSize: 13,
    letterSpacing: 0.3,
  },
});
