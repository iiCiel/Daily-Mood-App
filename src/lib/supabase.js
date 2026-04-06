import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

let supabase = null;

export function initSupabase(url, anonKey) {
  if (!url || !anonKey) return null;
  supabase = createClient(url, anonKey, {
    auth: {
      storage: {
        getItem: (key) => {
          try {
            return AsyncStorage.getItem(key);
          } catch {
            return null;
          }
        },
        setItem: (key, value) => {
          try {
            return AsyncStorage.setItem(key, value);
          } catch {}
        },
        removeItem: (key) => {
          try {
            return AsyncStorage.removeItem(key);
          } catch {}
        },
      },
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return supabase;
}

export function getSupabase() {
  return supabase;
}

export async function syncEntries(getUnsyncedFn, markSyncedFn) {
  if (!supabase) return { success: false, error: 'Supabase not configured' };

  try {
    const unsynced = await getUnsyncedFn();

    for (const entry of unsynced) {
      const { error } = await supabase.from('entries').upsert({
        id: entry.id,
        date: entry.date,
        mood: entry.mood,
        note: entry.note,
        created_at: entry.created_at,
        updated_at: entry.updated_at,
      });

      if (!error) {
        await markSyncedFn(entry.id);
      }
    }

    return { success: true, synced: unsynced.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
