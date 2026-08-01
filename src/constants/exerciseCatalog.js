import PUBLIC_DOMAIN_EXERCISES from './exerciseCatalog.public-domain.json';
// Maps catalog `id` -> a demo photo URL from yuhonas/free-exercise-db (Unlicense /
// public domain). Images are NOT bundled into the app — loaded lazily by URL so
// the ~130MB catalog of photos doesn't bloat the APK. See THIRD_PARTY_NOTICES.md.
import EXERCISE_IMAGES from './exerciseImages.json';

const CURATED_EXERCISES = [
  ['Barbell Bench Press', 'Chest', 'barbell'], ['Incline Dumbbell Press', 'Chest', 'dumbbell'],
  ['Push-Up', 'Chest', 'bodyweight'], ['Cable Fly', 'Chest', 'cable'],
  ['Overhead Press', 'Shoulders', 'barbell'], ['Dumbbell Shoulder Press', 'Shoulders', 'dumbbell'],
  ['Lateral Raise', 'Shoulders', 'dumbbell'], ['Face Pull', 'Shoulders', 'cable'],
  ['Pull-Up', 'Back', 'bodyweight'], ['Lat Pulldown', 'Back', 'cable'],
  ['Barbell Row', 'Back', 'barbell'], ['Seated Cable Row', 'Back', 'cable'],
  ['Single-Arm Dumbbell Row', 'Back', 'dumbbell'], ['Deadlift', 'Back', 'barbell'],
  ['Back Squat', 'Legs', 'barbell'], ['Front Squat', 'Legs', 'barbell'],
  ['Leg Press', 'Legs', 'machine'], ['Romanian Deadlift', 'Legs', 'barbell'],
  ['Walking Lunge', 'Legs', 'dumbbell'], ['Leg Extension', 'Legs', 'machine'],
  ['Leg Curl', 'Legs', 'machine'], ['Hip Thrust', 'Glutes', 'barbell'],
  ['Glute Bridge', 'Glutes', 'bodyweight'], ['Bulgarian Split Squat', 'Legs', 'dumbbell'],
  ['Standing Calf Raise', 'Calves', 'machine'], ['Seated Calf Raise', 'Calves', 'machine'],
  ['Barbell Curl', 'Biceps', 'barbell'], ['Dumbbell Curl', 'Biceps', 'dumbbell'],
  ['Hammer Curl', 'Biceps', 'dumbbell'], ['Preacher Curl', 'Biceps', 'machine'],
  ['Triceps Pushdown', 'Triceps', 'cable'], ['Skull Crusher', 'Triceps', 'barbell'],
  ['Dips', 'Triceps', 'bodyweight'], ['Overhead Triceps Extension', 'Triceps', 'dumbbell'],
  ['Plank', 'Core', 'bodyweight'], ['Hanging Leg Raise', 'Core', 'bodyweight'],
  ['Cable Crunch', 'Core', 'cable'], ['Russian Twist', 'Core', 'bodyweight'],
  ['Running', 'Cardio', 'cardio'], ['Cycling', 'Cardio', 'cardio'],
  ['Rowing Machine', 'Cardio', 'cardio'], ['Stair Climber', 'Cardio', 'cardio'],
].map(([name, muscle, equipment]) => ({
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
  name, muscle, equipment, category: 'strength', level: 'beginner', source: 'Daily Mood',
}));

const nameKey = (name) => String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
const byName = new Map(PUBLIC_DOMAIN_EXERCISES.map((exercise) => [nameKey(exercise.name), exercise]));
for (const exercise of CURATED_EXERCISES) byName.set(nameKey(exercise.name), exercise);

export const EXERCISE_CATALOG = [...byName.values()]
  .map((exercise) => (EXERCISE_IMAGES[exercise.id] ? { ...exercise, image: EXERCISE_IMAGES[exercise.id] } : exercise))
  .sort((a, b) => a.name.localeCompare(b.name));

const MUSCLE_ORDER = ['Chest', 'Shoulders', 'Back', 'Legs', 'Glutes', 'Calves', 'Biceps', 'Triceps', 'Forearms', 'Core', 'Neck', 'Full Body', 'Cardio'];
const EQUIPMENT_ORDER = ['bodyweight', 'dumbbell', 'barbell', 'cable', 'machine', 'kettlebell', 'band', 'ez bar', 'medicine ball', 'stability ball', 'foam roller', 'other', 'cardio'];

export const MUSCLE_GROUPS = ['All', ...MUSCLE_ORDER.filter((muscle) => EXERCISE_CATALOG.some((exercise) => exercise.muscle === muscle))];
export const EQUIPMENT_GROUPS = ['All', ...EQUIPMENT_ORDER.filter((equipment) => EXERCISE_CATALOG.some((exercise) => exercise.equipment === equipment))];
