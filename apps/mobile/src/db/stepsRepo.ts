import type { StepFlag } from '@fitmate/core';
import { and, asc, eq, gte, isNull, ne } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import { nowIso } from '../lib/time';
import { getDb } from './client';
import { sleepLogs, stepDays, weightLogs } from './schema';

export interface StepDay {
  day: string;
  steps: number;
  source: 'health_connect' | 'manual';
  flags: StepFlag[];
}

const parseFlags = (raw: string): StepFlag[] => {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as StepFlag[]) : [];
  } catch {
    return [];
  }
};

export function stepHistory(sinceDay: string): StepDay[] {
  return getDb()
    .select()
    .from(stepDays)
    .where(gte(stepDays.day, sinceDay))
    .orderBy(asc(stepDays.day))
    .all()
    .map((r) => ({ day: r.day, steps: r.steps, source: r.source, flags: parseFlags(r.flags) }));
}

/** Saves synced days. Days the user typed in themselves are left alone. */
export function saveSyncedSteps(days: { day: string; steps: number; flags?: StepFlag[] }[]): number {
  const db = getDb();
  const now = nowIso();
  let changed = 0;
  db.transaction((tx) => {
    for (const d of days) {
      const flags = JSON.stringify(d.flags ?? []);
      const res = tx
        .insert(stepDays)
        .values({ day: d.day, steps: d.steps, source: 'health_connect', flags, createdAt: now, updatedAt: now })
        .onConflictDoUpdate({ target: stepDays.day, set: { steps: d.steps, flags, updatedAt: now }, setWhere: ne(stepDays.source, 'manual') })
        .run();
      changed += res.changes;
    }
  });
  return changed;
}

/** A typed-in total for a day; replaces whatever was there. */
export function setManualSteps(day: string, steps: number): void {
  const now = nowIso();
  getDb()
    .insert(stepDays)
    .values({ day, steps, source: 'manual', flags: '[]', createdAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: stepDays.day, set: { steps, source: 'manual', flags: '[]', updatedAt: now } })
    .run();
}

/** Removes a typed-in day so the next sync can fill it from Health Connect. */
export function clearManualSteps(day: string): void {
  getDb()
    .delete(stepDays)
    .where(and(eq(stepDays.day, day), eq(stepDays.source, 'manual')))
    .run();
}

export function hasWeightOn(day: string): boolean {
  return (
    getDb()
      .select({ id: weightLogs.id })
      .from(weightLogs)
      .where(and(eq(weightLogs.measuredOn, day), isNull(weightLogs.deletedAt)))
      .get() != null
  );
}

/** Adds a night's sleep only if that morning has nothing yet (never overwrites what the user logged). */
export function addSleepIfMissing(wokeOn: string, bedTime: string, wakeTime: string, minutes: number): boolean {
  const now = nowIso();
  const res = getDb()
    .insert(sleepLogs)
    .values({ id: randomUUID(), wokeOn, bedTime, wakeTime, minutes, createdAt: now, updatedAt: now })
    .onConflictDoNothing({ target: sleepLogs.wokeOn })
    .run();
  return res.changes > 0;
}
