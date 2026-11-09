import { and, asc, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import { localDate, nowIso } from '../lib/time';
import { getDb } from './client';
import { PROFILE_ID } from './repositories';
import { bodyMeasurements, foodLogEntries, profile, waterLogs, weightLogs } from './schema';

export function weightHistory(sinceDate: string) {
  return getDb()
    .select({ date: weightLogs.measuredOn, value: weightLogs.weightKg })
    .from(weightLogs)
    .where(and(isNull(weightLogs.deletedAt), gte(weightLogs.measuredOn, sinceDate)))
    .orderBy(asc(weightLogs.measuredOn))
    .all();
}

export function waistHistory(sinceDate: string) {
  return getDb()
    .select({ date: bodyMeasurements.measuredOn, value: bodyMeasurements.waistCm })
    .from(bodyMeasurements)
    .where(and(isNull(bodyMeasurements.deletedAt), gte(bodyMeasurements.measuredOn, sinceDate)))
    .orderBy(asc(bodyMeasurements.measuredOn), asc(bodyMeasurements.createdAt))
    .all()
    .filter((r): r is { date: string; value: number } => r.value != null);
}

/** Logs today's waist; keeps the profile's latest value in step. */
export function logWaist(cm: number, day: string = localDate()): void {
  const now = nowIso();
  getDb().transaction((tx) => {
    tx.insert(bodyMeasurements).values({ id: randomUUID(), measuredOn: day, waistCm: cm, hipCm: null, createdAt: now, updatedAt: now }).run();
    tx.update(profile).set({ waistCm: cm, updatedAt: now }).where(eq(profile.id, PROFILE_ID)).run();
  });
}

/** Calories and protein per day, for days that have food logged. */
export function dailyFoodTotals(sinceDate: string) {
  return getDb()
    .select({
      date: foodLogEntries.loggedOn,
      kcal: sql<number>`sum(${foodLogEntries.kcal})`,
      protein: sql<number>`sum(${foodLogEntries.proteinG})`,
    })
    .from(foodLogEntries)
    .where(and(isNull(foodLogEntries.deletedAt), gte(foodLogEntries.loggedOn, sinceDate)))
    .groupBy(foodLogEntries.loggedOn)
    .all();
}

export function waterToday(day: string = localDate()): number {
  const row = getDb()
    .select({ ml: sql<number>`coalesce(sum(${waterLogs.ml}), 0)` })
    .from(waterLogs)
    .where(and(eq(waterLogs.loggedOn, day), isNull(waterLogs.deletedAt)))
    .get();
  return row?.ml ?? 0;
}

export function addWater(ml: number, day: string = localDate()): void {
  const now = nowIso();
  getDb().insert(waterLogs).values({ id: randomUUID(), loggedOn: day, ml, createdAt: now, updatedAt: now }).run();
}

/** Undoes the most recent water entry of the day. */
export function undoWater(day: string = localDate()): void {
  const last = getDb()
    .select()
    .from(waterLogs)
    .where(and(eq(waterLogs.loggedOn, day), isNull(waterLogs.deletedAt)))
    .orderBy(desc(waterLogs.createdAt))
    .get();
  if (!last) return;
  const now = nowIso();
  getDb().update(waterLogs).set({ deletedAt: now, updatedAt: now }).where(eq(waterLogs.id, last.id)).run();
}
