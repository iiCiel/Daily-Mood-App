import React, { useState } from 'react';
import {
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../src/context/ThemeContext';

const paperArt = require('../assets/illustrations/storybook-paper-rich.png');
const catsArt = require('../assets/illustrations/storybook-cats.png');
const focusArt = require('../assets/illustrations/storybook-focus.png');
const journalArt = require('../assets/illustrations/storybook-calm-cat.png');

const SLIDES = [
  {
    title: 'Daily Mood',
    script: 'a softer way to check in',
    body: 'Pick a mood, write a little note, and let the day become part of your story.',
    image: catsArt,
    icon: 'happy-outline',
  },
  {
    title: 'Gentle Focus',
    script: 'small sessions count',
    body: 'Start a focus session, name what matters, and see your minutes add up.',
    image: focusArt,
    icon: 'timer-outline',
  },
  {
    title: 'Your Journal',
    script: 'look back without pressure',
    body: 'Your calendar fills with reflections, patterns, habits, and tiny wins.',
    image: journalArt,
    icon: 'book-outline',
  },
];

export default function OnboardingScreen() {
  const C = useTheme();
  const [page, setPage] = useState(0);
  const slide = SLIDES[page];
  const isLast = page === SLIDES.length - 1;

  async function finish() {
    await AsyncStorage.setItem('onboarding_done', 'true');
    router.replace('/(tabs)/life');
  }

  async function handleNext() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isLast) {
      await finish();
    } else {
      setPage((p) => p + 1);
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ImageBackground source={paperArt} style={[styles.container, { backgroundColor: C.background }]} imageStyle={styles.backgroundImage}>
        <View style={styles.topRow}>
          {!isLast ? (
            <TouchableOpacity style={[styles.skipBtn, { backgroundColor: C.card, borderColor: C.border }]} onPress={finish}>
              <Text style={[styles.skipText, { color: C.textSecondary }]}>Skip</Text>
            </TouchableOpacity>
          ) : <View />}
        </View>

        <ImageBackground source={slide.image} style={styles.poster} imageStyle={styles.posterImage}>
          <View style={[styles.iconBubble, { backgroundColor: C.white }]}>
            <Ionicons name={slide.icon} size={22} color={C.primary} />
          </View>
        </ImageBackground>

        <View style={[styles.copyCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.title, { color: C.text }]}>{slide.title}</Text>
          <Text style={[styles.script, { color: C.text }]}>{slide.script}</Text>
          <Text style={[styles.body, { color: C.textSecondary }]}>{slide.body}</Text>
        </View>

        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i === page ? C.primary : C.border }, i === page && styles.dotActive]} />
          ))}
        </View>

        <TouchableOpacity style={[styles.btn, { backgroundColor: C.primary }]} onPress={handleNext} activeOpacity={0.82}>
          <Text style={[styles.btnText, { color: C.white }]}>{isLast ? 'Start' : 'Next'}</Text>
          <Ionicons name={isLast ? 'sparkles-outline' : 'chevron-forward'} size={18} color={C.white} />
        </TouchableOpacity>
      </ImageBackground>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 22, paddingTop: 56, paddingBottom: 34 },
  backgroundImage: { resizeMode: 'cover' },
  topRow: { minHeight: 42, alignItems: 'flex-end', justifyContent: 'center' },
  skipBtn: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8 },
  skipText: { fontFamily: 'Rounded', fontSize: 12, fontWeight: '900' },
  poster: {
    flex: 1,
    minHeight: 320,
    borderRadius: 34,
    overflow: 'hidden',
    marginTop: 12,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    padding: 16,
    shadowColor: '#7D88B8',
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  posterImage: { resizeMode: 'cover', borderRadius: 34 },
  iconBubble: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  copyCard: {
    borderRadius: 30,
    borderWidth: 1,
    padding: 20,
    marginTop: 18,
    shadowColor: '#8A6A86',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  title: { fontFamily: 'Rounded', fontSize: 30, fontWeight: '900', textAlign: 'center' },
  script: { fontFamily: 'Story', fontSize: 31, lineHeight: 34, textAlign: 'center', marginTop: 3 },
  body: { fontFamily: 'Rounded', fontSize: 14, fontWeight: '800', lineHeight: 21, textAlign: 'center', marginTop: 10 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginVertical: 20 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { width: 24 },
  btn: {
    minHeight: 54,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: '#A5664E',
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  btnText: { fontFamily: 'Rounded', fontSize: 16, fontWeight: '900' },
});
