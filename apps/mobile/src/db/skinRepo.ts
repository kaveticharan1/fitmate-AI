import type { Concern, Routine, SkinType } from '@fitmate/skin';
import { and, asc, eq, gte } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import { nowIso } from '../lib/time';
import { getDb } from './client';
import { skinProfile, skincareDone, skincareSteps, type SkinProfileRow, type SkincareStepRow } from './schema';

export interface SkinProfileInput {
  skinType: SkinType;
  sensitive: boolean;
  concerns: Concern[];
  allergies: string | null;
  products: string | null;
  budget: 'low' | 'medium' | 'high';
  fragranceFree: boolean;
  experience: 'beginner' | 'some' | 'experienced';
  pregnant: boolean;
  goals: string | null;
  shareWithCoach: boolean;
}

export interface SkinProfile extends Omit<SkinProfileRow, 'concerns'> {
  concerns: Concern[];
}

const trimOrNull = (s: string | null, max = 300) => (s?.trim() ? s.trim().slice(0, max) : null);

export function getSkinProfile(): SkinProfile | null {
  const r = getDb().select().from(skinProfile).where(eq(skinProfile.id, 'me')).get();
  if (!r) return null;
  let concerns: Concern[] = [];
  try {
    const v = JSON.parse(r.concerns);
    concerns = Array.isArray(v) ? v : [];
  } catch {
    concerns = [];
  }
  return { ...r, concerns };
}

export function saveSkinProfile(p: SkinProfileInput): void {
  const now = nowIso();
  const values = {
    skinType: p.skinType,
    sensitive: p.sensitive,
    concerns: JSON.stringify(p.concerns),
    allergies: trimOrNull(p.allergies),
    products: trimOrNull(p.products, 500),
    budget: p.budget,
    fragranceFree: p.fragranceFree,
    experience: p.experience,
    pregnant: p.pregnant,
    goals: trimOrNull(p.goals),
    shareWithCoach: p.shareWithCoach,
    updatedAt: now,
  };
  getDb()
    .insert(skinProfile)
    .values({ id: 'me', createdAt: now, ...values })
    .onConflictDoUpdate({ target: skinProfile.id, set: values })
    .run();
}

export function deleteSkinData(): void {
  const db = getDb();
  db.transaction((tx) => {
    tx.delete(skinProfile).run();
    tx.delete(skincareSteps).run();
    tx.delete(skincareDone).run();
  });
}

export function listSteps(): SkincareStepRow[] {
  return getDb().select().from(skincareSteps).orderBy(asc(skincareSteps.slot), asc(skincareSteps.position)).all();
}

export interface StepInput {
  slot: 'am' | 'pm';
  step: string;
  product: string | null;
  ingredient: string | null;
  frequency: string;
}

/** Replaces the saved routine with these steps (in order per slot). */
export function saveRoutineSteps(steps: StepInput[]): void {
  const now = nowIso();
  const db = getDb();
  db.transaction((tx) => {
    tx.delete(skincareSteps).run();
    const pos = { am: 0, pm: 0 };
    for (const s of steps) {
      tx.insert(skincareSteps)
        .values({
          id: randomUUID(),
          slot: s.slot,
          position: pos[s.slot]++,
          step: s.step.trim().slice(0, 60) || 'Step',
          product: trimOrNull(s.product, 120),
          ingredient: s.ingredient,
          frequency: s.frequency.trim().slice(0, 80) || 'daily',
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
  });
}

/** Turns a generated routine into saved steps. */
export function routineToSteps(r: Routine): StepInput[] {
  return [
    ...r.am.map((s) => ({ slot: 'am' as const, step: s.kind, product: s.lookFor, ingredient: s.ingredient ?? null, frequency: s.frequency })),
    ...r.pm.map((s) => ({ slot: 'pm' as const, step: s.kind, product: s.lookFor, ingredient: s.ingredient ?? null, frequency: s.frequency })),
  ];
}

export function setRoutineDone(day: string, slot: 'am' | 'pm', done: boolean): void {
  const db = getDb();
  if (done) db.insert(skincareDone).values({ day, slot, createdAt: nowIso() }).onConflictDoNothing().run();
  else db.delete(skincareDone).where(and(eq(skincareDone.day, day), eq(skincareDone.slot, slot))).run();
}

export function routineDone(sinceDay: string): { day: string; slot: 'am' | 'pm' }[] {
  return getDb().select({ day: skincareDone.day, slot: skincareDone.slot }).from(skincareDone).where(gte(skincareDone.day, sinceDay)).all();
}
