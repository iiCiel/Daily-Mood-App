import React, { useCallback, useState } from 'react';
import { Alert, ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../src/context/ThemeContext';
import StorybookHeroFade from '../src/components/StorybookHeroFade';
import { deleteRoutine, discardWorkout, getActiveWorkout, getRoutines, getWorkoutHistory, getWorkoutStats, getWorkoutUnit, startWorkout } from '../src/db/workoutDatabase';

const workoutArt = require('../assets/illustrations/storybook-workout.png');

export default function WorkoutScreen() {
  const C = useTheme();
  const [routines, setRoutines] = useState([]);
  const [history, setHistory] = useState([]);
  const [active, setActive] = useState(null);
  const [stats, setStats] = useState({ workouts: 0, volume: 0, minutes: 0, week: 0 });
  const [unit, setUnit] = useState('kg');

  useFocusEffect(useCallback(() => { load(); }, []));

  async function load() {
    const [r, h, a, s, u] = await Promise.all([
      getRoutines(), getWorkoutHistory(12), getActiveWorkout(), getWorkoutStats(), getWorkoutUnit(),
    ]);
    setRoutines(r); setHistory(h); setActive(a); setStats(s); setUnit(u);
  }

  async function begin(routineId = null) {
    if (active) {
      if (routineId && routineId !== active.routine_id) {
        Alert.alert(
          'Workout already in progress',
          `You have an active "${active.name}" workout. Resume it, or discard it to start this routine instead.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Resume current', onPress: () => router.push({ pathname: '/workout-session', params: { id: active.id } }) },
            {
              text: 'Discard & start new', style: 'destructive', onPress: async () => {
                await discardWorkout(active.id);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                const sessionId = await startWorkout(routineId);
                router.push({ pathname: '/workout-session', params: { id: sessionId } });
              },
            },
          ]
        );
        return;
      }
      router.push({ pathname: '/workout-session', params: { id: active.id } });
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const sessionId = await startWorkout(routineId);
    router.push({ pathname: '/workout-session', params: { id: sessionId } });
  }

  function removeRoutine(item) {
    Alert.alert('Delete routine?', `${item.name} will be removed. Completed workouts stay in your history.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteRoutine(item.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          load();
        },
      },
    ]);
  }

  return (
    <View style={[s.flex, { backgroundColor: C.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        <ImageBackground source={workoutArt} style={s.hero} imageStyle={s.heroImage}>
          <StorybookHeroFade />
          <View style={s.heroTop}>
            <TouchableOpacity style={s.circle} onPress={() => router.back()}><Ionicons name="arrow-back" size={20} color={C.text} /></TouchableOpacity>
            <TouchableOpacity style={s.circle} onPress={() => router.push('/workout-routine')}><Ionicons name="add" size={23} color={C.text} /></TouchableOpacity>
          </View>
          <View style={s.heroCopy}>
            <Text style={[s.eyebrow, { color: C.primary }]}>MOVE WITH KINDNESS</Text>
            <Text style={[s.title, { color: C.text }]}>strong days</Text>
            <Text style={[s.subtitle, { color: C.inkSoft }]}>Small sets still count.</Text>
          </View>
        </ImageBackground>

        <View style={[s.sheet, { backgroundColor: C.panel }]}>
          {active && (
            <TouchableOpacity style={[s.resume, { backgroundColor: C.accent }]} onPress={() => begin()}>
              <View style={s.resumeIcon}><Ionicons name="play" size={19} color={C.accent} /></View>
              <View style={s.grow}>
                <Text style={s.resumeTitle}>Workout in progress</Text>
                <Text style={s.resumeSub}>{active.name} · started {new Date(active.started_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </TouchableOpacity>
          )}

          <View style={s.stats}>
            <Stat C={C} value={stats.week} label="this week" icon="flame-outline" />
            <Stat C={C} value={stats.workouts} label="workouts" icon="trophy-outline" />
            <Stat C={C} value={Math.round(stats.volume).toLocaleString()} label={`${unit} lifted`} icon="barbell-outline" />
          </View>

          <View style={s.sectionHead}>
            <View><Text style={[s.sectionTitle, { color: C.text }]}>Your routines</Text><Text style={[s.sectionSub, { color: C.textSecondary }]}>Pick a plan and start tracking</Text></View>
            <TouchableOpacity style={[s.smallAdd, { backgroundColor: C.primaryLight }]} onPress={() => router.push('/workout-routine')}>
              <Ionicons name="add" size={18} color={C.primary} /><Text style={[s.smallAddText, { color: C.primary }]}>New</Text>
            </TouchableOpacity>
          </View>

          {routines.length === 0 ? (
            <TouchableOpacity style={[s.empty, { backgroundColor: C.card, borderColor: C.border }]} onPress={() => router.push('/workout-routine')}>
              <View style={[s.emptyIcon, { backgroundColor: C.lavender }]}><Ionicons name="clipboard-outline" size={26} color={C.grape} /></View>
              <Text style={[s.cardTitle, { color: C.text }]}>Build your first routine</Text>
              <Text style={[s.cardSub, { color: C.textSecondary }]}>Choose exercises and set your usual sets, reps, and weights.</Text>
            </TouchableOpacity>
          ) : routines.map((routine, index) => (
            <TouchableOpacity key={routine.id} style={[s.routine, { backgroundColor: C.card, borderColor: C.border }]} onPress={() => begin(routine.id)} onLongPress={() => removeRoutine(routine)}>
              <View style={[s.routineIcon, { backgroundColor: index % 2 ? C.mint : C.primaryLight }]}>
                <Ionicons name={index % 2 ? 'fitness-outline' : 'barbell-outline'} size={22} color={index % 2 ? C.success : C.primary} />
              </View>
              <View style={s.grow}><Text style={[s.cardTitle, { color: C.text }]}>{routine.name}</Text><Text style={[s.cardSub, { color: C.textSecondary }]}>{routine.exercise_count} exercise{routine.exercise_count === 1 ? '' : 's'}</Text></View>
              <TouchableOpacity hitSlop={8} onPress={() => router.push({ pathname: '/workout-routine', params: { id: routine.id } })}><Ionicons name="create-outline" size={20} color={C.textSecondary} /></TouchableOpacity>
              <Ionicons name="play-circle" size={30} color={C.primary} />
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={[s.emptyStart, { borderColor: C.border }]} onPress={() => begin()}>
            <Ionicons name="add-circle-outline" size={20} color={C.teal} />
            <Text style={[s.emptyStartText, { color: C.text }]}>Start an empty workout</Text>
          </TouchableOpacity>

          <View style={[s.sectionHead, { marginTop: 28 }]}>
            <View><Text style={[s.sectionTitle, { color: C.text }]}>Recent workouts</Text><Text style={[s.sectionSub, { color: C.textSecondary }]}>Your training story</Text></View>
          </View>
          {history.length === 0 ? <Text style={[s.noHistory, { color: C.textSecondary }]}>Your finished workouts will appear here.</Text> : history.map((item) => (
            <TouchableOpacity key={item.id} style={[s.history, { borderBottomColor: C.border }]} onPress={() => router.push({ pathname: '/workout-session', params: { id: item.id } })}>
              <View style={[s.historyDate, { backgroundColor: C.lavender }]}>
                <Text style={[s.historyDay, { color: C.grape }]}>{new Date(item.ended_at).getDate()}</Text>
                <Text style={[s.historyMonth, { color: C.grape }]}>{new Date(item.ended_at).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</Text>
              </View>
              <View style={s.grow}><Text style={[s.cardTitle, { color: C.text }]}>{item.name}</Text><Text style={[s.cardSub, { color: C.textSecondary }]}>{item.total_sets} sets · {item.duration_minutes} min · {Math.round(item.total_volume).toLocaleString()} {unit}</Text></View>
              <Ionicons name="checkmark-circle" size={22} color={C.success} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ C, value, label, icon }) {
  return <View style={[s.stat, { backgroundColor: C.card, borderColor: C.border }]}><Ionicons name={icon} size={18} color={C.primary} /><Text style={[s.statValue, { color: C.text }]} numberOfLines={1}>{value}</Text><Text style={[s.statLabel, { color: C.textSecondary }]}>{label}</Text></View>;
}

const s = StyleSheet.create({
  flex: { flex: 1 }, content: { paddingBottom: 60 }, hero: { height: 430, paddingTop: 54, paddingHorizontal: 20, justifyContent: 'space-between' },
  heroImage: { resizeMode: 'cover' }, heroTop: { flexDirection: 'row', justifyContent: 'space-between' }, circle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,.9)', alignItems: 'center', justifyContent: 'center' },
  heroCopy: { paddingBottom: 45 }, eyebrow: { fontFamily: 'Rounded', fontWeight: '900', fontSize: 11, letterSpacing: 1.5 }, title: { fontFamily: 'Story', fontSize: 54, lineHeight: 58 }, subtitle: { fontFamily: 'Rounded', fontWeight: '800', fontSize: 14 },
  sheet: { marginTop: -24, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20, paddingTop: 26 },
  resume: { borderRadius: 22, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }, resumeIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  resumeTitle: { color: '#fff', fontFamily: 'Rounded', fontWeight: '900', fontSize: 15 }, resumeSub: { color: 'rgba(255,255,255,.82)', fontFamily: 'Rounded', fontWeight: '700', fontSize: 10, marginTop: 3 },
  grow: { flex: 1 }, stats: { flexDirection: 'row', gap: 8, marginBottom: 28 }, stat: { flex: 1, minWidth: 0, borderRadius: 18, borderWidth: 1, padding: 11, gap: 4 },
  statValue: { fontFamily: 'Rounded', fontWeight: '900', fontSize: 17 }, statLabel: { fontFamily: 'Rounded', fontWeight: '800', fontSize: 9 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }, sectionTitle: { fontFamily: 'Rounded', fontWeight: '900', fontSize: 19 }, sectionSub: { fontFamily: 'Rounded', fontWeight: '700', fontSize: 11, marginTop: 2 },
  smallAdd: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', gap: 4, alignItems: 'center' }, smallAddText: { fontFamily: 'Rounded', fontWeight: '900', fontSize: 12 },
  routine: { borderRadius: 21, padding: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 10 }, routineIcon: { width: 46, height: 46, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: 'Rounded', fontWeight: '900', fontSize: 14 }, cardSub: { fontFamily: 'Rounded', fontWeight: '700', fontSize: 10, marginTop: 3 },
  empty: { borderRadius: 22, borderWidth: 1, padding: 22, alignItems: 'center', marginBottom: 10 }, emptyIcon: { width: 54, height: 54, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  emptyStart: { borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', padding: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 2 },
  emptyStartText: { fontFamily: 'Rounded', fontWeight: '900', fontSize: 13 }, history: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  historyDate: { width: 44, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, historyDay: { fontFamily: 'Rounded', fontWeight: '900', fontSize: 17 }, historyMonth: { fontFamily: 'Rounded', fontWeight: '900', fontSize: 8 },
  noHistory: { fontFamily: 'Rounded', fontWeight: '700', fontSize: 12, paddingVertical: 10 },
});
