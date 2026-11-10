import type { Gap } from '../reminders/smart';

/**
 * What the background step check needs to know about this evening's check-in
 * reminder. Saved when the app syncs reminders; contains no food or health log,
 * only which gaps were found and the step goal.
 */
export interface StepsSnapshot {
  day: string;
  /** When the evening check-in notification fires (ISO). */
  checkInAt: string;
  /** Gaps other than steps (protein, water), in priority order. */
  otherGaps: Gap[];
  /** What the scheduled notification currently says. */
  gaps: Gap[];
  params: Record<string, number>;
  stepGoal: number;
  lang: 'en' | 'te';
  /** Where live steps come from in the background (older snapshots: Health Connect). */
  source?: 'phone' | 'health_connect';
}

export type StepsDecision =
  | { action: 'none' }
  | { action: 'cancel' }
  | { action: 'update'; gaps: Gap[]; params: Record<string, number> };

/** Steps below 70% of the goal count as behind — the same rule the app uses. */
export function decideCheckIn(snap: StepsSnapshot, stepsToday: number, now: Date, today: string): StepsDecision {
  if (snap.day !== today || now.getTime() >= Date.parse(snap.checkInAt)) return { action: 'none' };
  const behind = stepsToday < snap.stepGoal * 0.7;
  const gaps = [...snap.otherGaps.filter((g) => g !== 'steps' && g !== 'move'), ...(behind ? (['steps'] as Gap[]) : [])].slice(0, 2);
  const params = { ...snap.params, stepsLeft: Math.max(0, Math.round((snap.stepGoal - stepsToday) / 100) * 100) };
  if (gaps.length === 0) return snap.gaps.length === 0 ? { action: 'none' } : { action: 'cancel' };
  const same = gaps.join() === snap.gaps.join() && (!gaps.includes('steps') || params.stepsLeft === snap.params.stepsLeft);
  return same ? { action: 'none' } : { action: 'update', gaps, params };
}
