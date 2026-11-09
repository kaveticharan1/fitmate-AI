import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import * as TaskManager from 'expo-task-manager';
import * as HC from 'react-native-health-connect';
import i18n from '../../i18n';
import { localDate } from '../../lib/time';
import { CATEGORY, CHANNEL } from '../reminders/notifications';
import { decideCheckIn, type StepsSnapshot } from './stepsCheck';

/**
 * Background step check. Your phone (or watch / Google Fit) counts steps all
 * day in Health Connect. FitMate's own database stays locked behind your PIN,
 * so in the background we only read today's step total from Health Connect and
 * keep the evening check-in reminder accurate: it is cancelled once you're no
 * longer behind, or updated with the real number of steps left.
 */
export const STEPS_TASK = 'fitmate-steps-check';
const SNAP_KEY = 'fm.bg.steps.v1';
const BACKGROUND_PERMISSION = { accessType: 'read', recordType: 'BackgroundAccessPermission' } as const;

export async function saveStepsSnapshot(snap: StepsSnapshot | null) {
  try {
    if (snap) await SecureStore.setItemAsync(SNAP_KEY, JSON.stringify(snap));
    else await SecureStore.deleteItemAsync(SNAP_KEY);
  } catch {
    /* not critical */
  }
}

async function loadSnapshot(): Promise<StepsSnapshot | null> {
  try {
    const raw = await SecureStore.getItemAsync(SNAP_KEY);
    return raw ? (JSON.parse(raw) as StepsSnapshot) : null;
  } catch {
    return null;
  }
}

/** True if Health Connect lets FitMate read data while it's in the background. */
export async function hasBackgroundAccess(): Promise<boolean> {
  try {
    if ((await HC.getSdkStatus()) !== HC.SdkAvailabilityStatus.SDK_AVAILABLE) return false;
    await HC.initialize();
    const list = (await HC.getGrantedPermissions()) as { recordType?: string }[];
    return list.some((p) => p.recordType === 'BackgroundAccessPermission') && list.some((p) => p.recordType === 'Steps');
  } catch {
    return false;
  }
}

/** Shows Health Connect's screen for "access data in the background". */
export async function requestBackgroundAccess(): Promise<boolean> {
  try {
    await HC.initialize();
    const list = (await HC.requestPermission([BACKGROUND_PERMISSION])) as { recordType?: string }[];
    return list.some((p) => p.recordType === 'BackgroundAccessPermission');
  } catch {
    return false;
  }
}

/** One run of the check. Exported for tests. */
export async function runStepsCheck(now: Date = new Date()): Promise<'none' | 'cancel' | 'update' | 'skipped'> {
  const snap = await loadSnapshot();
  const today = localDate(now);
  if (!snap || snap.day !== today) return 'skipped';
  if (!(await hasBackgroundAccess())) return 'skipped';
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const res = await HC.aggregateRecord({
    recordType: 'Steps',
    timeRangeFilter: { operator: 'between', startTime: midnight.toISOString(), endTime: now.toISOString() },
  });
  const steps = (res as { COUNT_TOTAL?: number }).COUNT_TOTAL ?? 0;
  const d = decideCheckIn(snap, steps, now, today);
  if (d.action === 'cancel') {
    await Notifications.cancelScheduledNotificationAsync('smart-checkin');
    await saveStepsSnapshot({ ...snap, gaps: [] });
  } else if (d.action === 'update') {
    if (i18n.language !== snap.lang) await i18n.changeLanguage(snap.lang);
    await Notifications.scheduleNotificationAsync({
      identifier: 'smart-checkin',
      content: {
        title: i18n.t('smart.checkInTitle'),
        body: d.gaps.map((g) => i18n.t(`smart.gap.${g}`, d.params)).join(' '),
        categoryIdentifier: CATEGORY,
        data: { kind: 'checkIn' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(snap.checkInAt), channelId: CHANNEL } as Notifications.NotificationTriggerInput,
    });
    await saveStepsSnapshot({ ...snap, gaps: d.gaps, params: d.params });
  }
  return d.action;
}

// Must be defined when the JS bundle loads, so Android can run it with the app closed.
TaskManager.defineTask(STEPS_TASK, async () => {
  try {
    await runStepsCheck();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** Turns the background check on (about every 30 minutes, when Android allows) or off. */
export async function setStepsTask(on: boolean) {
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(STEPS_TASK);
    if (on && !registered) {
      if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return;
      await BackgroundTask.registerTaskAsync(STEPS_TASK, { minimumInterval: 30 });
    } else if (!on && registered) {
      await BackgroundTask.unregisterTaskAsync(STEPS_TASK);
    }
  } catch {
    /* background work not allowed on this phone; the app still syncs when opened */
  }
}
