/** Hours with at least this many steps count as "active". */
export const ACTIVE_HOUR_STEPS = 250;

export interface HourSummary {
  total: number;
  /** Hours with any steps, latest first. */
  hours: { hour: number; steps: number }[];
  busiest: { hour: number; steps: number } | null;
  activeHours: number;
}

export function summarizeHours(hours: number[]): HourSummary {
  const list = hours.map((steps, hour) => ({ hour, steps })).filter((h) => h.steps > 0);
  const busiest = list.reduce<{ hour: number; steps: number } | null>((b, h) => (!b || h.steps > b.steps ? h : b), null);
  return {
    total: hours.reduce((a, b) => a + b, 0),
    hours: [...list].reverse(),
    busiest,
    activeHours: list.filter((h) => h.steps >= ACTIVE_HOUR_STEPS).length,
  };
}

/** "7 AM", "12 PM", "11 PM". */
export function hourLabel(h: number): string {
  const n = ((h + 11) % 12) + 1;
  return `${n} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Newer counts win hour by hour (the phone's live ledger is fresher than the database). */
export function mergeHours(a: number[], b: number[]): number[] {
  return Array.from({ length: 24 }, (_, i) => Math.max(a[i] ?? 0, b[i] ?? 0));
}
