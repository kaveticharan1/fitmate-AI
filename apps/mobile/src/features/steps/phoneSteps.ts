import * as SecureStore from 'expo-secure-store';
import { PermissionsAndroid, Platform } from 'react-native';
import { FitmateSteps, type StepReading } from '../../../modules/fitmate-steps';
import { getSetting, setSetting } from '../../db/repositories';
import { saveStepHours, saveSyncedSteps } from '../../db/stepsRepo';
import { applyReading, EMPTY_LEDGER, localDay, type StepLedger } from './ledger';

/**
 * FitMate's own step counting, from this phone's step sensor. The ledger lives
 * in secure storage (not the PIN-locked database) so the background check can
 * update it while FitMate is closed; it's copied into the database when the
 * app is opened.
 */
const LEDGER_KEY = 'fm.steps.ledger.v1';
const ACTIVITY = 'android.permission.ACTIVITY_RECOGNITION';

export type StepSource = 'phone' | 'health_connect';

export const sensorAvailable = (): boolean => {
  try {
    return !!FitmateSteps?.isAvailable();
  } catch {
    return false;
  }
};

/** Phone counting is the default whenever the phone has a step sensor. */
export function getStepSource(): StepSource {
  return getSetting<StepSource | null>('stepSource', null) ?? (sensorAvailable() ? 'phone' : 'health_connect');
}
export const setStepSource = (s: StepSource) => setSetting('stepSource', s);

export async function hasActivityPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (Number(Platform.Version) < 29) return true; // Android 9 and older: no runtime permission
  try {
    return await PermissionsAndroid.check(ACTIVITY as never);
  } catch {
    return false;
  }
}

export async function requestActivityPermission(): Promise<boolean> {
  if (await hasActivityPermission()) return true;
  try {
    return (await PermissionsAndroid.request(ACTIVITY as never)) === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export async function loadLedger(): Promise<StepLedger> {
  try {
    const raw = await SecureStore.getItemAsync(LEDGER_KEY);
    if (!raw) return EMPTY_LEDGER;
    const v = JSON.parse(raw) as StepLedger;
    // Ledgers saved before v1.7 have no hourly counts yet.
    return v && typeof v.days === 'object' ? { ...EMPTY_LEDGER, ...v, hours: v.hours ?? {} } : EMPTY_LEDGER;
  } catch {
    return EMPTY_LEDGER;
  }
}

const saveLedger = (l: StepLedger) => SecureStore.setItemAsync(LEDGER_KEY, JSON.stringify(l)).catch(() => undefined);
export const clearLedger = () => SecureStore.deleteItemAsync(LEDGER_KEY).catch(() => undefined);

// Readings are applied one at a time so live updates and the background check never race.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

/**
 * Adds a reading (taken now if not given) to the ledger. Returns the ledger,
 * or null if the sensor or permission isn't available.
 */
export function recordReading(reading?: StepReading | null, at: number = Date.now()): Promise<StepLedger | null> {
  return serial(async () => {
    if (!FitmateSteps || !sensorAvailable() || !(await hasActivityPermission())) return null;
    const r = reading === undefined ? await FitmateSteps.readTotal(4000).catch(() => null) : reading;
    const ledger = await loadLedger();
    if (!r) return ledger;
    const next = applyReading(ledger, { total: r.total, bootMs: r.bootMs, at });
    await saveLedger(next);
    return next;
  });
}

/** Copies counted days and hours into the database (days you typed in yourself are kept). */
export function writeLedgerToDb(ledger: StepLedger): number {
  const days = Object.entries(ledger.days).map(([day, steps]) => ({ day, steps: Math.min(200000, Math.round(steps)) }));
  saveStepHours(ledger.hours ?? {});
  return days.length ? saveSyncedSteps(days, 'phone') : 0;
}

/** Takes a reading and saves today's count. Returns today's steps, or null if phone counting is off/unavailable. */
export async function syncPhoneSteps(now: Date = new Date()): Promise<number | null> {
  if (getStepSource() !== 'phone') return null;
  const ledger = await recordReading(undefined, now.getTime());
  if (!ledger) return null;
  writeLedgerToDb(ledger);
  return ledger.days[localDay(now.getTime())] ?? 0;
}
