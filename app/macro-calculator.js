import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert,
} from 'react-native';
import { Stack, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../src/context/ThemeContext';
import { saveCalorieGoal, saveMacroGoals } from '../src/db/calorieDatabase';

const STORAGE_KEY = 'macro_calc_inputs';

const ACTIVITY_LEVELS = [
  { key: 'sedentary',    label: 'Sedentary',    sub: 'little or no exercise',               multiplier: 1.2 },
  { key: 'light',        label: 'Light',         sub: 'exercise 1–3×/week',                  multiplier: 1.375 },
  { key: 'moderate',     label: 'Moderate',      sub: 'exercise 4–5×/week',                  multiplier: 1.55 },
  { key: 'active',       label: 'Active',        sub: 'daily or intense 3–4×/week',          multiplier: 1.725 },
  { key: 'very_active',  label: 'Very Active',   sub: 'intense exercise 6–7×/week',          multiplier: 1.9 },
  { key: 'extra_active', label: 'Extra Active',  sub: 'very intense daily / physical job',   multiplier: 2.0 },
];

const GOALS = [
  { key: 'extreme_loss', label: 'Extreme cut',   sub: '–2 lb/week',  delta: -1000 },
  { key: 'loss',         label: 'Cut',           sub: '–1 lb/week',  delta: -500 },
  { key: 'mild_loss',    label: 'Mild cut',      sub: '–0.5 lb/week',delta: -250 },
  { key: 'maintain',     label: 'Maintain',      sub: 'keep weight', delta: 0 },
  { key: 'mild_gain',    label: 'Mild bulk',     sub: '+0.5 lb/week',delta: 250 },
  { key: 'gain',         label: 'Bulk',          sub: '+1 lb/week',  delta: 500 },
  { key: 'extreme_gain', label: 'Aggressive bulk',sub:'+2 lb/week',  delta: 1000 },
];

const DIET_TYPES = [
  { key: 'balanced',     label: 'Balanced',      sub: '30 / 40 / 30', protein: 0.30, carbs: 0.40, fat: 0.30 },
  { key: 'high_protein', label: 'High Protein',  sub: '40 / 30 / 30', protein: 0.40, carbs: 0.30, fat: 0.30 },
  { key: 'low_carb',     label: 'Low Carb',      sub: '35 / 25 / 40', protein: 0.35, carbs: 0.25, fat: 0.40 },
  { key: 'keto',         label: 'Keto',          sub: '30 / 5 / 65',  protein: 0.30, carbs: 0.05, fat: 0.65 },
  { key: 'bulking',      label: 'Bulking',       sub: '25 / 50 / 25', protein: 0.25, carbs: 0.50, fat: 0.25 },
  { key: 'cutting',      label: 'Cutting',       sub: '40 / 35 / 25', protein: 0.40, carbs: 0.35, fat: 0.25 },
];

function calcResults(age, gender, heightCm, weightKg, activityKey, goalKey, dietKey) {
  const a = ACTIVITY_LEVELS.find((x) => x.key === activityKey);
  const g = GOALS.find((x) => x.key === goalKey);
  const d = DIET_TYPES.find((x) => x.key === dietKey);
  if (!a || !g || !d || !heightCm || !weightKg || !age) return null;

  const bmr = gender === 'male'
    ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

  const tdee = bmr * a.multiplier;
  const calories = Math.max(1000, Math.round(tdee + g.delta));

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calories,
    protein: Math.round((calories * d.protein) / 4),
    carbs:   Math.round((calories * d.carbs)   / 4),
    fat:     Math.round((calories * d.fat)     / 9),
    proteinPct: Math.round(d.protein * 100),
    carbsPct:   Math.round(d.carbs   * 100),
    fatPct:     Math.round(d.fat     * 100),
  };
}

export default function MacroCalculatorScreen() {
  const C = useTheme();

  const [age,      setAge]      = useState('');
  const [gender,   setGender]   = useState('male');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [heightUnit, setHeightUnit] = useState('cm');
  const [weightUnit, setWeightUnit] = useState('kg');
  const [ftVal,    setFtVal]    = useState('');
  const [inVal,    setInVal]    = useState('');
  const [activity, setActivity] = useState('moderate');
  const [goal,     setGoal]     = useState('maintain');
  const [diet,     setDiet]     = useState('balanced');
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const s = JSON.parse(raw);
        if (s.age)        setAge(s.age);
        if (s.gender)     setGender(s.gender);
        if (s.heightCm)   setHeightCm(s.heightCm);
        if (s.weightKg)   setWeightKg(s.weightKg);
        if (s.heightUnit) setHeightUnit(s.heightUnit);
        if (s.weightUnit) setWeightUnit(s.weightUnit);
        if (s.ftVal)      setFtVal(s.ftVal);
        if (s.inVal)      setInVal(s.inVal);
        if (s.activity)   setActivity(s.activity);
        if (s.goal)       setGoal(s.goal);
        if (s.diet)       setDiet(s.diet);
      } catch {}
    });
  }, []);

  function saveInputs(patch) {
    const next = { age, gender, heightCm, weightKg, heightUnit, weightUnit, ftVal, inVal, activity, goal, diet, ...patch };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function set(setter, key, value) {
    setter(value);
    saveInputs({ [key]: value });
  }

  function switchWeightUnit(u) {
    if (u === weightUnit) return;
    const w = parseFloat(weightKg);
    let next = '';
    if (Number.isFinite(w)) {
      next = u === 'lbs'
        ? String(Math.round(w * 2.20462 * 10) / 10)
        : String(Math.round(w / 2.20462 * 10) / 10);
    }
    setWeightUnit(u);
    setWeightKg(next);
    saveInputs({ weightUnit: u, weightKg: next });
  }

  function switchHeightUnit(u) {
    if (u === heightUnit) return;
    const cm = parseFloat(heightCm);
    if (u === 'ft') {
      if (Number.isFinite(cm)) {
        const totalIn = cm / 2.54;
        const ft = Math.floor(totalIn / 12);
        const inch = Math.round(totalIn % 12);
        setFtVal(String(ft));
        setInVal(String(inch));
        saveInputs({ heightUnit: u, ftVal: String(ft), inVal: String(inch) });
      } else {
        saveInputs({ heightUnit: u });
      }
    } else {
      const ft = parseFloat(ftVal) || 0;
      const inch = parseFloat(inVal) || 0;
      const cm2 = Math.round((ft * 12 + inch) * 2.54);
      setHeightCm(cm2 > 0 ? String(cm2) : '');
      saveInputs({ heightUnit: u, heightCm: cm2 > 0 ? String(cm2) : '' });
    }
    setHeightUnit(u);
  }

  function updateFtIn(ft, inch) {
    setFtVal(ft);
    setInVal(inch);
    const f = parseFloat(ft) || 0;
    const i = parseFloat(inch) || 0;
    const cm2 = Math.round((f * 12 + i) * 2.54);
    setHeightCm(cm2 > 0 ? String(cm2) : '');
    saveInputs({ ftVal: ft, inVal: inch, heightCm: cm2 > 0 ? String(cm2) : '' });
  }

  const weightForCalc = weightUnit === 'lbs'
    ? (parseFloat(weightKg) / 2.20462)
    : parseFloat(weightKg);

  const results = calcResults(
    parseInt(age),
    gender,
    parseFloat(heightCm),
    weightForCalc,
    activity,
    goal,
    diet,
  );

  async function applyGoals() {
    if (!results) return;
    setApplying(true);
    try {
      await Promise.all([
        saveCalorieGoal(results.calories),
        saveMacroGoals({ protein: results.protein, carbs: results.carbs, fat: results.fat }),
      ]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'goals applied',
        `calorie goal set to ${results.calories} kcal\nprotein ${results.protein}g · carbs ${results.carbs}g · fat ${results.fat}g`,
        [{ text: 'ok', onPress: () => router.back() }]
      );
    } catch {
      Alert.alert('error', 'could not apply goals.');
    } finally {
      setApplying(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={[s.container, { backgroundColor: C.background }]}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
            <Text style={[s.back, { color: C.text }]}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: C.text }]}>macro calculator</Text>
            <Text style={[s.subtitle, { color: C.textSecondary }]}>mifflin-st jeor formula</Text>
          </View>
        </View>

        {/* Personal info */}
        <View style={[s.card, { backgroundColor: C.card }]}>
          <Text style={[s.cardTitle, { color: C.text }]}>personal info</Text>

          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={[s.fieldLabel, { color: C.textSecondary }]}>age</Text>
              <TextInput
                style={[s.input, { color: C.text, borderColor: C.border, backgroundColor: C.background }]}
                placeholder="25"
                placeholderTextColor={C.textSecondary}
                value={age}
                onChangeText={(v) => set(setAge, 'age', v)}
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.fieldLabel, { color: C.textSecondary }]}>gender</Text>
              <View style={[s.toggle, { backgroundColor: C.background }]}>
                {['male', 'female'].map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[s.toggleBtn, gender === g && { backgroundColor: C.accent }]}
                    onPress={() => set(setGender, 'gender', g)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.toggleText, { color: gender === g ? C.background : C.textSecondary }]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={[s.fieldLabel, { color: C.textSecondary }]}>height</Text>
              <View style={[s.toggle, { backgroundColor: C.background, marginBottom: 6 }]}>
                {['cm', 'ft'].map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[s.toggleBtn, heightUnit === u && { backgroundColor: C.accent }]}
                    onPress={() => switchHeightUnit(u)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.toggleText, { color: heightUnit === u ? C.background : C.textSecondary }]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {heightUnit === 'cm' ? (
                <TextInput
                  style={[s.input, { color: C.text, borderColor: C.border, backgroundColor: C.background }]}
                  placeholder="175"
                  placeholderTextColor={C.textSecondary}
                  value={heightCm}
                  onChangeText={(v) => { setHeightCm(v); saveInputs({ heightCm: v }); }}
                  keyboardType="number-pad"
                  maxLength={3}
                />
              ) : (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TextInput
                    style={[s.input, { flex: 1, color: C.text, borderColor: C.border, backgroundColor: C.background }]}
                    placeholder="5 ft"
                    placeholderTextColor={C.textSecondary}
                    value={ftVal}
                    onChangeText={(v) => updateFtIn(v, inVal)}
                    keyboardType="number-pad"
                    maxLength={1}
                  />
                  <TextInput
                    style={[s.input, { flex: 1, color: C.text, borderColor: C.border, backgroundColor: C.background }]}
                    placeholder="9 in"
                    placeholderTextColor={C.textSecondary}
                    value={inVal}
                    onChangeText={(v) => updateFtIn(ftVal, v)}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
              )}
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[s.fieldLabel, { color: C.textSecondary }]}>weight</Text>
              <View style={[s.toggle, { backgroundColor: C.background, marginBottom: 6 }]}>
                {['kg', 'lbs'].map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[s.toggleBtn, weightUnit === u && { backgroundColor: C.accent }]}
                    onPress={() => switchWeightUnit(u)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.toggleText, { color: weightUnit === u ? C.background : C.textSecondary }]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[s.input, { color: C.text, borderColor: C.border, backgroundColor: C.background }]}
                placeholder={weightUnit === 'kg' ? '70' : '154'}
                placeholderTextColor={C.textSecondary}
                value={weightKg}
                onChangeText={(v) => { setWeightKg(v); saveInputs({ weightKg: v }); }}
                keyboardType="decimal-pad"
                maxLength={6}
              />
            </View>
          </View>
        </View>

        {/* Activity level */}
        <View style={[s.card, { backgroundColor: C.card }]}>
          <Text style={[s.cardTitle, { color: C.text }]}>activity level</Text>
          <View style={s.optionGrid}>
            {ACTIVITY_LEVELS.map((item) => {
              const sel = activity === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[s.optionBtn, { borderColor: sel ? C.accent : C.border, backgroundColor: sel ? C.accent + '18' : C.background }]}
                  onPress={() => set(setActivity, 'activity', item.key)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.optionLabel, { color: sel ? C.accent : C.text }]}>{item.label}</Text>
                  <Text style={[s.optionSub, { color: C.textSecondary }]} numberOfLines={1}>{item.sub}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Goal */}
        <View style={[s.card, { backgroundColor: C.card }]}>
          <Text style={[s.cardTitle, { color: C.text }]}>goal</Text>
          <View style={s.optionGrid}>
            {GOALS.map((item) => {
              const sel = goal === item.key;
              const isBulk = item.delta > 0;
              const isCut  = item.delta < 0;
              const accentColor = isBulk ? C.success : isCut ? C.danger : C.accent;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[s.optionBtn, { borderColor: sel ? accentColor : C.border, backgroundColor: sel ? accentColor + '18' : C.background }]}
                  onPress={() => set(setGoal, 'goal', item.key)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.optionLabel, { color: sel ? accentColor : C.text }]}>{item.label}</Text>
                  <Text style={[s.optionSub, { color: C.textSecondary }]}>{item.sub}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Diet type */}
        <View style={[s.card, { backgroundColor: C.card }]}>
          <Text style={[s.cardTitle, { color: C.text }]}>diet type</Text>
          <Text style={[s.cardHint, { color: C.textSecondary }]}>protein % · carbs % · fat %</Text>
          <View style={s.optionGrid}>
            {DIET_TYPES.map((item) => {
              const sel = diet === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[s.optionBtn, { borderColor: sel ? C.accent : C.border, backgroundColor: sel ? C.accent + '18' : C.background }]}
                  onPress={() => set(setDiet, 'diet', item.key)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.optionLabel, { color: sel ? C.accent : C.text }]}>{item.label}</Text>
                  <Text style={[s.optionSub, { color: C.textSecondary }]}>{item.sub}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Results */}
        {results ? (
          <View style={[s.resultsCard, { backgroundColor: C.card }]}>
            <Text style={[s.cardTitle, { color: C.text }]}>your results</Text>

            <View style={s.statsRow}>
              <View style={s.statItem}>
                <Text style={[s.statValue, { color: C.textSecondary }]}>{results.bmr}</Text>
                <Text style={[s.statLabel, { color: C.textSecondary }]}>BMR</Text>
              </View>
              <View style={[s.statDivider, { backgroundColor: C.border }]} />
              <View style={s.statItem}>
                <Text style={[s.statValue, { color: C.textSecondary }]}>{results.tdee}</Text>
                <Text style={[s.statLabel, { color: C.textSecondary }]}>TDEE</Text>
              </View>
              <View style={[s.statDivider, { backgroundColor: C.border }]} />
              <View style={s.statItem}>
                <Text style={[s.statValue, { color: C.text, fontSize: 24 }]}>{results.calories}</Text>
                <Text style={[s.statLabel, { color: C.textSecondary }]}>target kcal</Text>
              </View>
            </View>

            <View style={[s.macroResultRow, { borderTopColor: C.border }]}>
              <MacroResult C={C} label="Protein" grams={results.protein} pct={results.proteinPct} color="#89B4D4" />
              <MacroResult C={C} label="Carbs"   grams={results.carbs}   pct={results.carbsPct}   color="#F9C74F" />
              <MacroResult C={C} label="Fat"     grams={results.fat}     pct={results.fatPct}     color="#F4A56A" />
            </View>

            <TouchableOpacity
              style={[s.applyBtn, { backgroundColor: C.accent }, applying && { opacity: 0.55 }]}
              onPress={applyGoals}
              disabled={applying}
              activeOpacity={0.8}
            >
              <Text style={[s.applyBtnText, { color: C.background }]}>
                {applying ? 'applying...' : 'apply to calorie & macro goals'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[s.emptyResults, { backgroundColor: C.card }]}>
            <Text style={[s.emptyText, { color: C.textSecondary }]}>fill in your info above to see your macros</Text>
          </View>
        )}
      </ScrollView>
    </>
  );
}

function MacroResult({ C, label, grams, pct, color }) {
  return (
    <View style={s.macroResultItem}>
      <View style={[s.macroResultDot, { backgroundColor: color }]} />
      <Text style={[s.macroResultGrams, { color: C.text }]}>{grams}g</Text>
      <Text style={[s.macroResultLabel, { color: C.textSecondary }]}>{label}</Text>
      <Text style={[s.macroResultPct, { color: C.textSecondary }]}>{pct}%</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 60, paddingBottom: 50 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  back: { fontSize: 24, fontWeight: '800' },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  card: { borderRadius: 22, padding: 18, marginBottom: 16, elevation: 2 },
  cardTitle: { fontSize: 17, fontWeight: '900', marginBottom: 14 },
  cardHint: { fontSize: 11, fontWeight: '700', marginTop: -10, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12, marginTop: 10 },
  fieldLabel: { fontSize: 11, fontWeight: '800', marginBottom: 6 },
  input: {
    borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontWeight: '700',
  },
  toggle: { flexDirection: 'row', borderRadius: 12, padding: 3, gap: 2 },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  toggleText: { fontSize: 12, fontWeight: '900' },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionBtn: {
    minWidth: '47%', flexGrow: 1,
    borderWidth: 1.5, borderRadius: 14,
    paddingVertical: 10, paddingHorizontal: 12,
  },
  optionLabel: { fontSize: 13, fontWeight: '900' },
  optionSub: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  resultsCard: { borderRadius: 22, padding: 18, marginBottom: 16, elevation: 2 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, height: 40 },
  statValue: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  macroResultRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 16,
    marginBottom: 18,
  },
  macroResultItem: { flex: 1, alignItems: 'center', gap: 3 },
  macroResultDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 2 },
  macroResultGrams: { fontSize: 20, fontWeight: '900' },
  macroResultLabel: { fontSize: 11, fontWeight: '800' },
  macroResultPct: { fontSize: 10, fontWeight: '700' },
  applyBtn: { borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  applyBtnText: { fontSize: 15, fontWeight: '800' },
  emptyResults: { borderRadius: 22, padding: 24, marginBottom: 16, elevation: 2, alignItems: 'center' },
  emptyText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
