import React from 'react';
import { Image } from 'react-native';

const moodArt = {
  5: require('../../assets/illustrations/moods/mood-great.png'),
  4: require('../../assets/illustrations/moods/mood-good.png'),
  3: require('../../assets/illustrations/moods/mood-okay.png'),
  2: require('../../assets/illustrations/moods/mood-low.png'),
  1: require('../../assets/illustrations/moods/mood-bad.png'),
};

export default function MoodFace({ color, moodValue, size = 48 }) {
  return (
    <Image
      source={moodArt[moodValue] || moodArt[3]}
      accessibilityLabel={`Mood ${moodValue}`}
      resizeMode="contain"
      style={{
        width: size,
        height: size,
      }}
    />
  );
}
