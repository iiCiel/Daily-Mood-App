import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const TIMER_NOTIF_KEY = 'timer_notif_ids';
const REMINDER_KEY = 'reminder_time';
const MILESTONE_KEY = 'last_milestone';
const REMINDERS_KEY = 'reminders_v2';
const HABIT_REMINDER_KEY = 'habit_reminder';
const MILESTONES = [3, 7, 14, 30, 50, 100, 365];
const CAN_USE_NOTIFICATIONS = Platform.OS !== 'web';

export const MOOD_CATEGORY = 'MOOD_QUICK_LOG';

function fmtEndTime(date) {
  let h = date.getHours();
  const m = date.getMinutes();
  const ap = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
}

if (CAN_USE_NOTIFICATIONS) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function registerMoodCategory() {
  if (!CAN_USE_NOTIFICATIONS || !Notifications.setNotificationCategoryAsync) return;
  await Notifications.setNotificationCategoryAsync(MOOD_CATEGORY, [
    { identifier: '5', buttonTitle: 'great' },
    { identifier: '4', buttonTitle: 'good' },
    { identifier: '3', buttonTitle: 'okay' },
    { identifier: '2', buttonTitle: 'low' },
    { identifier: '1', buttonTitle: 'bad' },
  ]);
}

export async function requestPermissions() {
  if (!CAN_USE_NOTIFICATIONS) return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleReminder(hour, minute) {
  if (!CAN_USE_NOTIFICATIONS) return false;
  await registerMoodCategory();
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'How are you feeling today?',
      body: 'Tap to log or pick a mood below.',
      categoryIdentifier: MOOD_CATEGORY,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
  await AsyncStorage.setItem(REMINDER_KEY, JSON.stringify({ hour, minute }));
  return true;
}

export async function checkStreakMilestone(streak) {
  if (!CAN_USE_NOTIFICATIONS || !MILESTONES.includes(streak)) return;
  const raw = await AsyncStorage.getItem(MILESTONE_KEY);
  const last = raw ? parseInt(raw, 10) : 0;
  if (streak <= last) return;
  await AsyncStorage.setItem(MILESTONE_KEY, String(streak));
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${streak} day streak`,
      body: streak >= 30
        ? `${streak} days in a row. You're unstoppable.`
        : streak >= 7
        ? 'A whole week of check-ins. Keep it going.'
        : `${streak} days in a row. Great start.`,
    },
    trigger: null,
  });
}

export async function showTimerNotification(secondsLeft, taskTitle) {
  if (!CAN_USE_NOTIFICATIONS) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    const { status: newStatus } = await Notifications.requestPermissionsAsync();
    if (newStatus !== 'granted') return;
  }
  await cancelTimerNotification();
  const endsAt = new Date(Date.now() + secondsLeft * 1000);
  const runId = await Notifications.scheduleNotificationAsync({
    content: {
      title: taskTitle ? `Focus - ${taskTitle}` : 'Focus timer',
      body: `Ends at ${fmtEndTime(endsAt)}`,
    },
    trigger: null,
  });
  const doneId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Session complete',
      body: taskTitle ? `"${taskTitle}" is done. Take a break.` : 'Nice work. Take a break.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, secondsLeft),
    },
  });
  await AsyncStorage.setItem(TIMER_NOTIF_KEY, JSON.stringify({ runId, doneId }));
}

export async function cancelTimerNotification() {
  if (!CAN_USE_NOTIFICATIONS) return;
  try {
    const raw = await AsyncStorage.getItem(TIMER_NOTIF_KEY);
    if (!raw) return;
    const { runId, doneId } = JSON.parse(raw);
    if (runId) {
      try { await Notifications.dismissNotificationAsync(runId); } catch {}
    }
    if (doneId) {
      try { await Notifications.cancelScheduledNotificationAsync(doneId); } catch {}
    }
    await AsyncStorage.removeItem(TIMER_NOTIF_KEY);
  } catch {}
}

export async function getReminders() {
  try {
    const raw = await AsyncStorage.getItem(REMINDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addReminder(hour, minute) {
  if (!CAN_USE_NOTIFICATIONS) return false;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    const { status: s } = await Notifications.requestPermissionsAsync();
    if (s !== 'granted') return false;
  }
  await registerMoodCategory();
  const reminders = await getReminders();
  if (reminders.find((r) => r.hour === hour && r.minute === minute)) return true;
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'How are you feeling today?',
      body: 'Tap to log or pick a mood below.',
      categoryIdentifier: MOOD_CATEGORY,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
  reminders.push({ hour, minute, id });
  await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
  return true;
}

export async function removeReminder(hour, minute) {
  if (!CAN_USE_NOTIFICATIONS) return;
  const reminders = await getReminders();
  const idx = reminders.findIndex((r) => r.hour === hour && r.minute === minute);
  if (idx === -1) return;
  try { await Notifications.cancelScheduledNotificationAsync(reminders[idx].id); } catch {}
  reminders.splice(idx, 1);
  await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
}

export async function getHabitReminder() {
  try {
    const raw = await AsyncStorage.getItem(HABIT_REMINDER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function addHabitReminder(hour, minute) {
  if (!CAN_USE_NOTIFICATIONS) return false;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    const { status: s } = await Notifications.requestPermissionsAsync();
    if (s !== 'granted') return false;
  }
  const existing = await getHabitReminder();
  if (existing?.id) {
    try { await Notifications.cancelScheduledNotificationAsync(existing.id); } catch {}
  }
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Habit check-in',
      body: 'How are your habits going today?',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
  await AsyncStorage.setItem(HABIT_REMINDER_KEY, JSON.stringify({ hour, minute, id }));
  return true;
}

export async function removeHabitReminder() {
  if (!CAN_USE_NOTIFICATIONS) return;
  const existing = await getHabitReminder();
  if (existing?.id) {
    try { await Notifications.cancelScheduledNotificationAsync(existing.id); } catch {}
  }
  await AsyncStorage.removeItem(HABIT_REMINDER_KEY);
}

export async function cancelReminder() {
  if (!CAN_USE_NOTIFICATIONS) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.removeItem(REMINDER_KEY);
}

export async function getSavedReminder() {
  const raw = await AsyncStorage.getItem(REMINDER_KEY);
  return raw ? JSON.parse(raw) : null;
}
