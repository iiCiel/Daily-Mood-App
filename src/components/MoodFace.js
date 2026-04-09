import React from 'react';
import { View } from 'react-native';

export default function MoodFace({ color, moodValue, size = 48 }) {
  const eyeSize = Math.max(2.5, size * 0.09);
  const eyeGap = size * 0.2;
  const mouthW = size * 0.36;
  const mouthH = size * 0.14;
  const stroke = Math.max(1.5, size * 0.038);
  const ink = 'rgba(30, 20, 10, 0.42)';

  let mouth;
  if (moodValue >= 4) {
    mouth = (
      <View
        style={{
          width: mouthW,
          height: mouthH,
          borderBottomLeftRadius: mouthW / 2,
          borderBottomRightRadius: mouthW / 2,
          borderWidth: stroke,
          borderTopWidth: 0,
          borderColor: ink,
        }}
      />
    );
  } else if (moodValue === 3) {
    mouth = (
      <View
        style={{
          width: mouthW,
          height: stroke,
          backgroundColor: ink,
          borderRadius: stroke,
        }}
      />
    );
  } else {
    mouth = (
      <View
        style={{
          width: mouthW,
          height: mouthH,
          borderTopLeftRadius: mouthW / 2,
          borderTopRightRadius: mouthW / 2,
          borderWidth: stroke,
          borderBottomWidth: 0,
          borderColor: ink,
          marginTop: mouthH * 0.5,
        }}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ flexDirection: 'row', gap: eyeGap, marginBottom: size * 0.06 }}>
        <View style={{ width: eyeSize, height: eyeSize, borderRadius: eyeSize, backgroundColor: ink }} />
        <View style={{ width: eyeSize, height: eyeSize, borderRadius: eyeSize, backgroundColor: ink }} />
      </View>
      {mouth}
    </View>
  );
}
