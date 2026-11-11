import type { StepFlag } from '@fitmate/core';
import { and, asc, eq, gte, isNull, ne } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import { nowIso } from '../lib/time';
import { getDb } from './client';
import { sleepLogs, stepDays, stepHours, weightLogs } from './schema';

export interface StepDay {
  day: string;
  steps: number;
  source: 'health_connect' | 'manual' | 'phone';
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

/** Saves counted or synced days. Days the user typed in themselves are left alone. */
export function saveSyncedSteps(days: { day: string; steps: number; flags?: StepFlag[] }[], source: 'health_connect' | 'phone' = 'health_connect'): number {
  const db = getDb();
  const now = nowIso();
  let changed = 0;
  db.transaction((tx) => {
    for (const d of days) {
      const flags = JSON.stringify(d.flags ?? []);
      const res = tx
        .insert(stepDays)
        .values({ day: d.day, steps: d.steps, source, flags, createdAt: now, updatedAt: now })
        .onConflictDoUpdate({ target: stepDays.day, set: { steps: d.steps, source, flags, updatedAt: now }, setWhere: ne(stepDays.source, 'manual') })
        .run();
      changed += res.changes;
    }
  });
  return changed;
}

/** Saves hourly counts (hour = YYYY-MM-DDTHH). The phone's newest count for an hour replaces the old one. */
export function saveStepHours(hours: Record<string, number>): number {
  const entries = Object.entries(hours).filter(([h, n]) => /^\d{4}-\d{2}-\d{2}T\d{2}$/.test(h) && n >= 0);
  if (!entries.length) return 0;
  const now = nowIso();
  let changed = 0;
  getDb().transaction((tx) => {
    for (const [hour, n] of entries) {
      const steps = Math.min(50000, Math.round(n));
      changed += tx
        .insert(stepHours)
        .values({ hour, day: hour.slice(0, 10), steps, updatedAt: now })
        .onConflictDoUpdate({ target: stepHours.hour, set: { steps, updatedAt: now } })
        .run().changes;
    }
  });
  return changed;
}

/** 24 numbers: steps in each hour of `day` (0 = midnight–1 AM). */
export function stepHoursFor(day: string): number[] {
  const out = Array.from({ length: 24 }, () => 0);
  for (const r of getDb().select().from(stepHours).where(eq(stepHours.day, day)).all()) {
    const h = Number(r.hour.slice(11, 13));
    if (h >= 0 && h < 24) out[h] = r.steps;
  }
  return out;
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
