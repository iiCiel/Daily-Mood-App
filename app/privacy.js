import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { router, Stack } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';

export default function PrivacyScreen() {
  const C = useTheme();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={[s.container, { backgroundColor: C.background }]} contentContainerStyle={s.content}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Text style={[s.backText, { color: C.text }]}>←</Text>
        </TouchableOpacity>
        <Text style={[s.title, { color: C.text }]}>privacy policy</Text>
        <Text style={[s.updated, { color: C.textSecondary }]}>last updated: April 2026</Text>

        {[
          ['your data stays on your device', 'Daily Mood stores all your journal entries, habits, and focus sessions locally on your device using SQLite. We do not collect, transmit, or sell any personal data.'],
          ['optional cloud sync', 'If you choose to enable cloud sync in settings, your mood entries may be uploaded to a Supabase instance you configure yourself. Other app modules stay local unless you export or share a backup.'],
          ['notifications', 'If you enable reminders, the app schedules local notifications on your device. No notification data is sent to any server.'],
          ['photos', 'Photos attached to journal entries are copied into local app storage. Backup files include photo metadata, but not embedded photo files.'],
          ['biometrics', 'If you enable app lock, biometric authentication (fingerprint or face unlock) is handled entirely by your device\'s operating system. The app never accesses or stores biometric data. App lock does not encrypt the local database.'],
          ['analytics', 'This app contains no third-party analytics, tracking, or advertising SDKs.'],
          ['contact', 'Questions? Reach out via the app listing on the Google Play Store.'],
        ].map(([title, body]) => (
          <View key={title} style={s.section}>
            <Text style={[s.sectionTitle, { color: C.text }]}>{title}</Text>
            <Text style={[s.sectionBody, { color: C.textSecondary }]}>{body}</Text>
          </View>
        ))}
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 60, paddingBottom: 50 },
  back: { marginBottom: 20 },
  backText: { fontSize: 24 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 6 },
  updated: { fontSize: 12, letterSpacing: 0.3, marginBottom: 32 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2, marginBottom: 8 },
  sectionBody: { fontSize: 14, lineHeight: 22, letterSpacing: 0.1 },
});
