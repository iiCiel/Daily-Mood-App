# Mood Journal

A daily mood journaling app built with React Native and Expo. Track your mood, write about your day, and attach photos.

## Features

- **Daily Mood Tracking** - Pick from 5 emoji-based moods each day
- **Journal Notes** - Write about what happened
- **Photo Attachments** - Add photos from your gallery or camera
- **Calendar View** - See your mood history at a glance
- **Cloud Sync** - Optional Supabase sync across devices
- **Offline First** - Everything works locally with SQLite

## Getting Started

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go on your phone, or press `a` for Android / `i` for iOS simulator.

## Cloud Sync Setup (Optional)

1. Create a free project at [supabase.com](https://supabase.com)
2. Run this SQL in the Supabase SQL editor:

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

3. Go to Settings > API in your Supabase dashboard
4. Copy the Project URL and anon key
5. Enter them in the app's Settings screen

## Tech Stack

- Expo SDK 54 + Expo Router
- expo-sqlite (local database)
- expo-image-picker (photos)
- Supabase (optional cloud sync)
