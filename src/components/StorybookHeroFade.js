import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function StorybookHeroFade() {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={['rgba(252,248,242,0)', 'rgba(252,248,242,0.72)', '#FCF8F2']}
      locations={[0, 0.66, 1]}
      style={styles.fade}
    />
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
});
