import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Stack } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import MoodFace from '../src/components/MoodFace';

export default function LockScreen({ onUnlock }) {
  const C = useTheme();
  const [authenticating, setAuthenticating] = useState(false);

  useEffect(() => {
    authenticate();
  }, []);

  async function authenticate() {
    setAuthenticating(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'unlock mood',
        fallbackLabel: 'use passcode',
        disableDeviceFallback: false,
      });
      if (result.success) {
        onUnlock();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAuthenticating(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <View style={[styles.container, { backgroundColor: C.background }]}>
        <MoodFace color="#C5A8E8" moodValue={3} size={72} />
        <Text style={[styles.title, { color: C.text }]}>mood</Text>
        <Text style={[styles.subtitle, { color: C.textSecondary }]}>unlock to continue</Text>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: C.card, borderColor: C.border }]}
          onPress={authenticate}
          disabled={authenticating}
          activeOpacity={0.7}
        >
          <Text style={[styles.btnText, { color: C.text }]}>
            {authenticating ? 'authenticating...' : '🔒  unlock'}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    letterSpacing: 0.3,
    marginBottom: 16,
  },
  btn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
