import { daysFromAggregate, validateStepRecords, type StepFlag } from '@fitmate/core';
import * as HC from 'react-native-health-connect';
import { getSetting, logWeight, setSetting } from '../../db/repositories';
import { addSleepIfMissing, hasWeightOn, saveSyncedSteps } from '../../db/stepsRepo';
import { addDays, localDate } from '../../lib/time';
import { getStepSource } from '../steps/phoneSteps';
import { saveStepsSnapshot, setStepsTask } from './background';

/**
 * Health Connect: Android's on-phone health data hub. We only READ steps,
 * weight and sleep; nothing is written and nothing leaves the phone.
 */
export const OWN_PACKAGE = 'com.kaveticharan.fitmate';
export const SYNC_DAYS = 30;
export const SYNC_THROTTLE_MS = 5 * 60 * 1000;

export type HealthAvailability = 'available' | 'update_required' | 'unavailable';

export const HEALTH_PERMISSIONS = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'Weight' },
  { accessType: 'read', recordType: 'SleepSession' },
] as const;

export interface HealthSettings {
  enabled: boolean;
  importWeight: boolean;
  importSleep: boolean;
  lastSync: string | null;
  stepGoal: number | null;
}

export function getHealthSettings(): HealthSettings {
  return {
    enabled: getSetting<boolean>('healthEnabled', false),
    importWeight: getSetting<boolean>('healthImportWeight', true),
    importSleep: getSetting<boolean>('healthImportSleep', true),
    lastSync: getSetting<string | null>('healthLastSync', null),
    stepGoal: getSetting<number | null>('stepGoal', null),
  };
}

export function setHealthSetting(key: 'healthEnabled' | 'healthImportWeight' | 'healthImportSleep' | 'stepGoal', value: unknown) {
  setSetting(key, value);
}

export async function healthAvailability(): Promise<HealthAvailability> {
  try {
    const s = await HC.getSdkStatus();
    if (s === HC.SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
    if (s === HC.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'update_required';
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}

type Granted = { steps: boolean; weight: boolean; sleep: boolean };

function grantedFrom(list: { accessType?: string; recordType?: string }[]): Granted {
  const has = (t: string) => list.some((p) => p.accessType === 'read' && p.recordType === t);
  return { steps: has('Steps'), weight: has('Weight'), sleep: has('SleepSession') };
}

/** Shows Health Connect's permission screen. Returns what was granted. */
export async function connectHealth(): Promise<Granted> {
  await HC.initialize();
  let list: { accessType?: string; recordType?: string }[];
  try {
    // Background access lets the evening reminder use live steps; older Health Connect may not know it.
    list = await HC.requestPermission([...HEALTH_PERMISSIONS, { accessType: 'read', recordType: 'BackgroundAccessPermission' }]);
  } catch {
    list = await HC.requestPermission([...HEALTH_PERMISSIONS]);
  }
  const granted = grantedFrom(list);
  if (granted.steps) setSetting('healthEnabled', true);
  return granted;
}

/** Stops syncing. (Health Connect itself is where access is fully removed.) */
export function disconnectHealth() {
  setSetting('healthEnabled', false);
  void saveStepsSnapshot(null);
  void setStepsTask(false);
}

export const openHealthSettings = () => HC.openHealthConnectSettings();

const localMidnight = (day: string) => {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 0, 0, 0, 0);
};
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export interface SyncResult {
  status: 'synced' | 'skipped' | 'disabled' | 'unavailable' | 'no_permission';
  days?: number;
  weights?: number;
  nights?: number;
  flags?: StepFlag[];
}

/** Reads the last 30 days from Health Connect into the app. Safe to call often (throttled). */
export async function syncHealth(opts: { force?: boolean; now?: Date } = {}): Promise<SyncResult> {
  const now = opts.now ?? new Date();
  const settings = getHealthSettings();
  if (!settings.enabled) return { status: 'disabled' };
  if (!opts.force && settings.lastSync && now.getTime() - Date.parse(settings.lastSync) < SYNC_THROTTLE_MS) return { status: 'skipped' };
  if ((await healthAvailability()) !== 'available') return { status: 'unavailable' };
  await HC.initialize();
  const granted = grantedFrom(await HC.getGrantedPermissions());
  // When FitMate counts steps itself, Health Connect is only used for weight and sleep.
  const phoneSteps = getStepSource() === 'phone';
  if (!granted.steps && !phoneSteps) return { status: 'no_permission' };

  const today = localDate(now);
  const from = localMidnight(addDays(today, -(SYNC_DAYS - 1)));
  const range = { operator: 'between' as const, startTime: from.toISOString(), endTime: now.toISOString() };

  // Daily totals: Health Connect merges phone and watch so steps aren't counted twice.
  const allFlags: StepFlag[] = [];
  let toSave: { day: string; steps: number; flags: StepFlag[] }[] = [];
  if (!phoneSteps) {
    const groups = await HC.aggregateGroupByPeriod({ recordType: 'Steps', timeRangeFilter: range, timeRangeSlicer: { period: 'DAYS', length: 1 } });
    const days = daysFromAggregate(groups as { startTime: string; result: { COUNT_TOTAL?: number } }[]);

    // Check the last two days' raw records for impossible data.
    const recentFrom = localMidnight(addDays(today, -1));
    const raw = await HC.readRecords('Steps', {
      timeRangeFilter: { operator: 'between', startTime: recentFrom.toISOString(), endTime: now.toISOString() },
      pageSize: 1000,
    });
    const byDay = new Map<string, { start: string; end: string; count: number; origin?: string }[]>();
    for (const r of raw.records) {
      const day = localDate(new Date(r.startTime));
      const list = byDay.get(day) ?? [];
      list.push({ start: r.startTime, end: r.endTime, count: r.count, origin: r.metadata?.dataOrigin });
      byDay.set(day, list);
    }
    toSave = days.map((d) => {
      const flags = d.date >= addDays(today, -1) ? validateStepRecords(byDay.get(d.date) ?? [], d.steps) : [];
      allFlags.push(...flags);
      return { day: d.date, steps: d.steps, flags };
    });
    saveSyncedSteps(toSave.filter((d) => d.steps > 0 || d.day === today));
  }

  let weights = 0;
  if (settings.importWeight && granted.weight) {
    const res = await HC.readRecords('Weight', { timeRangeFilter: range, pageSize: 500 });
    const latestPerDay = new Map<string, { time: string; kg: number }>();
    for (const r of res.records) {
      if (r.metadata?.dataOrigin === OWN_PACKAGE) continue;
      const kg = Math.round(r.weight.inKilograms * 10) / 10;
      if (!(kg >= 25 && kg <= 350)) continue;
      const day = localDate(new Date(r.time));
      const prev = latestPerDay.get(day);
      if (!prev || r.time > prev.time) latestPerDay.set(day, { time: r.time, kg });
    }
    for (const [day, w] of [...latestPerDay.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      if (!hasWeightOn(day)) {
        logWeight(w.kg, day);
        weights++;
      }
    }
  }

  let nights = 0;
  if (settings.importSleep && granted.sleep) {
    const res = await HC.readRecords('SleepSession', { timeRangeFilter: range, pageSize: 200 });
    for (const r of res.records) {
      const start = new Date(r.startTime);
      const end = new Date(r.endTime);
      const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
      if (minutes < 60 || minutes > 1439) continue; // naps and broken records are skipped
      if (addSleepIfMissing(localDate(end), hhmm(start), hhmm(end), minutes)) nights++;
    }
  }

  setSetting('healthLastSync', now.toISOString());
  return { status: 'synced', days: toSave.length, weights, nights, flags: allFlags };
}
