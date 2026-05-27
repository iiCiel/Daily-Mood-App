import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function MindfulHeader({
  C,
  title = '',
  eyebrow,
  rightIcon,
  rightLabel = '',
  onRightPress,
}) {
  return (
    <View style={styles.row}>
      <View style={styles.titleWrap}>
        {!!eyebrow && <Text style={[styles.eyebrow, { color: C.textSecondary }]}>{eyebrow}</Text>}
        <Text style={[styles.title, { color: C.text }]}>{title}</Text>
      </View>
      {onRightPress ? (
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: C.card, borderColor: C.border }]}
          onPress={onRightPress}
          activeOpacity={0.7}
        >
          {rightIcon ? (
            <Ionicons name={rightIcon} size={18} color={C.primary} />
          ) : (
            <Text style={[styles.iconText, { color: C.primary }]}>{rightLabel || 'more'}</Text>
          )}
        </TouchableOpacity>
      ) : (
        <View style={{ width: 40 }} />
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
  titleWrap: {
    flex: 1,
    paddingRight: 12,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 12,
    fontWeight: '900',
  },
});
