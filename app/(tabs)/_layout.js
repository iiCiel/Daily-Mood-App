import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../src/context/ThemeContext';

const paperArt = require('../../assets/illustrations/storybook-paper-rich.png');

function TabBar({ state, navigation }) {
  const C = useTheme();
  const tabs = [
    { name: 'life', icon: 'grid-outline', activeIcon: 'grid', label: 'Today' },
    // { name: 'tasks', icon: 'checkbox-outline', activeIcon: 'checkbox', label: 'Tasks' },
    { name: 'focus', icon: 'timer-outline', activeIcon: 'timer', label: 'Focus' },
    { name: 'habits', icon: 'repeat-outline', activeIcon: 'repeat', label: 'Habits' },
    { name: 'mood', icon: 'book-outline', activeIcon: 'book', label: 'Journal' },
  ];

  return (
    <View style={styles.wrap}>
      <ImageBackground source={paperArt} style={styles.bar} imageStyle={styles.barImage}>
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
                { backgroundColor: isFocused ? C.primary : 'rgba(255,255,255,0.54)' },
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
      </ImageBackground>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="life" />
      <Tabs.Screen name="tasks" options={{ href: null }} />
      <Tabs.Screen name="focus" />
      <Tabs.Screen name="habits" />
      <Tabs.Screen name="mood" />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 2,
    paddingHorizontal: 30,
    backgroundColor: 'transparent',
  },
  bar: {
    flexDirection: 'row',
    height: 68,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(174,132,113,0.2)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    overflow: 'hidden',
    shadowColor: '#8A6A86',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 7,
  },
  barImage: {
    resizeMode: 'cover',
    borderRadius: 26,
    opacity: 0.92,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    minHeight: 56,
    justifyContent: 'center',
  },
  iconWrap: {
    width: 32,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 9,
    fontWeight: '800',
    fontFamily: 'Rounded',
  },
});
