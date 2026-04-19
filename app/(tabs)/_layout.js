import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../src/context/ThemeContext';

function TabBar({ state, navigation }) {
  const C = useTheme();
  const tabs = [
    { name: 'life', icon: '◆', label: 'Dashboard' },
    { name: 'habits', icon: '✦', label: 'Habits' },
    { name: 'focus', icon: '◎', label: 'Pomodoro' },
    { name: 'mood', icon: '◉', label: 'Mood' },
  ];

  return (
    <View style={[styles.wrap, { backgroundColor: 'transparent' }]}>
      <View style={[styles.bar, { backgroundColor: C.card, borderColor: C.border }]}>
        {tabs.map((tab) => {
          const routeIndex = state.routes.findIndex((route) => route.name === tab.name);
          const isFocused = state.index === routeIndex;
          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tab}
              onPress={() => navigation.navigate(tab.name)}
              activeOpacity={0.75}
            >
              <View style={[
                styles.iconWrap,
                { backgroundColor: isFocused ? C.primaryLight : 'transparent' },
              ]}>
                <Text style={[styles.icon, { color: isFocused ? C.primary : C.textSecondary }]}>
                  {tab.icon}
                </Text>
              </View>
              <Text style={[styles.label, { color: isFocused ? C.primary : C.textSecondary }]}>
                {tab.label}
              </Text>
              {isFocused && <View style={[styles.activeDot, { backgroundColor: C.primary }]} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="life" />
      <Tabs.Screen name="habits" />
      <Tabs.Screen name="focus" />
      <Tabs.Screen name="mood" />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 18,
  },
  bar: {
    flexDirection: 'row',
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 6,
    shadowColor: '#1A0A00',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  iconWrap: {
    width: 34,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 15,
    fontWeight: '800',
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
});
