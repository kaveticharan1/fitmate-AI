/**
 * Steps: daily goals, rough calorie estimates and validation of step records
 * (to catch phone shaking, vehicle vibration or bad data from other apps).
 */

export type ActivityLevelForSteps = 'sedentary' | 'light' | 'moderate' | 'very_active';

/** A reasonable starting goal; the user can change it. */
export function defaultStepGoal(activity: string): number {
  switch (activity) {
    case 'sedentary':
      return 6000;
    case 'light':
      return 8000;
    case 'moderate':
      return 10000;
    case 'very_active':
      return 12000;
    default:
      return 8000;
  }
}

/** Very rough energy used by walking: about 0.04 kcal per step for a 70 kg adult. Display only. */
export function stepsToKcal(steps: number, weightKg: number): number {
  return Math.round(steps * 0.04 * (weightKg / 70));
}

/** Rough distance: about 0.75 m per step (varies with height). */
export function stepsToKm(steps: number, heightCm?: number | null): number {
  const stride = heightCm ? (heightCm * 0.415) / 100 : 0.75;
  return Math.round(((steps * stride) / 1000) * 10) / 10;
}

export interface StepRecord {
  start: string; // ISO time
  end: string; // ISO time
  count: number;
  origin?: string;
}

export type StepFlagReason = 'too_fast' | 'burst' | 'daily_total';

export interface StepFlag {
  reason: StepFlagReason;
  start: string;
  count: number;
  origin?: string;
}

/** Fastest believable cadence. Elite sprinters reach ~250 steps/min only for seconds. */
export const MAX_CADENCE = 220;
/** Above this a single day is almost certainly wrong for an ordinary person. */
export const MAX_DAILY_STEPS = 60000;

/**
 * Finds records that can't be real walking or running. Flags are shown to the
 * user; they are not silently removed, because Health Connect already merges
 * sources and the user knows best.
 */
export function validateStepRecords(records: StepRecord[], dayTotal?: number): StepFlag[] {
  const flags: StepFlag[] = [];
  for (const r of records) {
    const minutes = (Date.parse(r.end) - Date.parse(r.start)) / 60000;
    if (!(r.count > 0) || !Number.isFinite(minutes)) continue;
    if (minutes <= 0) {
      if (r.count > 500) flags.push({ reason: 'burst', start: r.start, count: r.count, origin: r.origin });
      continue;
    }
    const cadence = r.count / minutes;
    if (minutes < 2 && r.count > 500) flags.push({ reason: 'burst', start: r.start, count: r.count, origin: r.origin });
    else if (cadence > MAX_CADENCE && r.count >= 100) flags.push({ reason: 'too_fast', start: r.start, count: r.count, origin: r.origin });
  }
  if (dayTotal != null && dayTotal > MAX_DAILY_STEPS) flags.push({ reason: 'daily_total', start: '', count: dayTotal });
  return flags;
}

/** Daily totals from Health Connect's period aggregation ("2026-11-09T00:00" start times). */
export function daysFromAggregate(groups: { startTime: string; result: { COUNT_TOTAL?: number } }[]): { date: string; steps: number }[] {
  return groups
    .map((g) => ({ date: g.startTime.slice(0, 10), steps: Math.max(0, Math.round(g.result.COUNT_TOTAL ?? 0)) }))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date));
}

/** Average over days that have data (days with 0 steps recorded count as no data). */
export function averageSteps(days: { steps: number }[]): number | null {
  const withData = days.filter((d) => d.steps > 0);
  if (withData.length === 0) return null;
  return Math.round(withData.reduce((s, d) => s + d.steps, 0) / withData.length);
}
