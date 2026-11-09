import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import { Platform } from 'react-native';
import { buildSchedule, type ReminderConfig } from './schedule';

const CHANNEL = 'reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Water and medicine reminders',
      importance: AndroidImportance.HIGH,
      // Text is hidden on the lock screen; only "FitMate" shows until the phone is unlocked.
      lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/** Replaces all scheduled reminders with the ones in `config`. Returns how many were scheduled. */
export async function applyReminders(config: ReminderConfig, text: { water: string; medicine: (name: string) => string; title: string }): Promise<number> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const list = buildSchedule(config);
  if (list.length === 0) return 0;
  if (!(await ensurePermission())) throw new Error('permission');
  for (const n of list) {
    await Notifications.scheduleNotificationAsync({
      identifier: n.id,
      content: { title: text.title, body: n.kind === 'water' ? text.water : text.medicine(n.label ?? '') },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: n.hour, minute: n.minute, channelId: CHANNEL },
    });
  }
  return list.length;
}
