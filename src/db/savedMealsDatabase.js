import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'saved_meals_v1';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export async function getSavedMeals() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function persist(meals) {
  await AsyncStorage.setItem(KEY, JSON.stringify(meals));
}

export async function createSavedMeal(name, items = []) {
  const meals = await getSavedMeals();
  const meal = {
    id: genId(),
    name: String(name).trim(),
    items: items.map((item) => ({ ...item, id: genId() })),
    created_at: new Date().toISOString(),
  };
  meals.unshift(meal);
  await persist(meals);
  return meal;
}

export async function addItemToMeal(mealId, item) {
  const meals = await getSavedMeals();
  const meal = meals.find((m) => m.id === mealId);
  if (!meal) return;
  meal.items.push({ ...item, id: genId() });
  await persist(meals);
}

export async function removeItemFromMeal(mealId, itemId) {
  const meals = await getSavedMeals();
  const meal = meals.find((m) => m.id === mealId);
  if (!meal) return;
  meal.items = meal.items.filter((i) => i.id !== itemId);
  await persist(meals);
}

export async function deleteSavedMeal(id) {
  const meals = await getSavedMeals();
  await persist(meals.filter((m) => m.id !== id));
}

export async function renameSavedMeal(id, name) {
  const meals = await getSavedMeals();
  const meal = meals.find((m) => m.id === id);
  if (meal) { meal.name = String(name).trim(); await persist(meals); }
}
