import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const { width: W, height: H } = Dimensions.get('window');

// Soft decorative blobs using mood palette colors at low opacity
const BLOBS = [
  { color: '#6CC97C', size: 260, top: -60, right: -80, opacity: 0.09 },   // green — top right
  { color: '#C5A8E8', size: 200, top: 180, left: -90, opacity: 0.10 },    // purple — left mid
  { color: '#F9C74F', size: 140, top: 420, right: -40, opacity: 0.09 },   // yellow — right mid
  { color: '#F4A56A', size: 180, bottom: 200, left: -50, opacity: 0.09 }, // orange — lower left
  { color: '#89B4D4', size: 220, bottom: -40, right: -60, opacity: 0.10 },// blue — bottom right
];

export default function AestheticBackground() {
  const C = useTheme();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {BLOBS.map((blob, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            width: blob.size,
            height: blob.size,
            borderRadius: blob.size / 2,
            backgroundColor: blob.color,
            opacity: blob.opacity,
            top: blob.top,
            bottom: blob.bottom,
            left: blob.left,
            right: blob.right,
          }}
        />
      ))}
    </View>
  );
}
