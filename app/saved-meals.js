import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Modal,
} from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../src/context/ThemeContext';
import {
  getSavedMeals,
  createSavedMeal,
  deleteSavedMeal,
  removeItemFromMeal,
  addItemToMeal,
} from '../src/db/savedMealsDatabase';

function roundMacro(v) {
  const n = Number(v || 0);
  return Math.round(n * 10) / 10;
}

export default function SavedMealsScreen() {
  const C = useTheme();
  const [meals, setMeals] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  useFocusEffect(useCallback(() => {
    load();
  }, []));

  async function load() {
    setMeals(await getSavedMeals());
  }

  function confirmDelete(meal) {
    Alert.alert('delete meal', `remove "${meal.name}"?`, [
      { text: 'cancel', style: 'cancel' },
      {
        text: 'delete', style: 'destructive',
        onPress: async () => {
          await deleteSavedMeal(meal.id);
          await load();
        },
      },
    ]);
  }

  async function handleRemoveItem(mealId, itemId) {
    await removeItemFromMeal(mealId, itemId);
    await load();
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.container, { backgroundColor: C.background }]}>
        <View style={[s.header, { borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
            <Text style={[s.back, { color: C.text }]}>←</Text>
          </TouchableOpacity>
          <Text style={[s.title, { color: C.text }]}>saved meals</Text>
          <TouchableOpacity
            style={[s.createBtn, { backgroundColor: C.accent }]}
            onPress={() => setShowCreate(true)}
            activeOpacity={0.8}
          >
            <Text style={[s.createBtnText, { color: C.background }]}>+ new</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          {meals.length === 0 ? (
            <View style={s.emptyState}>
              <Text style={[s.emptyTitle, { color: C.text }]}>no saved meals yet</Text>
              <Text style={[s.emptySub, { color: C.textSecondary }]}>
                create a meal template to log multiple foods at once.
              </Text>
              <TouchableOpacity
                style={[s.emptyBtn, { backgroundColor: C.accent }]}
                onPress={() => setShowCreate(true)}
                activeOpacity={0.8}
              >
                <Text style={[s.emptyBtnText, { color: C.background }]}>create first meal</Text>
              </TouchableOpacity>
            </View>
          ) : meals.map((meal) => {
            const total = meal.items.reduce((sum, i) => sum + (Number(i.calories) || 0), 0);
            const totalP = meal.items.reduce((sum, i) => sum + (Number(i.protein) || 0), 0);
            const totalC = meal.items.reduce((sum, i) => sum + (Number(i.carbs) || 0), 0);
            const totalF = meal.items.reduce((sum, i) => sum + (Number(i.fat) || 0), 0);
            const expanded = expandedId === meal.id;
            return (
              <View key={meal.id} style={[s.mealCard, { backgroundColor: C.card }]}>
                <TouchableOpacity
                  style={s.mealCardTop}
                  onPress={() => setExpandedId(expanded ? null : meal.id)}
                  activeOpacity={0.75}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.mealName, { color: C.text }]}>{meal.name}</Text>
                    <Text style={[s.mealMeta, { color: C.textSecondary }]}>
                      {meal.items.length} items · {total} kcal
                      {totalP > 0 ? `  P ${roundMacro(totalP)}g` : ''}
                      {totalC > 0 ? `  C ${roundMacro(totalC)}g` : ''}
                      {totalF > 0 ? `  F ${roundMacro(totalF)}g` : ''}
                    </Text>
                  </View>
                  <Text style={[s.chevron, { color: C.textSecondary }]}>{expanded ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {expanded && (
                  <View style={[s.mealExpanded, { borderTopColor: C.border }]}>
                    {meal.items.length === 0 ? (
                      <Text style={[s.emptyItems, { color: C.textSecondary }]}>no items yet.</Text>
                    ) : meal.items.map((item) => (
                      <View key={item.id} style={[s.itemRow, { borderBottomColor: C.border }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.itemName, { color: C.text }]} numberOfLines={1}>{item.name}</Text>
                          <Text style={[s.itemMeta, { color: C.textSecondary }]}>
                            {item.calories} kcal
                            {item.protein ? `  P ${roundMacro(item.protein)}g` : ''}
                            {item.carbs   ? `  C ${roundMacro(item.carbs)}g`   : ''}
                            {item.fat     ? `  F ${roundMacro(item.fat)}g`     : ''}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleRemoveItem(meal.id, item.id)}
                          hitSlop={10}
                        >
                          <Text style={[s.removeItem, { color: C.danger }]}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                    <TouchableOpacity
                      style={[s.deleteMealBtn, { borderColor: C.danger }]}
                      onPress={() => confirmDelete(meal)}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.deleteMealText, { color: C.danger }]}>delete meal</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

        <CreateMealModal
          C={C}
          visible={showCreate}
          onClose={() => setShowCreate(false)}
          onSave={async (name, items) => {
            if (!name.trim()) { Alert.alert('name required', 'enter a name for this meal.'); return false; }
            if (!items.length) { Alert.alert('add items', 'add at least one food item.'); return false; }
            await createSavedMeal(name, items);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setShowCreate(false);
            await load();
            return true;
          }}
        />
      </View>
    </>
  );
}

function CreateMealModal({ C, visible, onClose, onSave }) {
  const [name, setName] = useState('');
  const [items, setItems] = useState([]);
  const [itemName, setItemName] = useState('');
  const [itemCal, setItemCal] = useState('');
  const [itemProtein, setItemProtein] = useState('');
  const [itemCarbs, setItemCarbs] = useState('');
  const [itemFat, setItemFat] = useState('');

  function reset() {
    setName('');
    setItems([]);
    setItemName('');
    setItemCal('');
    setItemProtein('');
    setItemCarbs('');
    setItemFat('');
  }

  function addItem() {
    const cal = Number(itemCal);
    if (!itemName.trim()) { Alert.alert('food name needed', ''); return; }
    if (!Number.isFinite(cal) || cal <= 0) { Alert.alert('calories needed', ''); return; }
    setItems((prev) => [...prev, {
      name: itemName.trim(),
      calories: Math.round(cal),
      protein: Number(itemProtein) || null,
      carbs:   Number(itemCarbs)   || null,
      fat:     Number(itemFat)     || null,
      meal: 'snack',
    }]);
    setItemName('');
    setItemCal('');
    setItemProtein('');
    setItemCarbs('');
    setItemFat('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function removeItem(index) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { reset(); onClose(); }}>
      <View style={s.modalOverlay}>
        <View style={[s.modalSheet, { backgroundColor: C.card }]}>
          <View style={[s.modalHeader, { borderBottomColor: C.border }]}>
            <Text style={[s.modalTitle, { color: C.text }]}>new meal</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }}>
              <Text style={[s.modalCancel, { color: C.textSecondary }]}>cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
            <TextInput
              style={[s.mealNameInput, { color: C.text, borderColor: C.border, backgroundColor: C.background }]}
              placeholder="meal name (e.g. My Breakfast)"
              placeholderTextColor={C.textSecondary}
              value={name}
              onChangeText={setName}
            />

            {items.length > 0 && (
              <View style={[s.itemsList, { borderColor: C.border }]}>
                {items.map((item, i) => (
                  <View key={i} style={[s.addedItem, { borderBottomColor: C.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.addedItemName, { color: C.text }]}>{item.name}</Text>
                      <Text style={[s.addedItemMeta, { color: C.textSecondary }]}>{item.calories} kcal</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeItem(i)} hitSlop={10}>
                      <Text style={[s.removeItem, { color: C.danger }]}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <Text style={[s.addItemLabel, { color: C.textSecondary }]}>add item</Text>

            <TextInput
              style={[s.inputField, { color: C.text, borderColor: C.border, backgroundColor: C.background }]}
              placeholder="food name"
              placeholderTextColor={C.textSecondary}
              value={itemName}
              onChangeText={setItemName}
            />
            <TextInput
              style={[s.inputField, { color: C.text, borderColor: C.border, backgroundColor: C.background }]}
              placeholder="calories"
              placeholderTextColor={C.textSecondary}
              value={itemCal}
              onChangeText={setItemCal}
              keyboardType="number-pad"
            />
            <View style={s.macroRow}>
              <MiniInput C={C} label="protein g" value={itemProtein} onChangeText={setItemProtein} />
              <MiniInput C={C} label="carbs g"   value={itemCarbs}   onChangeText={setItemCarbs} />
              <MiniInput C={C} label="fat g"     value={itemFat}     onChangeText={setItemFat} />
            </View>

            <TouchableOpacity
              style={[s.addItemBtn, { backgroundColor: C.primary + '20', borderColor: C.primary }]}
              onPress={addItem}
              activeOpacity={0.75}
            >
              <Text style={[s.addItemBtnText, { color: C.primary }]}>+ add item</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: C.accent }]}
              onPress={() => onSave(name, items).then((ok) => { if (ok) reset(); }).catch(() => {})}
              activeOpacity={0.8}
            >
              <Text style={[s.saveBtnText, { color: C.background }]}>save meal</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function MiniInput({ C, label, value, onChangeText }) {
  return (
    <View style={s.miniInputWrap}>
      <Text style={[s.miniInputLabel, { color: C.textSecondary }]}>{label}</Text>
      <TextInput
        style={[s.miniInput, { color: C.text, borderColor: C.border, backgroundColor: C.background }]}
        placeholder="0"
        placeholderTextColor={C.textSecondary}
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingTop: 60, paddingBottom: 16, borderBottomWidth: 1 },
  back: { fontSize: 24, fontWeight: '800' },
  title: { flex: 1, fontSize: 22, fontWeight: '900' },
  createBtn: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  createBtnText: { fontSize: 13, fontWeight: '900' },
  content: { padding: 20, paddingBottom: 50 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '900' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 19, paddingHorizontal: 40 },
  emptyBtn: { borderRadius: 999, paddingHorizontal: 24, paddingVertical: 14, marginTop: 8 },
  emptyBtnText: { fontSize: 14, fontWeight: '900' },
  mealCard: { borderRadius: 20, marginBottom: 14, elevation: 2, overflow: 'hidden' },
  mealCardTop: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  mealName: { fontSize: 15, fontWeight: '900' },
  mealMeta: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  chevron: { fontSize: 10, fontWeight: '900' },
  mealExpanded: { borderTopWidth: 1, padding: 16, gap: 0 },
  emptyItems: { fontSize: 13, paddingVertical: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1 },
  itemName: { fontSize: 13, fontWeight: '800' },
  itemMeta: { fontSize: 11, fontWeight: '600', marginTop: 3 },
  removeItem: { fontSize: 15, fontWeight: '900' },
  deleteMealBtn: { borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center', marginTop: 14 },
  deleteMealText: { fontSize: 13, fontWeight: '900' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%', flex: 0 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: '900' },
  modalCancel: { fontSize: 13, fontWeight: '800' },
  modalContent: { padding: 18, paddingBottom: 40 },
  mealNameInput: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, fontWeight: '700', marginBottom: 16 },
  itemsList: { borderWidth: 1, borderRadius: 14, marginBottom: 16, overflow: 'hidden' },
  addedItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderBottomWidth: 1 },
  addedItemName: { fontSize: 13, fontWeight: '800' },
  addedItemMeta: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  addItemLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginBottom: 8 },
  inputField: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 10 },
  macroRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  miniInputWrap: { flex: 1, gap: 4 },
  miniInputLabel: { fontSize: 10, fontWeight: '800' },
  miniInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 10, fontSize: 13, textAlign: 'center', fontWeight: '700' },
  addItemBtn: { borderWidth: 1.5, borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginBottom: 12 },
  addItemBtnText: { fontSize: 14, fontWeight: '900' },
  saveBtn: { borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '800' },
});
