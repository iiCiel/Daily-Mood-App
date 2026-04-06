import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { COLORS } from '../src/constants/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.background },
          headerTintColor: COLORS.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: COLORS.background },
          headerTitleStyle: { fontWeight: '700' },
        }}
      />
    </>
  );
}
