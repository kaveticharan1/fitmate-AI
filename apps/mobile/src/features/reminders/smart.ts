/** "07:30" / "7:30" → {hour, minute}, or null if invalid. */
export function parseClock(text: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  return hour <= 23 && minute <= 59 ? { hour, minute } : null;
}

/**
 * Smart reminders: decided on the phone from the day's data, no server.
 * Each time the app opens or something is logged, today's nudges are
 * recalculated, so the evening message reflects the latest numbers.
 */
export interface SmartConfig {
  /** Evening check-in that names what's still short today (protein, water, steps). */
  checkIn: boolean;
  checkInTime: string;
  /** Early-afternoon reminder if nothing has been logged yet. */
  logNudge: boolean;
  /** Morning summary of the day's targets. */
  morning: boolean;
  /** Sunday-morning weigh-in. */
  weighIn: boolean;
}

export const DEFAULT_SMART: SmartConfig = { checkIn: false, checkInTime: '19:30', logNudge: false, morning: false, weighIn: false };

export const LOG_NUDGE = { hour: 14, minute: 0 };
export const MORNING = { hour: 8, minute: 0 };
/** Sunday (expo-notifications counts weekdays 1 = Sunday … 7 = Saturday). */
export const WEIGH_IN = { weekday: 1, hour: 7, minute: 30 };

export interface DayStatus {
  now: Date;
  foodEntries: number;
  proteinG: number;
  proteinTarget: number;
  waterMl: number;
  waterTarget: number;
  /** null when steps aren't tracked. */
  steps: number | null;
  stepGoal: number;
  workoutToday: boolean;
  /** Eating-disorder history: no food-number nudges. */
  gentle: boolean;
}

export type Gap = 'protein' | 'water' | 'steps' | 'move';

export type SmartNudge =
  | { id: string; kind: 'checkIn'; when: { date: Date }; gaps: Gap[]; params: Record<string, number>; generic: boolean }
  | { id: string; kind: 'logNudge'; when: { date: Date } }
  | { id: string; kind: 'morning'; when: { daily: { hour: number; minute: number } } }
  | { id: string; kind: 'weighIn'; when: { weekly: { weekday: number; hour: number; minute: number } } };

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

export function buildSmartNudges(cfg: SmartConfig, s: DayStatus): SmartNudge[] {
  const out: SmartNudge[] = [];
  const now = s.now;

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
      // Today's check-in time has passed: prepare tomorrow's, refreshed when the app is next opened.
      out.push({ id: 'smart-checkin', kind: 'checkIn', when: { date: at(now, t.hour, t.minute, 1) }, gaps: [], generic: true, params: {} });
    }
  }

  if (cfg.logNudge) {
    const today = at(now, LOG_NUDGE.hour, LOG_NUDGE.minute);
    if (s.foodEntries === 0 && now < today) out.push({ id: 'smart-log', kind: 'logNudge', when: { date: today } });
    else out.push({ id: 'smart-log', kind: 'logNudge', when: { date: at(now, LOG_NUDGE.hour, LOG_NUDGE.minute, 1) } });
  }

  if (cfg.morning) out.push({ id: 'smart-morning', kind: 'morning', when: { daily: MORNING } });
  if (cfg.weighIn) out.push({ id: 'smart-weighin', kind: 'weighIn', when: { weekly: WEIGH_IN } });
  return out;
}
