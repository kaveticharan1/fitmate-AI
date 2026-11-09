import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import { Platform } from 'react-native';
import { buildSchedule, type ReminderConfig } from './schedule';
import type { SmartNudge } from './smart';

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
/** Cancels scheduled notifications whose id matches (keeps the others). */
async function cancelWhere(match: (id: string) => boolean) {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of all) if (match(n.identifier)) await Notifications.cancelScheduledNotificationAsync(n.identifier);
}

const isSmart = (id: string) => id.startsWith('smart-');

export async function applyReminders(config: ReminderConfig, text: { water: string; medicine: (name: string) => string; title: string }): Promise<number> {
  await cancelWhere((id) => !isSmart(id));
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

/**
 * Replaces the smart reminders. With `askPermission: false` (automatic refresh)
 * nothing is scheduled unless notifications are already allowed.
 */
export async function applySmart(
  nudges: SmartNudge[],
  text: (n: SmartNudge) => { title: string; body: string },
  opts: { askPermission: boolean },
): Promise<number> {
  await cancelWhere(isSmart);
  if (nudges.length === 0) return 0;
  const allowed = opts.askPermission ? await ensurePermission() : (await Notifications.getPermissionsAsync()).granted;
  if (!allowed) {
    if (opts.askPermission) throw new Error('permission');
    return 0;
  }
  for (const n of nudges) {
    const trigger =
      'date' in n.when
        ? { type: Notifications.SchedulableTriggerInputTypes.DATE, date: n.when.date, channelId: CHANNEL }
        : 'daily' in n.when
          ? { type: Notifications.SchedulableTriggerInputTypes.DAILY, ...n.when.daily, channelId: CHANNEL }
          : { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, ...n.when.weekly, channelId: CHANNEL };
    await Notifications.scheduleNotificationAsync({ identifier: n.id, content: text(n), trigger: trigger as Notifications.NotificationTriggerInput });
  }
  return nudges.length;
}
