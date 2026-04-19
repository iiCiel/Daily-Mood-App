import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function MindfulHeader({ C, title = '', rightLabel = '', onRightPress }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color: C.text }]}>{title}</Text>
      {onRightPress ? (
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: C.card, borderColor: C.border }]}
          onPress={onRightPress}
          activeOpacity={0.7}
        >
          <Text style={[styles.iconText, { color: C.primary }]}>{rightLabel || '⋯'}</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ width: 36 }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
