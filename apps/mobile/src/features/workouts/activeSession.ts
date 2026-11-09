import { startSession, type SessionState, type Workout } from '@fitmate/workouts';
import { useSyncExternalStore } from 'react';

/**
 * The workout in progress lives in memory outside React, so it survives the
 * session screen unmounting (auto-lock, going back to check something).
 * It is not written to disk; if the app is killed the workout is lost, which
 * is acceptable for a 10–40 minute activity.
 */
export interface ActiveWorkout {
  workout: Workout;
  state: SessionState;
  estKcal: number;
}

let active: ActiveWorkout | null = null;
const listeners = new Set<() => void>();

export function getActiveWorkout() {
  return active;
}

export function setActiveWorkout(next: ActiveWorkout | null) {
  active = next;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export const useActiveWorkout = () => useSyncExternalStore(subscribe, getActiveWorkout, getActiveWorkout);

/** Starts a workout, or keeps the running one if it is the same workout. */
export function beginWorkout(workout: Workout, estKcal: number) {
  if (active && active.state.phase !== 'done' && active.workout.id === workout.id) return;
  setActiveWorkout({ workout, state: startSession(Date.now()), estKcal });
}
