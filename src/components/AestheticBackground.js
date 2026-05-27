import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, useColorScheme, View } from 'react-native';

const LIGHT = {
  canvas: '#F6F7FB',
  line: 'rgba(37, 99, 235, 0.10)',
  bandA: 'rgba(37, 99, 235, 0.08)',
  bandB: 'rgba(13, 148, 136, 0.08)',
  bandC: 'rgba(249, 115, 22, 0.08)',
};

const DARK = {
  canvas: '#0B1020',
  line: 'rgba(96, 165, 250, 0.12)',
  bandA: 'rgba(96, 165, 250, 0.11)',
  bandB: 'rgba(45, 212, 191, 0.09)',
  bandC: 'rgba(251, 146, 60, 0.09)',
};

function FloatingBand({ style, delay = 0 }) {
  const y = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0.72)).current;

  useEffect(() => {
    const drift = Animated.loop(
      Animated.sequence([
        Animated.timing(y, { toValue: 10, duration: 7200, delay, useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: 7200, useNativeDriver: true }),
      ])
    );
    const fade = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 7200, delay, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.72, duration: 7200, useNativeDriver: true }),
      ])
    );
    drift.start();
    fade.start();
    return () => {
      drift.stop();
      fade.stop();
    };
  }, [delay, opacity, y]);

  return <Animated.View pointerEvents="none" style={[style, { opacity, transform: [{ translateY: y }, { rotate: '-10deg' }] }]} />;
}

export default function AestheticBackground({ dark }) {
  const scheme = useColorScheme();
  const isDark = dark ?? scheme === 'dark';
  const C = isDark ? DARK : LIGHT;

  return (
    <View style={[styles.fill, { backgroundColor: C.canvas }]} pointerEvents="none">
      <View style={styles.grid}>
        {Array.from({ length: 9 }).map((_, i) => (
          <View key={`h-${i}`} style={[styles.hLine, { top: `${i * 12.5}%`, backgroundColor: C.line }]} />
        ))}
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={`v-${i}`} style={[styles.vLine, { left: `${i * 20}%`, backgroundColor: C.line }]} />
        ))}
      </View>
      <FloatingBand delay={0} style={[styles.band, styles.bandOne, { backgroundColor: C.bandA }]} />
      <FloatingBand delay={900} style={[styles.band, styles.bandTwo, { backgroundColor: C.bandB }]} />
      <FloatingBand delay={1800} style={[styles.band, styles.bandThree, { backgroundColor: C.bandC }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject, zIndex: 0, overflow: 'hidden' },
  grid: { ...StyleSheet.absoluteFillObject, opacity: 0.7 },
  hLine: { position: 'absolute', left: 0, right: 0, height: 1 },
  vLine: { position: 'absolute', top: 0, bottom: 0, width: 1 },
  band: {
    position: 'absolute',
    height: 110,
    borderRadius: 18,
  },
  bandOne: { width: 520, top: 72, right: -220 },
  bandTwo: { width: 460, top: 360, left: -230 },
  bandThree: { width: 420, bottom: 80, right: -210 },
});
