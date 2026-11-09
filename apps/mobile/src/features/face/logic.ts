/**
 * Face wellness logic: trends, safety escalation and lifestyle *associations*.
 * Self-reported puffiness is compared with data FitMate already has (sleep,
 * water, salty foods). Patterns are described as possible associations,
 * never as causes, and need enough days on both sides before anything is said.
 */

export const PUFFINESS = ['none', 'mild', 'moderate', 'significant'] as const;
export const AREAS = ['under_eyes', 'cheeks', 'jawline', 'whole_face', 'other'] as const;
export const TIMES = ['morning', 'afternoon', 'evening', 'all_day'] as const;
export const SYMPTOMS = ['itching', 'redness', 'pain', 'congestion', 'tenderness', 'lips_tongue_throat', 'breathing'] as const;
export type Symptom = (typeof SYMPTOMS)[number];

/** Foods in the database that are usually high in salt (packaged/fried snacks and restaurant dishes). */
export const SALTY_FOOD_IDS = ['samosa', 'mirchi_bajji', 'onion_pakoda', 'murukku', 'pizza', 'veg_noodles', 'veg_burger', 'chicken_biryani', 'veg_biryani', 'paneer_butter_masala', 'chole', 'aloo_paratha'];

export interface CheckinPoint {
  day: string;
  puffiness: number;
  symptoms: string[];
  saltyYesterday: number | null;
  alcoholYesterday: number | null;
}

export type Escalation = 'emergency' | 'doctor' | null;

/**
 * Emergency: lips/tongue/throat swelling or breathing trouble (possible severe allergic reaction).
 * Doctor: pain, or moderate-or-worse puffiness on 5 of the last 7 check-ins, or a sudden jump to significant.
 */
export function escalation(latest: CheckinPoint | null, recent: CheckinPoint[]): Escalation {
  if (!latest) return null;
  if (latest.symptoms.includes('lips_tongue_throat') || latest.symptoms.includes('breathing')) return 'emergency';
  if (latest.symptoms.includes('pain')) return 'doctor';
  const last7 = recent.slice(-7);
  if (last7.filter((c) => c.puffiness >= 2).length >= 5) return 'doctor';
  const before = recent.filter((c) => c.day < latest.day).slice(-3);
  if (latest.puffiness === 3 && before.length >= 3 && before.every((c) => c.puffiness <= 1)) return 'doctor';
  return null;
}

/** Average puffiness (0–3) over the given check-ins, or null if none. */
export function averagePuffiness(points: { puffiness: number }[]): number | null {
  if (!points.length) return null;
  return Math.round((points.reduce((s, p) => s + p.puffiness, 0) / points.length) * 10) / 10;
}

export interface DayLifestyle {
  /** Sleep that ended on this morning, in minutes; null if not logged. */
  sleepMin: number | null;
  /** Water logged the day before, ml; null if nothing logged (not zero). */
  waterPrevMl: number | null;
  /** Salty food the day before: user's answer first, else from the food diary; null if unknown. */
  saltyPrev: boolean | null;
}

export type Factor = 'short_sleep' | 'low_water' | 'salty_food' | 'alcohol';

export interface Association {
  factor: Factor;
  /** Average puffiness on days with / without the factor. */
  withAvg: number;
  withoutAvg: number;
  withDays: number;
  withoutDays: number;
}

export const MIN_DAYS_EACH = 3;
export const MIN_DIFFERENCE = 0.5;

/**
 * Possible associations between lifestyle and reported puffiness.
 * Only days where the factor is known take part (missing data is never treated as zero).
 */
export function findAssociations(checkins: CheckinPoint[], lifestyle: Map<string, DayLifestyle>, waterTargetMl: number): Association[] {
  const tests: { factor: Factor; value: (c: CheckinPoint, l: DayLifestyle | undefined) => boolean | null }[] = [
    { factor: 'short_sleep', value: (_c, l) => (l?.sleepMin == null ? null : l.sleepMin < 390) },
    { factor: 'low_water', value: (_c, l) => (l?.waterPrevMl == null ? null : l.waterPrevMl < waterTargetMl * 0.6) },
    { factor: 'salty_food', value: (c, l) => (c.saltyYesterday != null ? c.saltyYesterday === 1 : (l?.saltyPrev ?? null)) },
    { factor: 'alcohol', value: (c) => (c.alcoholYesterday == null ? null : c.alcoholYesterday === 1) },
  ];
  const out: Association[] = [];
  for (const test of tests) {
    const withF: number[] = [];
    const withoutF: number[] = [];
    for (const c of checkins) {
      const v = test.value(c, lifestyle.get(c.day));
      if (v === true) withF.push(c.puffiness);
      else if (v === false) withoutF.push(c.puffiness);
    }
    if (withF.length < MIN_DAYS_EACH || withoutF.length < MIN_DAYS_EACH) continue;
    const a = averagePuffiness(withF.map((p) => ({ puffiness: p })))!;
    const b = averagePuffiness(withoutF.map((p) => ({ puffiness: p })))!;
    if (a - b >= MIN_DIFFERENCE) out.push({ factor: test.factor, withAvg: a, withoutAvg: b, withDays: withF.length, withoutDays: withoutF.length });
  }
  return out.sort((x, y) => y.withAvg - y.withoutAvg - (x.withAvg - x.withoutAvg));
}
