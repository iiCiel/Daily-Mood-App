import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../src/context/ThemeContext';
import { COLORS } from '../../src/constants/theme';

function TabBar({ state, descriptors, navigation }) {
  const C = useTheme();
  const tabs = [
    { name: 'mood', icon: '◉', label: 'mood' },
    { name: 'habits', icon: '◈', label: 'habits' },
    { name: 'focus', icon: '◎', label: 'focus' },
    { name: 'life', icon: '◇', label: 'life' },
  ];

  return (
    <View style={[styles.bar, { backgroundColor: C.card }]}>
      {tabs.map((tab, i) => {
        const isFocused = state.index === i;
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tab}
            onPress={() => navigation.navigate(tab.name)}
            activeOpacity={0.7}
          >
            <Text style={[styles.icon, { color: isFocused ? C.primary : C.textSecondary }]}>
              {tab.icon}
            </Text>
            <Text style={[styles.label, { color: isFocused ? C.primary : C.textSecondary }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="mood" />
      <Tabs.Screen name="habits" />
      <Tabs.Screen name="focus" />
      <Tabs.Screen name="life" />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    elevation: 8,
    paddingBottom: 24,
    paddingTop: 12,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  icon: {
    fontSize: 20,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.5,
  },
});
