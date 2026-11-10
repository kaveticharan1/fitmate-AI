import type { Profile } from '@fitmate/validation';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import { localDate, nowIso } from '../lib/time';
import { getDb } from './client';
import { appSettings, bodyMeasurements, consents, profile, weightLogs, type ProfileRow } from './schema';

/** The app holds a single local profile. */
export const PROFILE_ID = 'me';
export const PRIVACY_NOTICE_VERSION = '2026-11-09';

export function getProfile(): ProfileRow | null {
  return getDb().select().from(profile).where(eq(profile.id, PROFILE_ID)).get() ?? null;
}

/**
 * Saves the profile. When weight or waist changed, also records them in the
 * history tables so progress charts have data from day one.
 */
export function saveProfile(p: Profile): ProfileRow {
  const db = getDb();
  const now = nowIso();
  const existing = getProfile();
  const values = {
    name: p.name,
    dateOfBirth: p.dateOfBirth,
    sex: p.sex,
    heightCm: p.heightCm,
    weightKg: p.weightKg,
    targetWeightKg: p.targetWeightKg ?? null,
    waistCm: p.waistCm ?? null,
    hipCm: p.hipCm ?? null,
    goal: p.goal,
    activityLevel: p.activityLevel,
    occupation: p.occupation ?? null,
    sleepHours: p.sleepHours ?? null,
    workoutPreference: p.workoutPreference,
    equipment: p.equipment,
    coachPersonality: p.coachPersonality,
    dietType: p.dietType,
    allergies: p.allergies,
    dislikedFoods: p.dislikedFoods,
    cookingTime: p.cookingTime,
    budget: p.budget,
    isPregnantOrBreastfeeding: p.isPregnantOrBreastfeeding,
    hasEatingDisorderHistory: p.hasEatingDisorderHistory,
    hasMedicalCondition: p.hasMedicalCondition,
    healthNotes: p.healthNotes ?? null,
    injuries: p.injuries ?? null,
    aiLanguage: p.aiLanguage,
    updatedAt: now,
  };

  db.transaction((tx) => {
    if (existing) {
      tx.update(profile).set(values).where(eq(profile.id, PROFILE_ID)).run();
    } else {
      tx.insert(profile).values({ id: PROFILE_ID, createdAt: now, ...values }).run();
    }
    if (!existing || existing.weightKg !== p.weightKg) {
      upsertWeightForDay(tx, p.weightKg, localDate(), now);
    }
    const waistChanged = (p.waistCm ?? null) !== (existing?.waistCm ?? null);
    const hipChanged = (p.hipCm ?? null) !== (existing?.hipCm ?? null);
    if ((p.waistCm != null || p.hipCm != null) && (waistChanged || hipChanged)) {
      tx.insert(bodyMeasurements)
        .values({
          id: randomUUID(),
          measuredOn: localDate(),
          waistCm: p.waistCm ?? null,
          hipCm: p.hipCm ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
  });
  return getProfile()!;
}

type Tx = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];

/** One weigh-in per day: a second entry the same day replaces the first. */
function upsertWeightForDay(tx: Tx, weightKg: number, day: string, now: string) {
  const existing = tx
    .select()
    .from(weightLogs)
    .where(and(eq(weightLogs.measuredOn, day), isNull(weightLogs.deletedAt)))
    .get();
  if (existing) {
    tx.update(weightLogs).set({ weightKg, updatedAt: now }).where(eq(weightLogs.id, existing.id)).run();
  } else {
    tx.insert(weightLogs)
      .values({ id: randomUUID(), measuredOn: day, weightKg, createdAt: now, updatedAt: now })
      .run();
  }
}

/** Logs today's weight and keeps the profile's current weight in step. */
export function logWeight(weightKg: number, day: string = localDate()): void {
  const db = getDb();
  const now = nowIso();
  db.transaction((tx) => {
    upsertWeightForDay(tx, weightKg, day, now);
    if (day === localDate()) {
      tx.update(profile).set({ weightKg, updatedAt: now }).where(eq(profile.id, PROFILE_ID)).run();
    }
  });
}

export function recentWeights(limit = 30) {
  return getDb()
    .select()
    .from(weightLogs)
    .where(isNull(weightLogs.deletedAt))
    .orderBy(desc(weightLogs.measuredOn))
    .limit(limit)
    .all();
}

export type ConsentKind = 'privacy_notice' | 'age_18_plus' | 'ai_coach' | 'face_ai' | 'buddies';

export function recordConsent(kind: ConsentKind): void {
  const now = nowIso();
  getDb()
    .insert(consents)
    .values({ id: randomUUID(), kind, noticeVersion: PRIVACY_NOTICE_VERSION, grantedAt: now, createdAt: now, updatedAt: now })
    .run();
}

export function hasConsent(kind: ConsentKind): boolean {
  return (
    getDb()
      .select()
      .from(consents)
      .where(and(eq(consents.kind, kind), isNull(consents.withdrawnAt)))
      .get() != null
  );
}

export function withdrawConsent(kind: ConsentKind): void {
  const now = nowIso();
  getDb()
    .update(consents)
    .set({ withdrawnAt: now, updatedAt: now })
    .where(and(eq(consents.kind, kind), isNull(consents.withdrawnAt)))
    .run();
}

export function hasActiveConsent(): boolean {
  const row = getDb()
    .select()
    .from(consents)
    .where(and(eq(consents.kind, 'privacy_notice'), isNull(consents.withdrawnAt)))
    .get();
  return row != null;
}

export function getSetting<T>(key: string, fallback: T): T {
  const row = getDb().select().from(appSettings).where(eq(appSettings.key, key)).get();
  return row ? (row.value as T) : fallback;
}

export function setSetting(key: string, value: unknown): void {
  const now = nowIso();
  getDb()
    .insert(appSettings)
    .values({ key, value, updatedAt: now })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: now } })
    .run();
}
