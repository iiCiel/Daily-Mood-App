import React from 'react';
import { StyleSheet, View } from 'react-native';

export default function StorybookHeroFade() {
  return (
    <View pointerEvents="none" style={styles.fade}>
      <View style={[styles.band, styles.bandOne]} />
      <View style={[styles.band, styles.bandTwo]} />
      <View style={[styles.band, styles.bandThree]} />
      <View style={[styles.band, styles.bandFour]} />
      <View style={[styles.band, styles.bandFive]} />
    </View>
  );
}

const styles = StyleSheet.create({
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 150,
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#FCF8F2',
  },
  bandOne: {
    bottom: 96,
    height: 28,
    opacity: 0.08,
  },
  bandTwo: {
    bottom: 68,
    height: 34,
    opacity: 0.2,
  },
  bandThree: {
    bottom: 42,
    height: 36,
    opacity: 0.4,
  },
  bandFour: {
    bottom: 18,
    height: 34,
    opacity: 0.66,
  },
  bandFive: {
    bottom: 0,
    height: 24,
    opacity: 1,
  },
});
