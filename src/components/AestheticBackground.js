import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, useColorScheme } from 'react-native';

const BLOBS = [
  { color: '#B85B3A', size: 380, top: -90,  right: -100, opacityRange: [0.34, 0.58], floatY: 22,  floatX: -14, duration: 7000 },
  { color: '#C5A8E8', size: 300, top: 150,  left: -90,   opacityRange: [0.30, 0.50], floatY: -18, floatX: 12,  duration: 9000 },
  { color: '#F9C74F', size: 240, top: 390,  right: -60,  opacityRange: [0.28, 0.48], floatY: 16,  floatX: -10, duration: 8200 },
  { color: '#F4A56A', size: 270, bottom: 180, left: -70, opacityRange: [0.30, 0.52], floatY: -20, floatX: 16,  duration: 10000 },
  { color: '#89B4D4', size: 320, bottom: -70, right: -80, opacityRange: [0.28, 0.48], floatY: 12, floatX: -12, duration: 7600 },
];

const DARK_BLOBS = [
  { color: '#D9713E', size: 380, top: -100, right: -100, opacityRange: [0.46, 0.72], floatY: 22,  floatX: -14, duration: 7000 },
  { color: '#9B7EC8', size: 300, top: 145,  left: -95,   opacityRange: [0.34, 0.58], floatY: -18, floatX: 12,  duration: 9000 },
  { color: '#F9C74F', size: 230, top: 365,  right: -60,  opacityRange: [0.30, 0.50], floatY: 16,  floatX: -10, duration: 8200 },
  { color: '#C4723A', size: 270, bottom: 145, left: -70, opacityRange: [0.34, 0.58], floatY: -20, floatX: 16,  duration: 10000 },
  { color: '#5A7EA8', size: 320, bottom: -70, right: -80, opacityRange: [0.32, 0.52], floatY: 12, floatX: -12, duration: 7600 },
];

function AnimatedBlob({ blob, index }) {
  const opacity = useRef(new Animated.Value(blob.opacityRange[0])).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = index * 1100;

    const opacityAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: blob.opacityRange[1], duration: blob.duration, delay, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: blob.opacityRange[0], duration: blob.duration, useNativeDriver: true }),
      ])
    );

    const floatYAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, { toValue: blob.floatY, duration: blob.duration * 1.1, delay, useNativeDriver: true, easing: t => Math.sin(t * Math.PI) }),
        Animated.timing(translateY, { toValue: 0, duration: blob.duration * 1.1, useNativeDriver: true }),
      ])
    );

    const floatXAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, { toValue: blob.floatX, duration: blob.duration * 0.9, delay, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 0, duration: blob.duration * 0.9, useNativeDriver: true }),
      ])
    );

    opacityAnim.start();
    floatYAnim.start();
    floatXAnim.start();

    return () => {
      opacityAnim.stop();
      floatYAnim.stop();
      floatXAnim.stop();
    };
  }, []);

  const pos = {};
  if (blob.top !== undefined) pos.top = blob.top;
  if (blob.bottom !== undefined) pos.bottom = blob.bottom;
  if (blob.left !== undefined) pos.left = blob.left;
  if (blob.right !== undefined) pos.right = blob.right;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.blob,
        {
          width: blob.size,
          height: blob.size,
          borderRadius: blob.size / 2,
          backgroundColor: blob.color,
          opacity,
          transform: [{ translateY }, { translateX }],
          ...pos,
        },
      ]}
    />
  );
}

export default function AestheticBackground({ dark }) {
  const scheme = useColorScheme();
  const isDark = dark ?? scheme === 'dark';
  const blobs = isDark ? DARK_BLOBS : BLOBS;

  return (
    <Animated.View style={styles.fill} pointerEvents="none">
      {blobs.map((blob, i) => (
        <AnimatedBlob key={i} blob={blob} index={i} />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
  blob: { position: 'absolute' },
});
