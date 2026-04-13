import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TIMER_NOTIF_KEY = 'timer_notif_ids';

function fmtEndTime(date) {
  let h = date.getHours(), m = date.getMinutes();
  const ap = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
}

const REMINDER_KEY = 'reminder_time';
export const MOOD_CATEGORY = 'MOOD_QUICK_LOG';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function registerMoodCategory() {
  await Notifications.setNotificationCategoryAsync(MOOD_CATEGORY, [
    { identifier: '5', buttonTitle: '😄 great' },
    { identifier: '4', buttonTitle: '🙂 good' },
    { identifier: '3', buttonTitle: '😐 okay' },
    { identifier: '2', buttonTitle: '😔 low' },
    { identifier: '1', buttonTitle: '😞 bad' },
  ]);
}

export async function requestPermissions() {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleReminder(hour, minute) {
  await registerMoodCategory();
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'how are you feeling today?',
      body: 'tap to log or pick a mood below.',
      categoryIdentifier: MOOD_CATEGORY,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
  await AsyncStorage.setItem(REMINDER_KEY, JSON.stringify({ hour, minute }));
}

const MILESTONE_KEY = 'last_milestone';
const MILESTONES = [3, 7, 14, 30, 50, 100, 365];

export async function checkStreakMilestone(streak) {
  if (!MILESTONES.includes(streak)) return;
  const raw = await AsyncStorage.getItem(MILESTONE_KEY);
  const last = raw ? parseInt(raw) : 0;
  if (streak <= last) return; // already celebrated this milestone
  await AsyncStorage.setItem(MILESTONE_KEY, String(streak));
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${streak} day streak 🔥`,
      body: streak >= 30
        ? `${streak} days in a row. you're unstoppable.`
        : streak >= 7
        ? `a whole week of check-ins. keep it going!`
        : `${streak} days in a row — great start!`,
    },
    trigger: null, // immediate
  });
}

export async function showTimerNotification(secondsLeft, taskTitle) {
  // Ensure permissions are granted before trying to show anything
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    const { status: newStatus } = await Notifications.requestPermissionsAsync();
    if (newStatus !== 'granted') return;
  }
  await cancelTimerNotification();
  const endsAt = new Date(Date.now() + secondsLeft * 1000);
  // Immediate notification showing timer is running
  const runId = await Notifications.scheduleNotificationAsync({
    content: {
      title: taskTitle ? `focus · ${taskTitle}` : 'focus timer',
      body: `ends at ${fmtEndTime(endsAt)}`,
    },
    trigger: null,
  });
  // Scheduled notification that fires when timer completes
  const doneId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'session complete 🎉',
      body: taskTitle ? `"${taskTitle}" — great work! take a break.` : 'great work! take a break.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, secondsLeft),
    },
  });
  await AsyncStorage.setItem(TIMER_NOTIF_KEY, JSON.stringify({ runId, doneId }));
}

export async function cancelTimerNotification() {
  try {
    const raw = await AsyncStorage.getItem(TIMER_NOTIF_KEY);
    if (!raw) return;
    const { runId, doneId } = JSON.parse(raw);
    if (runId) try { await Notifications.dismissNotificationAsync(runId); } catch {}
    if (doneId) try { await Notifications.cancelScheduledNotificationAsync(doneId); } catch {}
    await AsyncStorage.removeItem(TIMER_NOTIF_KEY);
  } catch {}
}

const REMINDERS_KEY = 'reminders_v2';

export async function getReminders() {
  try {
    const raw = await AsyncStorage.getItem(REMINDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function addReminder(hour, minute) {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    const { status: s } = await Notifications.requestPermissionsAsync();
    if (s !== 'granted') return false;
  }
  await registerMoodCategory();
  const reminders = await getReminders();
  if (reminders.find(r => r.hour === hour && r.minute === minute)) return true;
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'how are you feeling today?',
      body: 'tap to log or pick a mood below.',
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
  const reminders = await getReminders();
  const idx = reminders.findIndex(r => r.hour === hour && r.minute === minute);
  if (idx === -1) return;
  try { await Notifications.cancelScheduledNotificationAsync(reminders[idx].id); } catch {}
  reminders.splice(idx, 1);
  await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
}

export async function cancelReminder() {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.removeItem(REMINDER_KEY);
}

export async function getSavedReminder() {
  const raw = await AsyncStorage.getItem(REMINDER_KEY);
  return raw ? JSON.parse(raw) : null;
}
