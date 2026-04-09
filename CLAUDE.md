# Mood Journal App — Claude Context

## What this app is
A personal all-in-one daily app built with React Native / Expo. Three tabs: mood journal, habit tracker, pomodoro focus timer. Local-first (SQLite), dark/light mode, Android only for now.

## Build workflow
The user has thought this through — do not suggest rebuilding after every change.

### Two build types

**1. Dev Client — for active development**
- Requires laptop on + phone on same wifi
- Phone runs the Dev Client APK (built once with `eas build --platform android --profile development`)
- Run `npx expo start`, scan QR in the Dev Client app on phone
- Code changes hot-reload in seconds, no rebuild needed
- Use this while actively coding new features

**2. Preview APK — the real standalone app**
- Works everywhere, no laptop needed
- `eas build --platform android --profile preview`
- EAS free tier = ~2hr queue wait
- User installs via QR code from EAS dashboard
- Only build this when a meaningful batch of features is finished

### The honest constraints
- The 2hr wait is the EAS free tier queue — no way around it for the standalone APK without paying ($99/mo for EAS priority) or setting up a local Android build environment
- **Do not suggest a Preview build after small changes.** Batch features up first.

### Recommended workflow
1. Use Dev Client on home wifi while coding — instant updates
2. When a batch of features is done and tested, do one Preview build
3. Install the Preview APK — this is the app used day-to-day, works everywhere
4. Repeat: dev client for coding, preview build for releases

### Current state (as of last session)
- A Preview build was triggered that includes: habit tracker, year in pixels, 7-day mood trend, journal prompts, mood×focus correlation, streak milestones, quick mood from notifications, app lock
- Dev Client is configured and ready to build (`eas build --platform android --profile development`)

## Tech stack
- Expo SDK 54, Expo Router v6 (file-based routing)
- expo-sqlite for all local data
- expo-haptics, expo-notifications, expo-image-picker, expo-clipboard, expo-local-authentication, expo-dev-client
- No react-native-reanimated (removed — caused crashes in Expo Go / build issues). Use plain View animations only.
- `.npmrc` has `legacy-peer-deps=true`
- `babel.config.js` — only `babel-preset-expo`, no reanimated plugin

## File structure
```
app/
  _layout.js          — root layout, ThemeProvider, onboarding check, notification handler, app lock
  index.js            — just redirects to /(tabs)/mood
  entry.js            — mood entry create/edit for any date
  onboarding.js       — 3-slide intro, sets AsyncStorage 'onboarding_done'
  year.js             — year in pixels screen
  focus-stats.js      — pomodoro heatmap + stats
  habit-detail.js     — habit history + 30-day dot grid
  lock.js             — biometric lock screen component
  (tabs)/
    _layout.js        — custom tab bar: mood (◉), habits (◈), focus (◎)
    mood.js           — calendar home, streak, 7-day trend, correlation insight, copy month
    habits.js         — daily habit check-in, add/edit habits
    focus.js          — pomodoro timer, tasks, custom durations
    settings.js       — reminders, app lock toggle, supabase sync config

src/
  db/
    database.js       — mood entries SQLite (getEntry, saveEntry, deleteEntry, getStreak, exportMonthAsText, getMoodFocusCorrelation, getEntriesForYear, getLastNDaysMoods)
    focusDatabase.js  — tasks + pomodoro_sessions (getTasks, createTask, toggleTask, saveSession, getTaskPomodoroCount, setTaskPomodoros, getFocusStats)
    habitDatabase.js  — habits + habit_completions (getHabits, createHabit, toggleCompletion, getHabitStreak, getHabitHistory, getCompletionRate)
  context/
    ThemeContext.js   — light/dark colors, ThemeProvider, useTheme() hook
  constants/
    theme.js          — static COLORS (light values for StyleSheet.create), MOODS array
  components/
    MoodFace.js       — blob circle with dot eyes + curved mouth, pure RN Views
    MoodPicker.js     — row of 5 mood faces with haptics, selected state
    MoodTrend.js      — 7-day bar chart using MOODS colors
    CorrelationInsight.js — mood × focus insight card
    PhotoGrid.js      — photo thumbnails with fullscreen viewer
    PhotoViewer.js    — fullscreen modal photo viewer
    AestheticBackground.js — decorative blobs (5 soft colored circles, ~10% opacity, positioned at screen edges)
  notifications.js    — scheduleReminder, cancelReminder, registerMoodCategory (quick-log actions), checkStreakMilestone
  lib/
    supabase.js       — optional cloud sync (user configures URL + anon key in settings)
```

## Theme system
**Always use `useTheme()` for dynamic colors inside components:**
```js
const C = useTheme(); // use C.background, C.text, C.card, C.border, C.textSecondary, C.danger, C.success
```
**For `StyleSheet.create()` (static):** import `{ COLORS } from '../constants/theme'` — these are light-mode values only, fine for layout/sizing styles.

Dark mode background: `#1A1714`, card: `#242018`, text: `#F0EBE1`
Light mode background: `#F0EBE1`, card: `#FAF6EF`, text: `#2D2820`

## Mood system
5 moods stored as integers 1–5:
```js
MOODS = [
  { value: 1, label: 'bad',   color: '#89B4D4' },
  { value: 2, label: 'low',   color: '#F4A56A' },
  { value: 3, label: 'okay',  color: '#C5A8E8' },
  { value: 4, label: 'good',  color: '#F9C74F' },
  { value: 5, label: 'great', color: '#6CC97C' },
]
```

## Key patterns
- **Navigation:** `router.push('/entry', { params: { date } })` — entry screen works for any date
- **Stale closure fix for PanResponder:** use `ref.current` pattern (see changeMonthRef in mood.js)
- **Background timer:** AppState listener stores timestamp when backgrounded, calculates elapsed on return
- **Progress ring:** Two half-circle clip technique in focus.js ProgressRing component (no SVG, no reanimated)
- **AestheticBackground:** Add `<AestheticBackground />` as first child of ScrollView on any new screen

## App lock
`AsyncStorage` key `'app_lock_enabled'` = `'true'/'false'`. Lock triggers after 5min in background if biometrics enrolled. Toggle in Settings. Lock screen is `app/lock.js`.

## Notifications
- Daily reminder fires with 5 quick-action buttons (great/good/okay/low/bad) — tapping saves mood without opening app
- Streak milestones fire at 3, 7, 14, 30, 50, 100, 365 days
- `AsyncStorage` key `'last_milestone'` prevents duplicate celebrations

## EAS config
- Package: `com.iiciel.moodjournal`
- Project ID: `cf88895e-3ce4-4edb-930b-0f8637e1d522`
- `preview` profile → standalone APK, internal distribution
- `development` profile → Dev Client APK, internal distribution

## What's intentionally NOT here
- No react-native-reanimated (removed, causes build failures)
- No Google Tasks sync (deferred — user decided not worth it yet)
- No iOS build yet (Android only for now)
- Supabase sync is optional and user-configured, not required for the app to work
