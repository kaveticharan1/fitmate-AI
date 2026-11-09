import type { Workout } from './plans';

/** Where you are in a workout. Pure state machine — the screen only renders it. */
export interface SessionState {
  stepIndex: number;
  /** 1-based set number within the current step. */
  set: number;
  phase: 'work' | 'rest' | 'done';
  /** Epoch ms when the current rest ends (rest phase only). */
  restEndsAt: number | null;
  completedSets: number;
  skippedSteps: number[];
  startedAt: number;
}

export type SessionAction =
  | { type: 'completeSet'; now: number }
  | { type: 'endRest' }
  | { type: 'skipStep' }
  | { type: 'finish' };

export function startSession(now: number): SessionState {
  return { stepIndex: 0, set: 1, phase: 'work', restEndsAt: null, completedSets: 0, skippedSteps: [], startedAt: now };
}

export const totalSets = (w: Workout) => w.steps.reduce((n, s) => n + s.sets, 0);

function nextStep(w: Workout, s: SessionState): SessionState {
  const stepIndex = s.stepIndex + 1;
  if (stepIndex >= w.steps.length) return { ...s, phase: 'done', restEndsAt: null };
  return { ...s, stepIndex, set: 1, phase: 'work', restEndsAt: null };
}

export function sessionReducer(w: Workout, s: SessionState, a: SessionAction): SessionState {
  if (s.phase === 'done') return s;
  switch (a.type) {
    case 'completeSet': {
      if (s.phase !== 'work') return s;
      const step = w.steps[s.stepIndex]!;
      const done = { ...s, completedSets: s.completedSets + 1 };
      const lastSetOfStep = s.set >= step.sets;
      const lastStep = s.stepIndex >= w.steps.length - 1;
      if (lastSetOfStep && lastStep) return { ...done, phase: 'done', restEndsAt: null };
      if (step.restSec > 0) return { ...done, phase: 'rest', restEndsAt: a.now + step.restSec * 1000 };
      return lastSetOfStep ? nextStep(w, done) : { ...done, set: s.set + 1 };
    }
    case 'endRest': {
      if (s.phase !== 'rest') return s;
      const step = w.steps[s.stepIndex]!;
      return s.set >= step.sets ? nextStep(w, s) : { ...s, set: s.set + 1, phase: 'work', restEndsAt: null };
    }
    case 'skipStep':
      return nextStep(w, { ...s, skippedSteps: [...s.skippedSteps, s.stepIndex] });
    case 'finish':
      return { ...s, phase: 'done', restEndsAt: null };
  }
}

/** Seconds of rest left, based on the clock — correct even if the app was in the background. */
export function restSecondsLeft(s: SessionState, now: number): number {
  return s.restEndsAt == null ? 0 : Math.max(0, Math.ceil((s.restEndsAt - now) / 1000));
}
