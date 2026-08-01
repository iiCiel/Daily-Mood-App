import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Image, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../src/context/ThemeContext';
import { EQUIPMENT_GROUPS, EXERCISE_CATALOG, MUSCLE_GROUPS } from '../src/constants/exerciseCatalog';
import { getRoutine, getWorkoutUnit, saveRoutine } from '../src/db/workoutDatabase';

export default function RoutineEditor() {
  const C = useTheme();
  const { id } = useLocalSearchParams();
  const [name, setName] = useState('');
  const [exercises, setExercises] = useState([]);
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState('All');
  const [equipment, setEquipment] = useState('All');
  const [unit, setUnit] = useState('kg');

  useFocusEffect(useCallback(() => { load(); }, [id]));
  async function load() {
    setUnit(await getWorkoutUnit());
    if (!id) return;
    const routine = await getRoutine(id);
    if (routine) { setName(routine.name); setExercises(routine.exercises); }
  }
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return EXERCISE_CATALOG.filter((e) =>
      (muscle === 'All' || e.muscle === muscle)
      && (equipment === 'All' || e.equipment === equipment)
      && (!needle || `${e.name} ${e.muscle} ${e.equipment} ${e.category || ''}`.toLowerCase().includes(needle))
    );
  }, [query, muscle, equipment]);

  function addExercise(e) {
    setExercises((current) => [...current, { exercise_id: e.id, name: e.name, muscle: e.muscle, target_sets: 3, target_reps: 8, target_weight: 0 }]);
    Haptics.selectionAsync(); setPicker(false); setQuery('');
  }
  function update(index, key, value) { setExercises((all) => all.map((e, i) => i === index ? { ...e, [key]: value } : e)); }
  async function save() {
    if (!name.trim()) return Alert.alert('Name your routine', 'Try something like “Upper body” or “Leg day”.');
    if (!exercises.length) return Alert.alert('Add an exercise', 'A routine needs at least one exercise.');
    await saveRoutine({ id, name, exercises });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); router.back();
  }

  return <View style={[s.flex, { backgroundColor: C.background }]}>
    <Stack.Screen options={{ headerShown: false }} />
    <View style={s.header}>
      <TouchableOpacity onPress={() => router.back()}><Ionicons name="close" size={26} color={C.text} /></TouchableOpacity>
      <Text style={[s.headerTitle, { color: C.text }]}>{id ? 'Edit routine' : 'New routine'}</Text>
      <TouchableOpacity onPress={save}><Text style={[s.save, { color: C.primary }]}>Save</Text></TouchableOpacity>
    </View>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={[s.label, { color: C.textSecondary }]}>ROUTINE NAME</Text>
      <TextInput style={[s.name, { color: C.text, backgroundColor: C.card, borderColor: C.border }]} placeholder="e.g. Full body" placeholderTextColor={C.textSecondary} value={name} onChangeText={setName} />
      <Text style={[s.label, { color: C.textSecondary, marginTop: 24 }]}>EXERCISES · {exercises.length}</Text>
      {exercises.map((e, index) => <View key={`${e.exercise_id}-${index}`} style={[s.exercise, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={s.exerciseHead}>
          <View style={[s.icon, { backgroundColor: C.primaryLight }]}><Text style={[s.initials, { color: C.primary }]}>{e.name.split(' ').map((x) => x[0]).slice(0, 2).join('')}</Text></View>
          <View style={s.grow}><Text style={[s.exerciseName, { color: C.text }]}>{e.name}</Text><Text style={[s.muscle, { color: C.textSecondary }]}>{e.muscle}</Text></View>
          <TouchableOpacity onPress={() => setExercises((all) => all.filter((_, i) => i !== index))}><Ionicons name="trash-outline" size={19} color={C.danger} /></TouchableOpacity>
        </View>
        <View style={s.targets}>
          <Target C={C} label="SETS" value={String(e.target_sets)} onChange={(v) => update(index, 'target_sets', v)} />
          <Text style={[s.times, { color: C.textSecondary }]}>×</Text>
          <Target C={C} label="REPS" value={String(e.target_reps)} onChange={(v) => update(index, 'target_reps', v)} />
          <Target C={C} label={unit.toUpperCase()} value={String(e.target_weight)} decimal onChange={(v) => update(index, 'target_weight', v)} />
        </View>
      </View>)}
      <TouchableOpacity style={[s.add, { borderColor: C.primary, backgroundColor: C.primaryLight }]} onPress={() => setPicker(true)}>
        <Ionicons name="add-circle" size={21} color={C.primary} /><Text style={[s.addText, { color: C.primary }]}>Add exercise</Text>
      </TouchableOpacity>
    </ScrollView>
    <ExercisePicker C={C} visible={picker} onClose={() => setPicker(false)} query={query} setQuery={setQuery} muscle={muscle} setMuscle={setMuscle} equipment={equipment} setEquipment={setEquipment} filtered={filtered} onPick={addExercise} />
  </View>;
}

function Target({ C, label, value, onChange, decimal }) {
  return <View style={s.target}><Text style={[s.targetLabel, { color: C.textSecondary }]}>{label}</Text><TextInput style={[s.targetInput, { color: C.text, backgroundColor: C.background }]} value={value} onChangeText={onChange} keyboardType={decimal ? 'decimal-pad' : 'number-pad'} selectTextOnFocus /></View>;
}

export function ExercisePicker({ C, visible, onClose, query, setQuery, muscle, setMuscle, equipment = 'All', setEquipment = () => {}, filtered, onPick }) {
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <View style={[s.picker, { backgroundColor: C.background }]}>
      <View style={s.pickerHead}><Text style={[s.pickerTitle, { color: C.text }]}>Choose exercise</Text><TouchableOpacity onPress={onClose}><Ionicons name="close-circle" size={27} color={C.textSecondary} /></TouchableOpacity></View>
      <View style={[s.search, { backgroundColor: C.card, borderColor: C.border }]}><Ionicons name="search" size={18} color={C.textSecondary} /><TextInput style={[s.searchInput, { color: C.text }]} placeholder="Search exercises" placeholderTextColor={C.textSecondary} value={query} onChangeText={setQuery} autoFocus /></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow} contentContainerStyle={s.chips}>{MUSCLE_GROUPS.map((m) => <TouchableOpacity key={m} style={[s.chip, { backgroundColor: muscle === m ? C.primary : C.card, borderColor: C.border }]} onPress={() => setMuscle(m)}><Text style={[s.chipText, { color: muscle === m ? '#fff' : C.textSecondary }]}>{m}</Text></TouchableOpacity>)}</ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow} contentContainerStyle={s.chips}>{EQUIPMENT_GROUPS.map((item) => <TouchableOpacity key={item} style={[s.chip, { backgroundColor: equipment === item ? C.teal : C.card, borderColor: C.border }]} onPress={() => setEquipment(item)}><Text style={[s.chipText, { color: equipment === item ? '#fff' : C.textSecondary }]}>{item}</Text></TouchableOpacity>)}</ScrollView>
      <Text style={[s.resultCount, { color: C.textSecondary }]}>{filtered.length} exercise{filtered.length === 1 ? '' : 's'}</Text>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        style={s.resultList}
        contentContainerStyle={s.results}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={18}
        windowSize={7}
        renderItem={({ item: e }) => <TouchableOpacity style={[s.result, { borderBottomColor: C.border }]} onPress={() => onPick(e)}>
          {e.image ? <Image source={{ uri: e.image }} style={s.icon} /> : <View style={[s.icon, { backgroundColor: C.lavender }]}><Text style={[s.initials, { color: C.grape }]}>{e.name.split(' ').map((x) => x[0]).slice(0, 2).join('')}</Text></View>}
          <View style={s.grow}><Text style={[s.exerciseName, { color: C.text }]}>{e.name}</Text><Text style={[s.muscle, { color: C.textSecondary }]}>{e.muscle} · {e.equipment}{e.level ? ` · ${e.level}` : ''}</Text></View><Ionicons name="add-circle-outline" size={23} color={C.primary} /></TouchableOpacity>}
      />
    </View>
  </Modal>;
}

const s = StyleSheet.create({
  flex: { flex: 1 }, header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, headerTitle: { fontFamily: 'Rounded', fontWeight: '900', fontSize: 18 }, save: { fontFamily: 'Rounded', fontWeight: '900', fontSize: 15 },
  content: { padding: 20, paddingBottom: 60 }, label: { fontFamily: 'Rounded', fontWeight: '900', fontSize: 10, letterSpacing: 1.2, marginBottom: 8 }, name: { borderWidth: 1, borderRadius: 18, padding: 16, fontFamily: 'Rounded', fontWeight: '900', fontSize: 18 },
  exercise: { borderWidth: 1, borderRadius: 21, padding: 14, marginBottom: 10 }, exerciseHead: { flexDirection: 'row', alignItems: 'center', gap: 10 }, grow: { flex: 1 }, icon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, initials: { fontFamily: 'Rounded', fontWeight: '900', fontSize: 12 }, exerciseName: { fontFamily: 'Rounded', fontWeight: '900', fontSize: 14 }, muscle: { fontFamily: 'Rounded', fontWeight: '700', fontSize: 10, marginTop: 2 },
  targets: { flexDirection: 'row', alignItems: 'flex-end', gap: 7, marginTop: 14 }, target: { flex: 1 }, targetLabel: { fontFamily: 'Rounded', fontWeight: '900', fontSize: 8, textAlign: 'center', marginBottom: 4 }, targetInput: { borderRadius: 11, paddingVertical: 9, paddingHorizontal: 5, textAlign: 'center', fontFamily: 'Rounded', fontWeight: '900', fontSize: 14 }, times: { fontWeight: '900', paddingBottom: 10 },
  add: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 18, padding: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 }, addText: { fontFamily: 'Rounded', fontWeight: '900', fontSize: 13 },
  picker: { flex: 1, paddingTop: Platform.OS === 'android' ? 52 : 26 }, pickerHead: { paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, pickerTitle: { fontFamily: 'Rounded', fontWeight: '900', fontSize: 22 }, search: { margin: 20, marginBottom: 12, borderWidth: 1, borderRadius: 16, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center' }, searchInput: { flex: 1, padding: 12, fontFamily: 'Rounded', fontWeight: '800' },
  chipRow: { flexGrow: 0, flexShrink: 0, marginBottom: 8 },
  chips: { paddingHorizontal: 20, gap: 7, alignItems: 'center' }, chip: { height: 34, borderRadius: 17, borderWidth: 1, paddingHorizontal: 13, justifyContent: 'center' }, chipText: { fontFamily: 'Rounded', fontWeight: '900', fontSize: 10 },
  resultCount: { fontFamily: 'Rounded', fontWeight: '800', fontSize: 10, paddingHorizontal: 20, paddingTop: 3 },
  resultList: { flex: 1 },
  results: { padding: 20, paddingTop: 8, paddingBottom: 40 }, result: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, borderBottomWidth: 1 },
});
