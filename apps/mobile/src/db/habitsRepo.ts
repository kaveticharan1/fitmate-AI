import { sleepMinutes } from '@fitmate/core';
import { and, asc, eq, gte, isNull } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import { localDate, nowIso } from '../lib/time';
import { getDb } from './client';
import { habitDefinitions, habitLogs, sleepLogs } from './schema';

export function sleepHistory(sinceDate: string) {
  return getDb()
    .select()
    .from(sleepLogs)
    .where(and(isNull(sleepLogs.deletedAt), gte(sleepLogs.wokeOn, sinceDate)))
    .orderBy(asc(sleepLogs.wokeOn))
    .all();
}

/** Saves last night's sleep for the morning `wokeOn`; logging again the same morning replaces it. */
export function logSleep(bedTime: string, wakeTime: string, wokeOn: string = localDate()): void {
  const minutes = sleepMinutes(bedTime, wakeTime);
  if (minutes == null) throw new RangeError('Invalid sleep times');
  const now = nowIso();
  getDb()
    .insert(sleepLogs)
    .values({ id: randomUUID(), wokeOn, bedTime, wakeTime, minutes, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: sleepLogs.wokeOn, set: { bedTime, wakeTime, minutes, updatedAt: now, deletedAt: null } })
    .run();
}

export interface HabitWithDays {
  id: string;
  name: string;
  doneDates: string[];
}

export function listHabits(sinceDate: string): HabitWithDays[] {
  const db = getDb();
  const defs = db.select().from(habitDefinitions).where(isNull(habitDefinitions.deletedAt)).orderBy(asc(habitDefinitions.createdAt)).all();
  const logs = db.select().from(habitLogs).where(gte(habitLogs.doneOn, sinceDate)).all();
  return defs.map((d) => ({ id: d.id, name: d.name, doneDates: logs.filter((l) => l.habitId === d.id).map((l) => l.doneOn) }));
}

export function addHabit(name: string): void {
  const now = nowIso();
  getDb().insert(habitDefinitions).values({ id: randomUUID(), name: name.trim(), createdAt: now, updatedAt: now }).run();
}

export function deleteHabit(id: string): void {
  const now = nowIso();
  getDb().update(habitDefinitions).set({ deletedAt: now, updatedAt: now }).where(eq(habitDefinitions.id, id)).run();
}

/** Ticks or unticks a habit for a day. */
export function setHabitDone(habitId: string, done: boolean, day: string = localDate()): void {
  const db = getDb();
  if (done) {
    db.insert(habitLogs).values({ id: randomUUID(), habitId, doneOn: day, createdAt: nowIso() }).onConflictDoNothing().run();
  } else {
    db.delete(habitLogs).where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.doneOn, day))).run();
  }
}
