import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../src/context/ThemeContext';

function TabBar({ state, navigation }) {
  const C = useTheme();
  const tabs = [
    { name: 'life', icon: 'grid-outline', activeIcon: 'grid', label: 'Today' },
    { name: 'tasks', icon: 'checkbox-outline', activeIcon: 'checkbox', label: 'Tasks' },
    { name: 'focus', icon: 'timer-outline', activeIcon: 'timer', label: 'Focus' },
    { name: 'habits', icon: 'repeat-outline', activeIcon: 'repeat', label: 'Habits' },
    { name: 'mood', icon: 'book-outline', activeIcon: 'book', label: 'Journal' },
  ];

  return (
    <View style={styles.wrap}>
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
                { backgroundColor: isFocused ? C.primary : 'transparent' },
              ]}>
                <Ionicons
                  name={isFocused ? tab.activeIcon : tab.icon}
                  size={18}
                  color={isFocused ? C.white : C.textSecondary}
                />
              </View>
              <Text style={[styles.label, { color: isFocused ? C.text : C.textSecondary }]}>
                {tab.label}
              </Text>
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
      <Tabs.Screen name="tasks" />
      <Tabs.Screen name="focus" />
      <Tabs.Screen name="habits" />
      <Tabs.Screen name="mood" />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 18,
  },
  bar: {
    flexDirection: 'row',
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    shadowColor: '#111827',
    shadowOpacity: 0.08,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    minHeight: 48,
    justifyContent: 'center',
  },
  iconWrap: {
    width: 34,
    height: 30,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
  },
});
