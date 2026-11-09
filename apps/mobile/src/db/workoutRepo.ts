import { and, desc, gte, isNull } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import { localDate, nowIso } from '../lib/time';
import { getDb } from './client';
import { workoutSessions } from './schema';

export interface FinishedWorkout {
  workoutId: string;
  startedAt: number;
  finishedAt: number;
  completedSets: number;
  totalSets: number;
  estKcal: number;
  exerciseIds: string[];
}

export function saveWorkoutSession(w: FinishedWorkout): void {
  const now = nowIso();
  getDb()
    .insert(workoutSessions)
    .values({
      id: randomUUID(),
      workoutId: w.workoutId,
      doneOn: localDate(new Date(w.startedAt)),
      startedAt: new Date(w.startedAt).toISOString(),
      durationS: Math.max(0, Math.round((w.finishedAt - w.startedAt) / 1000)),
      completedSets: w.completedSets,
      totalSets: w.totalSets,
      estKcal: Math.max(0, Math.round(w.estKcal)),
      exercises: JSON.stringify(w.exerciseIds),
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

export function workoutHistory(sinceDate: string) {
  return getDb()
    .select()
    .from(workoutSessions)
    .where(and(isNull(workoutSessions.deletedAt), gte(workoutSessions.doneOn, sinceDate)))
    .orderBy(desc(workoutSessions.startedAt))
    .all();
}
