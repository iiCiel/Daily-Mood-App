import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

export async function cancelReminder() {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.removeItem(REMINDER_KEY);
}

export async function getSavedReminder() {
  const raw = await AsyncStorage.getItem(REMINDER_KEY);
  return raw ? JSON.parse(raw) : null;
}
