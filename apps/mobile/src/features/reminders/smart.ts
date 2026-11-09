/**
 * Smart reminders: decided on the phone from the day's data, no server.
 * Each time the app opens or something is logged, today's and tomorrow's
 * nudges are recalculated, so reminders skip what's already done.
 */

/** "07:30" / "7:30" → {hour, minute}, or null if invalid. */
export function parseClock(text: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  return hour <= 23 && minute <= 59 ? { hour, minute } : null;
}

export type MealName = 'breakfast' | 'lunch' | 'dinner';

export interface SmartConfig {
  /** Evening check-in that names what's still short today (protein, water, steps). */
  checkIn: boolean;
  checkInTime: string;
  /** Early-afternoon reminder if nothing has been logged yet. */
  logNudge: boolean;
  /** Morning briefing of the day's targets. */
  morning: boolean;
  morningTime?: string;
  /** Sunday-morning weigh-in. */
  weighIn: boolean;
  /** Meal-time prompts, skipped once that meal is logged. */
  meals?: boolean;
  mealTimes?: Record<MealName, string>;
  /** Workout time, skipped once a workout is done today. */
  workout?: boolean;
  workoutTime?: string;
  /** Wind-down reminder before bed. */
  bedtime?: boolean;
  bedtimeTime?: string;
  /** Face wellness check-in, skipped once done today. */
  faceCheckIn?: boolean;
  faceTime?: string;
  /** Skincare routine reminders, skipped once ticked off. */
  skincareAm?: boolean;
  skincareAmTime?: string;
  skincarePm?: boolean;
  skincarePmTime?: string;
  /** No smart reminders inside this window (medicines and your own reminders still ring). */
  quiet?: { enabled: boolean; start: string; end: string };
  /** At most this many smart reminders a day (water nudges count as one). */
  dailyLimit?: number;
}

export const DEFAULT_SMART: Required<SmartConfig> = {
  checkIn: false,
  checkInTime: '19:30',
  logNudge: false,
  morning: false,
  morningTime: '08:00',
  weighIn: false,
  meals: false,
  mealTimes: { breakfast: '08:30', lunch: '13:30', dinner: '20:30' },
  workout: false,
  workoutTime: '18:00',
  bedtime: false,
  bedtimeTime: '22:30',
  faceCheckIn: false,
  faceTime: '08:15',
  skincareAm: false,
  skincareAmTime: '07:30',
  skincarePm: false,
  skincarePmTime: '22:00',
  quiet: { enabled: true, start: '22:45', end: '07:00' },
  dailyLimit: 6,
};

export const LOG_NUDGE = { hour: 14, minute: 0 };
/** Sunday (expo-notifications counts weekdays 1 = Sunday … 7 = Saturday). */
export const WEIGH_IN = { weekday: 1, hour: 7, minute: 30 };

export interface WaterPlan {
  enabled: boolean;
  startHour: number;
  endHour: number;
  everyHours: 1 | 2;
}

export interface DayStatus {
  now: Date;
  foodEntries: number;
  mealsLogged?: string[];
  proteinG: number;
  proteinTarget: number;
  waterMl: number;
  waterTarget: number;
  /** null when steps aren't tracked. */
  steps: number | null;
  stepGoal: number;
  workoutToday: boolean;
  faceCheckedIn?: boolean;
  skincareDone?: { am: boolean; pm: boolean };
  /** Eating-disorder history: no food-number nudges. */
  gentle: boolean;
}

export type Gap = 'protein' | 'water' | 'steps' | 'move';

export type NudgeKind =
  | 'checkIn'
  | 'logNudge'
  | 'morning'
  | 'weighIn'
  | 'meal'
  | 'workout'
  | 'bedtime'
  | 'face'
  | 'skincareAm'
  | 'skincarePm'
  | 'water';

type When = { date: Date } | { daily: { hour: number; minute: number } } | { weekly: { weekday: number; hour: number; minute: number } };

export interface SmartNudge {
  id: string;
  kind: NudgeKind;
  when: When;
  /** Check-in only. */
  gaps?: Gap[];
  generic?: boolean;
  params?: Record<string, number | string>;
}

const at = (base: Date, hour: number, minute: number, addDays = 0) => {
  const d = new Date(base);
  d.setDate(d.getDate() + addDays);
  d.setHours(hour, minute, 0, 0);
  return d;
};

/** What's clearly behind for this time of day (at most two, most useful first). */
export function findGaps(s: DayStatus): Gap[] {
  const gaps: Gap[] = [];
  if (!s.gentle && s.foodEntries > 0 && s.proteinG < s.proteinTarget * 0.8) gaps.push('protein');
  if (s.waterMl < s.waterTarget * 0.7) gaps.push('water');
  if (s.steps != null && s.steps < s.stepGoal * 0.7) gaps.push('steps');
  else if (s.steps == null && !s.workoutToday) gaps.push('move');
  return gaps.slice(0, 2);
}

const minutesOf = (h: number, m: number) => h * 60 + m;

/** True if the clock time falls inside quiet hours (which may cross midnight). */
export function inQuietHours(hour: number, minute: number, quiet: SmartConfig['quiet']): boolean {
  if (!quiet?.enabled) return false;
  const s = parseClock(quiet.start);
  const e = parseClock(quiet.end);
  if (!s || !e) return false;
  const t = minutesOf(hour, minute);
  const a = minutesOf(s.hour, s.minute);
  const b = minutesOf(e.hour, e.minute);
  return a <= b ? t >= a && t < b : t >= a || t < b;
}

const clockOf = (w: When): { hour: number; minute: number } =>
  'date' in w ? { hour: w.date.getHours(), minute: w.date.getMinutes() } : 'daily' in w ? w.daily : w.weekly;

/**
 * A reminder that is skipped once its task is done: today's (if still ahead and not done)
 * plus tomorrow's, which is refreshed whenever the app is next opened.
 */
function conditional(out: SmartNudge[], id: string, kind: NudgeKind, time: string, fallback: string, done: boolean, now: Date, params?: SmartNudge['params']) {
  const t = parseClock(time) ?? parseClock(fallback)!;
  const today = at(now, t.hour, t.minute);
  if (!done && now < today) out.push({ id: `${id}-today`, kind, when: { date: today }, params });
  // The next two days too, so reminders keep coming even if FitMate isn't opened every day.
  out.push({ id: `${id}-d1`, kind, when: { date: at(now, t.hour, t.minute, 1) }, params });
  out.push({ id: `${id}-d2`, kind, when: { date: at(now, t.hour, t.minute, 2) }, params });
}

export function buildSmartNudges(cfgIn: SmartConfig, s: DayStatus, water?: WaterPlan): SmartNudge[] {
  const cfg = { ...DEFAULT_SMART, ...cfgIn, mealTimes: { ...DEFAULT_SMART.mealTimes, ...(cfgIn.mealTimes ?? {}) } };
  const out: SmartNudge[] = [];
  const now = s.now;

  if (cfg.morning) {
    const t = parseClock(cfg.morningTime) ?? { hour: 8, minute: 0 };
    out.push({ id: 'smart-morning', kind: 'morning', when: { daily: t } });
  }

  if (cfg.checkIn) {
    const t = parseClock(cfg.checkInTime) ?? { hour: 19, minute: 30 };
    const today = at(now, t.hour, t.minute);
    if (now < today) {
      const gaps = s.foodEntries > 0 ? findGaps(s) : [];
      // Nothing short today → no notification. Nothing logged → a gentle generic check-in.
      if (gaps.length || s.foodEntries === 0) {
        out.push({
          id: 'smart-checkin',
          kind: 'checkIn',
          when: { date: today },
          gaps,
          generic: s.foodEntries === 0,
          params: {
            proteinLeft: Math.max(0, Math.round(s.proteinTarget - s.proteinG)),
            waterLeft: Math.max(0, Math.round((s.waterTarget - s.waterMl) / 250)),
            stepsLeft: Math.max(0, Math.round((s.stepGoal - (s.steps ?? 0)) / 100) * 100),
          },
        });
      }
    } else {
      out.push({ id: 'smart-checkin', kind: 'checkIn', when: { date: at(now, t.hour, t.minute, 1) }, gaps: [], generic: true, params: {} });
    }
  }

  if (cfg.logNudge) {
    const today = at(now, LOG_NUDGE.hour, LOG_NUDGE.minute);
    if (s.foodEntries === 0 && now < today) out.push({ id: 'smart-log', kind: 'logNudge', when: { date: today } });
    else out.push({ id: 'smart-log', kind: 'logNudge', when: { date: at(now, LOG_NUDGE.hour, LOG_NUDGE.minute, 1) } });
  }

  if (cfg.meals) {
    for (const meal of ['breakfast', 'lunch', 'dinner'] as const) {
      conditional(out, `smart-meal-${meal}`, 'meal', cfg.mealTimes[meal], DEFAULT_SMART.mealTimes[meal], (s.mealsLogged ?? []).includes(meal), now, { meal });
    }
  }
  if (cfg.workout) conditional(out, 'smart-workout', 'workout', cfg.workoutTime, DEFAULT_SMART.workoutTime, s.workoutToday, now);
  if (cfg.faceCheckIn) conditional(out, 'smart-face', 'face', cfg.faceTime, DEFAULT_SMART.faceTime, !!s.faceCheckedIn, now);
  if (cfg.skincareAm) conditional(out, 'smart-skin-am', 'skincareAm', cfg.skincareAmTime, DEFAULT_SMART.skincareAmTime, !!s.skincareDone?.am, now);
  if (cfg.skincarePm) conditional(out, 'smart-skin-pm', 'skincarePm', cfg.skincarePmTime, DEFAULT_SMART.skincarePmTime, !!s.skincareDone?.pm, now);
  if (cfg.bedtime) {
    const t = parseClock(cfg.bedtimeTime) ?? { hour: 22, minute: 30 };
    out.push({ id: 'smart-bedtime', kind: 'bedtime', when: { daily: t } });
  }
  if (cfg.weighIn) out.push({ id: 'smart-weighin', kind: 'weighIn', when: { weekly: WEIGH_IN } });

  // Water: today's remaining hours only while below target; the next two days in full.
  if (water?.enabled && water.endHour >= water.startHour) {
    const reached = s.waterMl >= s.waterTarget;
    for (const day of [0, 1, 2]) {
      if (day === 0 && reached) continue;
      for (let h = water.startHour; h <= water.endHour; h += water.everyHours) {
        const d = at(now, h, 0, day);
        if (d > now) out.push({ id: `smart-water-d${day}-${h}`, kind: 'water', when: { date: d } });
      }
    }
  }

  // Quiet hours (everything here is a "smart" reminder).
  const awake = out.filter((n) => {
    const c = clockOf(n.when);
    return !inQuietHours(c.hour, c.minute, cfg.quiet);
  });

  // Daily limit: water nudges count as one; earlier items in the list have priority.
  const limit = Math.max(1, cfg.dailyLimit);
  const dayKey = (n: SmartNudge): string[] => ('date' in n.when ? [n.when.date.toDateString()] : [0, 1, 2].map((d) => at(now, 0, 0, d).toDateString()));
  const counts = new Map<string, number>();
  const waterCounted = new Set<string>();
  const kept: SmartNudge[] = [];
  for (const n of awake) {
    const days = dayKey(n);
    if (n.kind === 'water') {
      const d = days[0]!;
      if (!waterCounted.has(d)) {
        if ((counts.get(d) ?? 0) >= limit) continue;
        counts.set(d, (counts.get(d) ?? 0) + 1);
        waterCounted.add(d);
      }
      kept.push(n);
      continue;
    }
    if (days.some((d) => (counts.get(d) ?? 0) >= limit)) continue;
    for (const d of days) counts.set(d, (counts.get(d) ?? 0) + 1);
    kept.push(n);
  }
  return kept;
}
