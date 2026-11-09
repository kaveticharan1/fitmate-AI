import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import { Platform } from 'react-native';
import { buildSchedule, type ReminderConfig } from './schedule';
import type { SmartNudge } from './smart';

export const CHANNEL = 'reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export const CATEGORY = 'fitmate';
export const SNOOZE_MINUTES = 30;

/** Adds the "Snooze 30 min" button to FitMate notifications. */
export async function setupCategories(snoozeLabel: string) {
  try {
    await Notifications.setNotificationCategoryAsync(CATEGORY, [
      { identifier: 'snooze', buttonTitle: snoozeLabel, options: { opensAppToForeground: false } },
    ]);
  } catch {
    /* not supported: notifications still work without the button */
  }
}

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

export async function applyReminders(
  config: ReminderConfig,
  text: { water: string; medicine: (name: string) => string; custom?: (label: string) => string; title: string },
): Promise<number> {
  await cancelWhere((id) => !isSmart(id) && !id.startsWith('snooze-'));
  // Water reminders are smart (they stop once you reach your target), so they're scheduled with the smart ones.
  const list = buildSchedule(config).filter((n) => n.kind !== 'water');
  if (list.length === 0) return 0;
  if (!(await ensurePermission())) throw new Error('permission');
  for (const n of list) {
    await Notifications.scheduleNotificationAsync({
      identifier: n.id,
      content: {
        categoryIdentifier: CATEGORY,
        data: { kind: n.kind },
        title: text.title,
        body: n.kind === 'water' ? text.water : n.kind === 'custom' ? (text.custom ?? text.medicine)(n.label ?? '') : text.medicine(n.label ?? ''),
      },
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
    await Notifications.scheduleNotificationAsync({
      identifier: n.id,
      content: { ...text(n), categoryIdentifier: CATEGORY, data: { kind: n.kind } },
      trigger: trigger as Notifications.NotificationTriggerInput,
    });
  }
  return nudges.length;
}

/** Shows the same notification again in 30 minutes. */
export async function snooze(content: { title?: string | null; body?: string | null; data?: Record<string, unknown> }, now = Date.now()) {
  await Notifications.scheduleNotificationAsync({
    identifier: `snooze-${now}`,
    content: { title: content.title ?? 'FitMate', body: content.body ?? '', categoryIdentifier: CATEGORY, data: { ...(content.data ?? {}), snoozed: true } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(now + SNOOZE_MINUTES * 60000), channelId: CHANNEL } as Notifications.NotificationTriggerInput,
  });
}
