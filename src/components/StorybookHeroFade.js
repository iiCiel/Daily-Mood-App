import React from 'react';
import { StyleSheet, View } from 'react-native';

const SLICE_COUNT = 48;
const SLICE_STEP = 3;
const SLICE_HEIGHT = 9;
const PAPER_TINT = '#FAF5ED';

export default function StorybookHeroFade() {
  return (
    <View pointerEvents="none" style={styles.fade}>
      {Array.from({ length: SLICE_COUNT }, (_, index) => {
        const progress = (index + 1) / SLICE_COUNT;
        const eased = Math.pow(progress, 2.35);
        return (
          <View
            key={index}
            style={[
              styles.slice,
              {
                bottom: (SLICE_COUNT - index - 1) * SLICE_STEP,
                opacity: Math.min(0.92, eased * 0.96),
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SLICE_COUNT * SLICE_STEP + SLICE_HEIGHT,
    overflow: 'hidden',
  },
  slice: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: SLICE_HEIGHT,
    backgroundColor: PAPER_TINT,
  },
});
