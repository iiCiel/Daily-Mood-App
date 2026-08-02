# Mood Journal App — Claude Context

## What this app is
A personal all-in-one daily app built with React Native / Expo. Four tabs: mood journal, habit tracker, pomodoro focus timer, life hub (sleep, planner, goals, notes, weekly review). Local-first (SQLite), dark/light mode, Android only for now.

## Build workflow
The user has thought this through — do not suggest rebuilding after every change.

### Three ways to get code onto the phone

**1. Dev Client — for active development**
- Requires laptop on + phone on same wifi
- Phone runs the Dev Client APK (built once with `eas build --platform android --profile development`)
- Run `npx expo start`, scan QR in the Dev Client app on phone
- Code changes hot-reload in seconds, no rebuild needed
- Use this while actively coding new features

**2. Local build — fast standalone APK (set up 2026-07-29)**
- Local Android build environment is installed: JDK 17 Temurin + Android SDK (platform-tools, platform 36, build-tools 36, NDK 27.1.12297006) via Google's `android` CLI tool (`winget install Google.AndroidCLI`)
- `JAVA_HOME` and `ANDROID_HOME` are set as persistent user env vars
- `npm run build:apk` — runs `npx expo prebuild --platform android` (syncs native config from `app.json`/`eas.json`) then `gradlew assembleRelease` locally (~5 min, no EAS queue), copies the signed APK to `builds/daily-mood-latest.apk` (gitignored, local only, not committed). The prebuild step is baked into this script now specifically so app.json/eas.json edits can never silently go stale in a local build again.
- `npm run serve-apk` — serves `builds/` over local wifi (`npx serve`); phone downloads at `http://<laptop-lan-ip>:8080/daily-mood-latest.apk`
- Alternative install: `adb install builds/daily-mood-latest.apk` over USB
- Release build type is signed with the debug keystore (`android/app/debug.keystore`) — fine for personal use, not Play Store submission
- **Known gotchas — all bit us once already, first time this was set up:**
  - `android/local.properties` `sdk.dir` must use forward slashes (`C:/Users/...`). Backslashes get mangled by Java's `.properties` escape parsing and fail the build with a cryptic "filename, directory name, or volume label syntax is incorrect" error.
  - `android/gradle.properties` `org.gradle.jvmargs` needs `-XX:MaxMetaspaceSize` raised to at least `1536m` (default `512m` OOMs during `expo-updates`' Kotlin/KSP compile step). Currently set to `-Xmx4096m -XX:MaxMetaspaceSize=1536m`.
  - `android/` does not auto-sync with `app.json`/`eas.json` changes — editing them has zero effect on a local build until `expo prebuild` regenerates the native files. We hit this directly: adding `expo-updates` updated `app.json`/`eas.json` but the first local build silently shipped with updates disabled because prebuild was never re-run. Fixed by making `npm run build:apk` always run `expo prebuild --platform android` first (see below), so this can't happen again. Custom native code (the Android widget providers) is safe through prebuild — it's managed by the `./plugins/withAndroidWidgets` config plugin, not hand-edited.
  - `eas.json`'s per-profile `channel` field only gets embedded on a real `eas build`. A local `gradlew`/`expo prebuild` build doesn't go through eas-cli, so it never picks that up — the channel has to be set manually via `app.json`'s `updates.requestHeaders: {"expo-channel-name": "preview"}` instead. **Every local build currently reports itself as the `preview` channel**, regardless of `eas.json`. Publish OTA updates for it with `eas update --branch preview`.
  - **The EAS *channel* must exist server-side, and `eas update --branch X` does NOT create it.** `eas build` normally creates the channel as a side effect; local builds never do. Symptom: `eas update` publishes fine and `eas branch:list` shows the update, but the app never receives anything — because it asks by *channel* and `eas channel:list` is empty. Fix once with `eas channel:create preview` (links channel → same-named branch). Verify with `eas channel:view preview` — it must show Status `Active` with the branch pointed at it. This cost us a long debugging detour; check `channel:list` FIRST whenever an OTA update doesn't land.

**3. EAS cloud build — Preview/Production, only when needed**
- Works everywhere, no laptop needed at install time
- `eas build --platform android --profile preview`
- EAS free tier = ~2hr queue wait
- User installs via QR code from EAS dashboard
- Prefer the local build (option 2) unless you specifically want an EAS-hosted build or Play Store submission

### EAS Update — for JS-only changes, no rebuild at all (set up 2026-07-29)
- `expo-updates` is installed; `app.json` has `updates.url` + `runtimeVersion: {policy: "appVersion"}`; `eas.json` has a `channel` per build profile (`development`/`preview`/`production`) — that `eas.json` channel field only takes effect on real `eas build` (cloud or `--local`), NOT on a raw `gradlew`/`expo prebuild` build
- Because local builds go through plain `gradlew`, not `eas build`, the channel has to be embedded manually: `app.json`'s `updates.requestHeaders` is hardcoded to `{"expo-channel-name": "preview"}`. This means **every local build currently reports itself as the `preview` channel**, regardless of which `eas.json` profile you were thinking of. Publish updates for it with `eas update --branch preview`.
- Pure JS/UI change, no new native module or app.json native config change: `eas update --branch preview` pushes instantly, no rebuild, works over the internet — installed app fetches it on next launch
- Native changes (new native module, new permission, new config plugin, or any other `app.json`/`eas.json` change) just need `npm run build:apk` — it runs `expo prebuild` automatically now, so native config can't go stale
- The very first local build (2026-07-30) shipped with updates silently disabled because `prebuild` hadn't been re-run after adding `expo-updates` — that's why `build:apk` now always prebuilds first

### The honest constraints
- EAS cloud queue is still ~2hr on the free tier, but it's no longer the only option — local builds (option 2) are free, fast, and don't touch any EAS account/queue
- **Do not suggest a full rebuild after every small change** — use `eas update` for JS-only changes instead
- EAS free tier is 1 cloud build/month per account. Secondary account `lolaangelo` exists as overflow — less relevant now that local builds don't count against either account's limit

### Recommended workflow
1. Dev Client on home wifi while actively coding — instant hot reload, no build at all
2. Shipping a pure JS/UI change to the already-installed build: `eas update --branch preview` — no rebuild
3. Native code changed, or you want a fresh standalone APK: `npm run build:apk` (local, ~5 min) → `npm run serve-apk` or `adb install` to get it on the phone
4. Reserve EAS cloud builds (`eas build`) for when you specifically want an EAS-hosted build or Play Store submission

### Current state (as of last session, 2026-07-31)
- Active branch: `gift-for-her-codex`
- Recent work: workout tracker (routines/sessions/sets/history/stats, exercise catalog + demo photos), verified + automatic backups, fixed `GiftPhotoFrame` not persisting photos, expanded habit icons 12 → 102, fixed the exercise-picker layout bug, local Android build pipeline + EAS Update OTA channel set up
- This branch's theme is the "storybook" warm/terracotta palette — see Theme system above, it is NOT the sage-green palette mentioned in older notes on other branches
- Old warm beige design is preserved in branch `design/classic-warm` (based on commit `3ac1dc5`) — a different "warm" than the current storybook palette, don't conflate the two
- Dev Client needs a rebuild if switching EAS accounts (project ID changed)
- Repo is **public** on GitHub (`iiCiel/Daily-Mood-App`) — `backups/` is gitignored except its own `.gitignore` specifically so real journal/backup data can never land in a public commit. Keep it that way; don't `git add -f` anything under `backups/`.

## Tech stack
- Expo SDK 54, Expo Router v6 (file-based routing)
- expo-sqlite for all local data
- expo-haptics, expo-notifications, expo-image-picker, expo-clipboard, expo-local-authentication, expo-dev-client
- expo-updates — OTA JS updates via EAS Update, see Build workflow
- No react-native-reanimated (removed — caused crashes in Expo Go / build issues). Use plain View animations only.
- `.npmrc` has `legacy-peer-deps=true`
- `babel.config.js` — only `babel-preset-expo`, no reanimated plugin

**`expo-file-system` MUST be imported from `expo-file-system/legacy`, not the bare `'expo-file-system'`.** In this SDK version (v19), the main entry only exports the new File/Directory class API — `documentDirectory`, `StorageAccessFramework`, `copyAsync`, `writeAsStringAsync`, `deleteAsync`, `makeDirectoryAsync` etc. are either `undefined` or throw at runtime from that entry. This silently broke photo persistence, CSV export, and file-based backups before it was caught (2026-07-30) — none of them errored loudly, they just no-opped or fell back wrong. Always `import * as FileSystem from 'expo-file-system/legacy';` for any of the classic API. Current usages: `src/lib/photoStorage.js`, `src/lib/autoBackup.js`, `app/(tabs)/settings.js`.

## File structure
```
app/
  _layout.js          — root layout, ThemeProvider, onboarding check, notification handler, app lock
  index.js            — just redirects to /(tabs)/mood
  entry.js            — mood entry create/edit for any date (mood, note, photos, tags, gratitude)
  onboarding.js       — 3-slide intro, sets AsyncStorage 'onboarding_done'
  year.js             — year in pixels screen
  focus-stats.js      — pomodoro heatmap + stats
  habit-detail.js     — habit history + 30-day dot grid
  lock.js             — biometric lock screen component
  insights.js         — mood/habit/focus/sleep analytics (avg, distribution, day-of-week, streaks)
  privacy.js          — privacy policy screen (required for Play Store)
  sleep.js            — sleep tracker (bedtime, wake time, quality, note, history)
  planner.js          — daily planner (morning intention, top 3 priorities, evening review)
  tasks.js            — task manager with Kanban board (todo/in-progress/done), lists, drag reorder; also used by tasks tab (isTab prop)
  projects.js         — projects tracker (create, color, status: active/on hold/done)
  project-detail.js   — tasks within a project
  notes.js            — freeform notes (create, edit, pin, search, delete)
  goals.js            — goals tracker (create, progress bar, categories, mark complete)
  calories.js         — calorie tracker (log food entries, daily goal, history)
  saved-meals.js      — saved meal presets for quick calorie logging
  macro-calculator.js — macro calculator (protein/carbs/fat targets)
  weight.js           — weight tracker (log entries, trend chart)
  weekly-review.js    — auto-generated weekly summary (mood, habits, focus, sleep) with share
  workout.js          — workout home: routines list, active-session resume, history, stats
  workout-routine.js  — routine editor (name, exercises, target sets/reps/weight) + exports ExercisePicker (shared with workout-session.js)
  workout-session.js  — active workout: sets, weight/reps input, previous-performance snapshot, rest timer
  (tabs)/
    _layout.js        — custom tab bar: Today (◆), Tasks (✓), Focus (◎), Habits (✦), Journal (◉)
    life.js           — Today hub: mood quick-log, planner, habits, focus summary, calorie/weight widgets
    tasks.js          — thin wrapper around app/tasks.js with isTab=true
    focus.js          — pomodoro timer, tasks, custom durations, breathing exercises
    habits.js         — daily habit check-in, add/edit habits, calendar with day-editing
    mood.js           — calendar home, streak, 7-day trend, correlation insight, search, insights button
    settings.js       — theme toggle, reminders, app lock, cloud sync, verified/automatic backups, CSV export, about

src/
  db/
    database.js       — DB singleton + schema migrations; mood entries (getEntry, saveEntry w/ gratitude, deleteEntry, getStreak, searchEntries, getMoodInsights, getEntriesForYear, getLastNDaysMoods)
    focusDatabase.js  — thin re-export layer for tasks (delegates to plannerDatabase) + pomodoro_sessions (saveSession, getFocusInsights)
    plannerDatabase.js — planner_entries, tasks (planning_tasks), task_lists, projects (getTaskLists, createTaskList, getPlanningTasks, createPlanningTask, togglePlanningTask, updateTaskStatus, getProjects, createProject, archiveProject, getPlanningSummary)
    habitDatabase.js  — habits + habit_completions (getHabits, createHabit, toggleCompletion, getHabitStreak, getHabitInsights)
    sleepDatabase.js  — sleep_entries (saveSleep, getSleepEntry, getRecentSleep, getSleepInsights, calcDuration)
    notesDatabase.js  — notes (getNotes, saveNote, deleteNote, togglePinNote, searchNotes)
    goalsDatabase.js  — goals (getGoals, createGoal, updateGoal, updateGoalProgress, toggleGoalComplete, deleteGoal)
    calorieDatabase.js — calorie_entries + calorie goal (getCalorieEntries, logCalorieEntry, getCalorieDaySummary, getCalorieGoal, setCalorieGoal)
    savedMealsDatabase.js — saved meal presets for calorie logging
    weightDatabase.js — weight_entries (logWeight, getWeightEntries, getLatestWeight)
    workoutDatabase.js — workout_routines, workout_sessions, workout_sets etc. (getRoutines, saveRoutine, startWorkout, getWorkout, addWorkoutSet, updateWorkoutSet, finishWorkout, discardWorkout, getWorkoutHistory, getWorkoutStats, getAllWorkoutData/importWorkoutData for backup)
    backupDatabase.js — full-app JSON backup: importBackup(backup) upserts every table (ON CONFLICT DO UPDATE, never INSERT OR REPLACE — see Backups section)
  context/
    ThemeContext.js   — light/dark colors, ThemeProvider, useTheme(), useSetTheme(), useThemePref()
  constants/
    theme.js          — static COLORS (light values for StyleSheet.create), MOODS array
    habitIcons.js     — HABIT_ICONS (102 Ionicons names), DEFAULT_HABIT_ICON
    exerciseCatalog.js — EXERCISE_CATALOG: merges CURATED_EXERCISES (40 hand-picked) with exerciseCatalog.public-domain.json (736 from free-exercise-db), attaches an `image` URL from exerciseImages.json where a match exists
    exerciseCatalog.public-domain.json — exercise name/muscle/equipment/category/level data, derived from free-exercise-db (see THIRD_PARTY_NOTICES.md)
    exerciseImages.json — exercise `id` -> demo photo URL (raw.githubusercontent.com/yuhonas/free-exercise-db); images are NOT bundled, loaded by URL at display time (749 of 778 exercises have a match)
  components/
    MoodFace.js       — blob circle with dot eyes + curved mouth, pure RN Views
    MoodPicker.js     — row of 5 mood faces with haptics, selected state
    MoodTrend.js      — 7-day bar chart using MOODS colors
    CorrelationInsight.js — mood × focus insight card
    PhotoGrid.js      — mood-entry photo thumbnails with fullscreen viewer; picks via expo-image-picker, persists via lib/photoStorage
    PhotoViewer.js    — fullscreen modal photo viewer
    AestheticBackground.js — decorative animated blobs; used in life.js and tasks.js
    StorybookHeroFade.js — gradient fade overlay used under hero images (workout.js, mood.js, habits.js)
    MindfulHeader.js  — simple screen header with optional right action button (title + onRightPress)
    TaskKanbanBoard.js — Kanban board for tasks (todo/in-progress/done columns)
    GiftPhotoFrame.js — personal-photo frame widget (Today/Journal/Habits screens). Requires a unique `id` prop — persists the picked photo to AsyncStorage keyed by that id via lib/photoStorage. **Never render one without an `id`**: it used to keep the photo only in React state, which meant it silently vanished on every app close (fixed 2026-07-31, but the failure mode returns if a new placement skips the id prop — it warns via console in dev but not in production).
    HabitIcon.js      — renders a habit's icon; falls back to rendering legacy emoji-string values as text (pre-icon-picker habits stored an emoji directly in this field) so old habits keep working
  notifications.js    — addReminder/removeReminder (multiple daily reminders), timer notifications, streak milestones
  lib/
    supabase.js       — optional cloud sync (user configures URL + anon key in settings)
    photoStorage.js   — persistPhotoAsync/deleteManagedPhotoAsync: copies picker/camera photos into documentDirectory so they survive app restarts (ImagePicker's own URIs are cache paths Android can wipe). Must import `expo-file-system/legacy` — see Tech stack gotcha below.
    autoBackup.js     — buildBackupPayload() (single source of truth for full-app backup contents), writeVerifiedBackup() (write, read back, re-parse, compare record counts before calling it a success), runAutoBackupIfDue() (one verified backup/day once a folder is chosen in Settings). See Backups section.

scripts/
  copy-apk.js         — copies android/app/build/outputs/apk/release/app-release.apk into builds/ as both a timestamped file and daily-mood-latest.apk; run via `npm run build:apk`
  serve-download.js   — tiny static file server with forced Content-Disposition: attachment (Chrome previews .json inline otherwise instead of downloading it). `node scripts/serve-download.js <dir> <port>`
  repair-backup.js    — best-effort JSON salvage for a truncated backup file/paste: `node scripts/repair-backup.js <file>`, recovers whatever records survived intact before the truncation point

backups/              — gitignored except backups/.gitignore itself (this repo is PUBLIC — real backup files must never be committed). Local scratch space for backup files during export/restore/repair; not part of the app bundle.
```

## Theme system
**Always use `useTheme()` for dynamic colors inside components:**
```js
const C = useTheme();
// C.background, C.card, C.panel, C.text, C.textSecondary, C.border, C.white,
// C.primary, C.primaryLight, C.accent, C.danger, C.success,
// C.mint, C.lavender, C.sand, C.blue, C.peach, C.yellow, C.teal, C.grape, C.inkSoft
```
**For `StyleSheet.create()` (static):** import `{ COLORS } from '../constants/theme'` — these are light-mode values only, fine for layout/sizing styles.

**Current palette — "storybook" (warm/terracotta), defined in `src/context/ThemeContext.js`:**
- Light mode: background `#F5F0E8`, card `#FFFDF7`, primary `#C96B3A`, accent `#8B4A20`, text `#2C1A0E`, textSecondary `#9A7B5A`
- Dark mode: background `#1C1108`, card `#271A0C`, primary `#D4844A`, accent `#E8A060`, text `#F5EDE0`, textSecondary `#A07B58`

This is a different palette from what earlier CLAUDE.md revisions described ("sage green") — the doc had drifted out of sync with the code. If you see a green palette mentioned anywhere else (old commit messages, a stale comment), the code in `ThemeContext.js` is the source of truth, not the doc.

**Card styling:** `elevation: 2` (no borderWidth/borderColor) is still common, but the storybook screens (`workout*.js`, `habits.js`, `mood.js`, `life.js`) mostly use `borderWidth: 1, borderColor: C.border` instead — both patterns exist side by side now; match whichever convention the screen you're editing already uses rather than "fixing" one to match the other.
**CTA buttons (Save/Add/Finish/primary actions):** use `C.accent`, not `C.primary` and not `C.text`. `C.primary` is for icons, avatars, and secondary accents — mixing the two up is an easy mistake (it happened in the first cut of the workout screens and had to be fixed).

Old warm beige design is preserved in branch `design/classic-warm` if needed — note that branch predates the current storybook palette above, they are not the same "warm" theme.

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
- **Decorative background:** `AestheticBackground` is used in `life.js` and `tasks.js`. It's fine to add to new full-page screens but not required.

## Backups (verified + automatic, set up 2026-07-31)
A truncated clipboard export previously reported "success" while actually losing most of the user's journal — Android's clipboard silently cuts off large payloads, and nothing checked the copy actually landed intact. That real incident is why this system exists.

- **Single payload builder**: `buildBackupPayload()` in `src/lib/autoBackup.js` is the one place that assembles a full-app backup (mood, sleep, calories, habits, weight, goals, notes, planner, focus sessions, tasks, projects, task lists, saved meals, workouts). Both manual export (Settings) and automatic daily backups call this — they cannot drift apart or silently miss a table again.
- **Every backup is verified before it's reported as successful**: `writeVerifiedBackup()` writes the file, then reads it back off disk, re-parses it, and compares record counts against what it meant to write. Only then does it report success. Manual clipboard copies get the equivalent check (`Clipboard.getStringAsync()` immediately after `setStringAsync()`, length-compared) — a truncated copy now says so explicitly instead of silently "succeeding."
- **Automatic daily backups**: once the user picks a folder (Settings → automatic backups), `runAutoBackupIfDue()` runs on every app launch (wired into `app/_layout.js`) and writes at most one verified backup per calendar day. Keeps the newest 14, prunes older ones. Folder access uses Android's Storage Access Framework with `takePersistableUriPermission`, so it survives app restarts without re-prompting.
- **Restore** (Settings → restore from backup) offers both "from file" (reads any `.json` in a picked SAF folder) and "from clipboard" — file is the reliable path for anything non-trivial in size.
- `importBackup()` in `src/db/backupDatabase.js` always upserts (`INSERT ... ON CONFLICT(id) DO UPDATE`), never `INSERT OR REPLACE` — the latter would cascade-delete child rows (e.g. a routine's exercises) whenever a restore's IDs collided with newer local data. This was a real bug caught and fixed before it shipped.
- Backups never include photos (file paths only, and even those are stripped on import) — see `photoStorage.js` gotcha above for why photos need to persist independently.
- If a restore ever fails with "does not contain valid JSON" again: check `scripts/repair-backup.js` first — it salvages whatever records survived before a truncation point, rather than losing the whole paste.

## App lock
`AsyncStorage` key `'app_lock_enabled'` = `'true'/'false'`. Lock triggers after 5min in background if biometrics enrolled. Toggle in Settings. Lock screen is `app/lock.js`.

## Notifications
- Daily reminder fires with 5 quick-action buttons (great/good/okay/low/bad) — tapping saves mood without opening app
- Multiple reminders supported via `reminders_v2` AsyncStorage key (array of `{ hour, minute, id }`)
- Timer notifications: immediate "ends at HH:MM" + scheduled completion notification via `SchedulableTriggerInputTypes.TIME_INTERVAL`
- Streak milestones fire at 3, 7, 14, 30, 50, 100, 365 days
- `AsyncStorage` key `'last_milestone'` prevents duplicate celebrations

## DB tables (all in mood_journal.db via shared getDatabase() singleton)
entries, photos, tasks, projects, task_lists, calendar_events, pomodoro_sessions,
habits, habit_completions, sleep_entries, notes, goals, planner_entries,
calorie_entries, weight_entries,
workout_routines, workout_routine_exercises, workout_sessions, workout_session_exercises, workout_sets

## Breathing patterns (focus tab)
- Box: 4-4-4-4 (inhale/hold/exhale/hold)
- 4-7-8: inhale 4, hold 7, exhale 8
- Calm: inhale 5, exhale 6
Uses setInterval state machine — no reanimated needed.

## EAS config
- Package: `com.iiciel.moodjournal`
- Primary account: `iiciel` — Project ID: `9cd610bd-40a4-4248-b3e2-2eb85e097440` (account: `lolaangelo`, used when iiciel hits monthly limit)
- `preview` profile → standalone APK, internal distribution
- `development` profile → Dev Client APK, internal distribution
- Free tier = 1 Android build/month per account. When one account's limit is hit, log out (`eas logout`), log in to the other, and build.

## What's intentionally NOT here
- No react-native-reanimated (removed, causes build failures)
- No Google Tasks sync (deferred — user decided not worth it yet)
- No iOS build yet (Android only for now)
- Supabase sync is optional and user-configured, not required for the app to work
