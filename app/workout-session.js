import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../src/context/ThemeContext';
import { EXERCISE_CATALOG } from '../src/constants/exerciseCatalog';
import { ExercisePicker } from './workout-routine';
import {
  addWorkoutExercise, addWorkoutSet, deleteWorkoutSet, discardWorkout, finishWorkout,
  getWorkout, getWorkoutUnit, removeWorkoutExercise, updateWorkoutSet,
} from '../src/db/workoutDatabase';

export default function WorkoutSession() {
  const C = useTheme();
  const { id } = useLocalSearchParams();
  const [workout, setWorkout] = useState(null);
  const [unit, setUnit] = useState('kg');
  const [elapsed, setElapsed] = useState(0);
  const [rest, setRest] = useState(0);
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState('All');
  const [equipment, setEquipment] = useState('All');

  useFocusEffect(useCallback(() => { load(); }, [id]));
  useEffect(() => {
    const timer = setInterval(() => {
      if (workout?.started_at && workout.status !== 'completed') setElapsed(Math.max(0, Math.floor((Date.now() - new Date(workout.started_at).getTime()) / 1000)));
      setRest((value) => Math.max(0, value - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [workout?.started_at, workout?.status]);

  async function load() {
    const next = await getWorkout(id);
    setWorkout(next);
    if (next?.status === 'completed') setElapsed((next.duration_minutes || 0) * 60);
    setUnit(await getWorkoutUnit());
  }
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return EXERCISE_CATALOG.filter((e) =>
      (muscle === 'All' || e.muscle === muscle)
      && (equipment === 'All' || e.equipment === equipment)
      && (!needle || `${e.name} ${e.muscle} ${e.equipment} ${e.category || ''}`.toLowerCase().includes(needle))
    );
  }, [query, muscle, equipment]);
  const doneSets = workout?.exercises.reduce((sum, e) => sum + e.sets.filter((x) => x.completed).length, 0) || 0;
  const totalSets = workout?.exercises.reduce((sum, e) => sum + e.sets.length, 0) || 0;
  const volume = workout?.exercises.reduce((sum, e) => sum + e.sets.filter((x) => x.completed).reduce((n, x) => n + Number(x.weight) * Number(x.reps), 0), 0) || 0;
  const completedWorkout = workout?.status === 'completed';

  function setLocal(exerciseIndex, setIndex, key, value) {
    setWorkout((w) => ({ ...w, exercises: w.exercises.map((e, ei) => ei !== exerciseIndex ? e : { ...e, sets: e.sets.map((x, si) => si === setIndex ? { ...x, [key]: value } : x) }) }));
  }
  async function toggleSet(exerciseIndex, setIndex) {
    const item = workout.exercises[exerciseIndex].sets[setIndex];
    const completed = !item.completed;
    setLocal(exerciseIndex, setIndex, 'completed', completed ? 1 : 0);
    await updateWorkoutSet(item.id, { completed });
    if (completed) { setRest(90); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
  }
  async function pickExercise(exercise) { await addWorkoutExercise(id, exercise); setPicker(false); setQuery(''); load(); }
  function removeExercise(exercise) {
    Alert.alert('Remove exercise?', exercise.name, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await removeWorkoutExercise(exercise.id); load(); } },
    ]);
  }
  function removeSet(exerciseIndex, setId) {
    const exercise = workout.exercises[exerciseIndex];
    if (exercise.sets.length <= 1) {
      Alert.alert("Can't remove last set", 'Remove the exercise instead if you want to drop it entirely.');
      return;
    }
    Alert.alert('Remove this set?', 'This set will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await deleteWorkoutSet(setId); load(); } },
    ]);
  }
  function finish() {
    if (!doneSets) return Alert.alert('Complete a set first', 'Check off at least one set before finishing.');
    Alert.alert('Finish workout?', `${doneSets} completed set${doneSets === 1 ? '' : 's'} · ${Math.round(volume).toLocaleString()} ${unit} volume`, [
      { text: 'Keep training', style: 'cancel' },
      { text: 'Finish', onPress: async () => { await finishWorkout(id); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); router.replace('/workout'); } },
    ]);
  }
  function discard() {
    Alert.alert('Discard workout?', 'This active workout and its sets will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: async () => { await discardWorkout(id); router.replace('/workout'); } },
    ]);
  }
  if (!workout) return <View style={[s.loading, { backgroundColor: C.background }]}><Text style={{ color: C.textSecondary }}>loading workout...</Text></View>;

  return <KeyboardAvoidingView style={[s.flex, { backgroundColor: C.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Stack.Screen options={{ headerShown: false }} />
    <View style={[s.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
      <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-down" size={27} color={C.text} /></TouchableOpacity>
      <View style={s.headerCenter}><Text style={[s.title, { color: C.text }]} numberOfLines={1}>{workout.name}</Text><Text style={[s.timer, { color: C.textSecondary }]}>{time(elapsed)} · {doneSets}/{totalSets} sets</Text></View>
      <TouchableOpacity style={[s.finish, { backgroundColor: completedWorkout ? C.success : C.accent }]} onPress={completedWorkout ? () => router.back() : finish}><Text style={s.finishText}>{completedWorkout ? 'Done' : 'Finish'}</Text></TouchableOpacity>
    </View>
    {rest > 0 && <View style={[s.restBar, { backgroundColor: C.teal }]}>
      <Ionicons name="timer-outline" size={18} color="#fff" /><Text style={s.restText}>Rest {time(rest)}</Text>
      <TouchableOpacity onPress={() => setRest((x) => x + 30)}><Text style={s.restAction}>+30s</Text></TouchableOpacity>
      <TouchableOpacity onPress={() => setRest(0)}><Text style={s.restAction}>Skip</Text></TouchableOpacity>
    </View>}
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <View style={[s.summary, { backgroundColor: C.card, borderColor: C.border }]}>
        <Summary C={C} label="DURATION" value={time(elapsed)} /><Summary C={C} label="VOLUME" value={`${Math.round(volume).toLocaleString()} ${unit}`} /><Summary C={C} label="SETS" value={`${doneSets}/${totalSets}`} />
      </View>
      {workout.exercises.length === 0 && <View style={s.empty}><View style={[s.emptyIcon, { backgroundColor: C.lavender }]}><Ionicons name="barbell-outline" size={30} color={C.grape} /></View><Text style={[s.emptyTitle, { color: C.text }]}>Your workout is empty</Text><Text style={[s.emptySub, { color: C.textSecondary }]}>Add an exercise to begin tracking.</Text></View>}
      {workout.exercises.map((exercise, exerciseIndex) => <View key={exercise.id} style={[s.exercise, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={s.exerciseHead}>
          {IMAGE_BY_EXERCISE_ID.get(exercise.exercise_id) ? (
            <Image source={{ uri: IMAGE_BY_EXERCISE_ID.get(exercise.exercise_id) }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, { backgroundColor: C.primaryLight }]}><Text style={[s.avatarText, { color: C.primary }]}>{initials(exercise.name)}</Text></View>
          )}
          <View style={s.grow}><Text style={[s.exerciseName, { color: C.text }]}>{exercise.name}</Text><Text style={[s.muscle, { color: C.textSecondary }]}>{exercise.muscle}</Text></View>
          {!completedWorkout && <TouchableOpacity hitSlop={8} onPress={() => removeExercise(exercise)}><Ionicons name="ellipsis-horizontal" size={21} color={C.textSecondary} /></TouchableOpacity>}
        </View>
        <View style={s.columns}><Text style={[s.colSmall, { color: C.textSecondary }]}>SET</Text><Text style={[s.col, { color: C.textSecondary }]}>PREVIOUS</Text><Text style={[s.col, { color: C.textSecondary }]}>{unit.toUpperCase()}</Text><Text style={[s.col, { color: C.textSecondary }]}>REPS</Text><View style={s.checkSpace} /></View>
        {exercise.sets.map((item, setIndex) => <View key={item.id} style={[s.setRow, item.completed && { backgroundColor: C.mint }]}>
          <TouchableOpacity disabled={completedWorkout} style={s.setNumber} onLongPress={() => removeSet(exerciseIndex, item.id)}><Text style={[s.setNumberText, { color: C.textSecondary }]}>{setIndex + 1}</Text></TouchableOpacity>
          <Text style={[s.previous, { color: C.textSecondary }]}>{item.prev_weight || '—'} × {item.prev_reps || '—'}</Text>
          <TextInput editable={!completedWorkout} style={[s.input, { color: C.text, backgroundColor: item.completed ? 'rgba(255,255,255,.6)' : C.background }]} value={String(item.weight)} keyboardType="decimal-pad" selectTextOnFocus onChangeText={(v) => setLocal(exerciseIndex, setIndex, 'weight', v)} onEndEditing={() => updateWorkoutSet(item.id, { weight: item.weight })} />
          <TextInput editable={!completedWorkout} style={[s.input, { color: C.text, backgroundColor: item.completed ? 'rgba(255,255,255,.6)' : C.background }]} value={String(item.reps)} keyboardType="number-pad" selectTextOnFocus onChangeText={(v) => setLocal(exerciseIndex, setIndex, 'reps', v)} onEndEditing={() => updateWorkoutSet(item.id, { reps: item.reps })} />
          <TouchableOpacity disabled={completedWorkout} style={[s.check, { borderColor: item.completed ? C.success : C.border, backgroundColor: item.completed ? C.success : C.card }]} onPress={() => toggleSet(exerciseIndex, setIndex)}><Ionicons name="checkmark" size={17} color={item.completed ? '#fff' : C.textSecondary} /></TouchableOpacity>
        </View>)}
        {!completedWorkout && <><TouchableOpacity style={[s.addSet, { backgroundColor: C.background }]} onPress={async () => { const last = exercise.sets[exercise.sets.length - 1]; await addWorkoutSet(exercise.id, last?.weight, last?.reps); load(); }}><Ionicons name="add" size={17} color={C.primary} /><Text style={[s.addSetText, { color: C.primary }]}>Add set</Text></TouchableOpacity>
        <Text style={[s.hint, { color: C.textSecondary }]}>Tip: hold a set number to remove that set.</Text></>}
      </View>)}
      {!completedWorkout && <><TouchableOpacity style={[s.addExercise, { backgroundColor: C.primaryLight }]} onPress={() => setPicker(true)}><Ionicons name="add-circle" size={22} color={C.primary} /><Text style={[s.addExerciseText, { color: C.primary }]}>Add exercise</Text></TouchableOpacity>
      <TouchableOpacity style={s.discard} onPress={discard}><Ionicons name="trash-outline" size={17} color={C.danger} /><Text style={[s.discardText, { color: C.danger }]}>Discard workout</Text></TouchableOpacity></>}
    </ScrollView>
    <ExercisePicker C={C} visible={picker} onClose={() => setPicker(false)} query={query} setQuery={setQuery} muscle={muscle} setMuscle={setMuscle} equipment={equipment} setEquipment={setEquipment} filtered={filtered} onPick={pickExercise} />
  </KeyboardAvoidingView>;
}

const time = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
const initials = (name) => name.split(' ').map((x) => x[0]).slice(0, 2).join('');
const IMAGE_BY_EXERCISE_ID = new Map(EXERCISE_CATALOG.filter((e) => e.image).map((e) => [e.id, e.image]));
function Summary({ C, label, value }) { return <View style={s.summaryItem}><Text style={[s.summaryLabel, { color: C.textSecondary }]}>{label}</Text><Text style={[s.summaryValue, { color: C.text }]} numberOfLines={1}>{value}</Text></View>; }

const s = StyleSheet.create({
  flex: { flex: 1 }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center' }, header: { paddingTop: 52, paddingHorizontal: 16, paddingBottom: 13, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }, headerCenter: { flex: 1, alignItems: 'center' }, title: { fontFamily: 'Rounded', fontWeight: '900', fontSize: 16, maxWidth: 190 }, timer: { fontFamily: 'Rounded', fontWeight: '800', fontSize: 10, marginTop: 2 }, finish: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 }, finishText: { color: '#fff', fontFamily: 'Rounded', fontWeight: '900', fontSize: 12 },
  restBar: { paddingHorizontal: 18, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }, restText: { color: '#fff', fontFamily: 'Rounded', fontWeight: '900', fontSize: 13, flex: 1 }, restAction: { color: '#fff', fontFamily: 'Rounded', fontWeight: '900', fontSize: 11, padding: 4 },
  content: { padding: 14, paddingBottom: 60 }, summary: { borderWidth: 1, borderRadius: 19, padding: 13, flexDirection: 'row', marginBottom: 12 }, summaryItem: { flex: 1, alignItems: 'center' }, summaryLabel: { fontFamily: 'Rounded', fontWeight: '900', fontSize: 8 }, summaryValue: { fontFamily: 'Rounded', fontWeight: '900', fontSize: 14, marginTop: 4 },
  exercise: { borderWidth: 1, borderRadius: 22, padding: 12, marginBottom: 12 }, exerciseHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }, avatar: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, avatarText: { fontFamily: 'Rounded', fontWeight: '900', fontSize: 12 }, grow: { flex: 1 }, exerciseName: { fontFamily: 'Rounded', fontWeight: '900', fontSize: 15 }, muscle: { fontFamily: 'Rounded', fontWeight: '700', fontSize: 10, marginTop: 2 },
  columns: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }, colSmall: { width: 34, textAlign: 'center', fontFamily: 'Rounded', fontWeight: '900', fontSize: 7 }, col: { flex: 1, textAlign: 'center', fontFamily: 'Rounded', fontWeight: '900', fontSize: 7 }, checkSpace: { width: 35 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingVertical: 4, paddingHorizontal: 2, marginBottom: 3 }, setNumber: { width: 32, alignItems: 'center' }, setNumberText: { fontFamily: 'Rounded', fontWeight: '900', fontSize: 13 }, previous: { flex: 1, textAlign: 'center', fontFamily: 'Rounded', fontWeight: '800', fontSize: 10 }, input: { flex: 1, borderRadius: 9, paddingVertical: 8, paddingHorizontal: 4, textAlign: 'center', fontFamily: 'Rounded', fontWeight: '900', fontSize: 13 }, check: { width: 33, height: 33, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  addSet: { borderRadius: 11, padding: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 6 }, addSetText: { fontFamily: 'Rounded', fontWeight: '900', fontSize: 11 }, hint: { fontFamily: 'Rounded', fontWeight: '700', fontSize: 8, textAlign: 'center', marginTop: 6 },
  addExercise: { borderRadius: 18, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, addExerciseText: { fontFamily: 'Rounded', fontWeight: '900', fontSize: 13 }, discard: { padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, discardText: { fontFamily: 'Rounded', fontWeight: '900', fontSize: 11 },
  empty: { alignItems: 'center', paddingVertical: 36 }, emptyIcon: { width: 62, height: 62, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }, emptyTitle: { fontFamily: 'Rounded', fontWeight: '900', fontSize: 17 }, emptySub: { fontFamily: 'Rounded', fontWeight: '700', fontSize: 11, marginTop: 4 },
});
