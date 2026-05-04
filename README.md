# Daily Mood

Daily Mood is an offline-first personal dashboard built with React Native and Expo. It combines mood journaling, habits, focus sessions, planning, notes, goals, sleep, calories, and weight tracking in one private daily workspace.

## Features

- **Today Hub** - A daily overview with mood, habits, focus, tasks, health logs, planner, insights, and weekly review shortcuts.
- **Mood Journal** - Log a mood, notes, tags, gratitude, and local photos for each day.
- **Habits** - Track daily habits, streaks, monthly completion, and historical check-ins.
- **Focus Timer** - Run focus/break sessions, attach sessions to tasks, and review focus stats.
- **Planner and Tasks** - Plan priorities, manage projects/lists, use a kanban task board, and add evening reflection.
- **Health Logs** - Track sleep, calories, macros, saved meals, and weight.
- **Insights** - Review mood, habit, focus, calorie, sleep, and weight trends.
- **Backup and Export** - Export a JSON backup, restore from a copied backup, or export CSV files on Android.
- **Privacy First** - Local SQLite storage by default, optional user-provided Supabase sync for mood entries.

## Getting Started

```bash
npm install
npm start
```

Scan the QR code with Expo Go, or press `a` for Android, `i` for iOS, or `w` for web.

## Verification

```bash
npm run verify
```

This checks Expo dependency versions, fails on high-severity production audit findings, runs Expo Doctor, and verifies the web export.

Individual checks:

```bash
npm run check:deps
npm run audit:prod
npm run doctor
npm run export:web
```

## Cloud Sync Setup

Cloud sync is optional and currently covers mood entries. Create a Supabase project and run:

```sql
CREATE TABLE entries (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  mood INTEGER NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Then copy your Project URL and anon key into the app's Settings screen.

## Data Notes

- App data is stored locally in SQLite and AsyncStorage unless you enable mood sync.
- Photos are copied into app-owned local storage before being attached to journal entries.
- JSON backups include entry data and photo metadata, but not embedded photo files.
- Biometric app lock protects access to the app UI; it does not encrypt the local database.

## Tech Stack

- Expo SDK 54 + Expo Router
- React Native 0.81 + React 19
- expo-sqlite for local database storage
- expo-image-picker and expo-file-system for local photo attachments
- Supabase for optional mood sync
