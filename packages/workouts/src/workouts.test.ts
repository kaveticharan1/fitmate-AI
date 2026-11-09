import { describe, expect, it } from 'vitest';
import {
  EXERCISES,
  WORKOUTS,
  canDo,
  estimateKcal,
  estimateMinutes,
  getExercise,
  getWorkout,
  jointsFromText,
  personalise,
  restSecondsLeft,
  sessionReducer,
  startSession,
  suggestFor,
  totalSets,
  type Personalisation,
  type Workout,
} from './index';

const home: Personalisation = { equipment: [], workoutPreference: 'home', injuries: null };

describe('exercise library', () => {
  it('has unique ids and complete entries', () => {
    const ids = EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(EXERCISES.length).toBeGreaterThanOrEqual(30);
    for (const e of EXERCISES) {
      expect(e.steps.length).toBeGreaterThan(0);
      expect(e.safety.length).toBeGreaterThan(0);
      expect(e.nameTe.length).toBeGreaterThan(0);
      expect(e.met).toBeGreaterThan(1);
    }
  });

  it('easier alternatives exist, are easier or equal, and never loop', () => {
    for (const e of EXERCISES) {
      const seen = new Set<string>([e.id]);
      let cur = e;
      while (cur.easier) {
        const next = getExercise(cur.easier);
        expect(next, `${cur.id} → ${cur.easier}`).toBeDefined();
        expect(next!.level).toBeLessThanOrEqual(cur.level);
        expect(seen.has(next!.id)).toBe(false);
        seen.add(next!.id);
        cur = next!;
      }
    }
  });
});

describe('workouts', () => {
  it('reference only known exercises with sensible amounts', () => {
    for (const w of WORKOUTS) {
      expect(w.steps.length).toBeGreaterThan(0);
      for (const s of w.steps) {
        expect(getExercise(s.exerciseId), `${w.id}: ${s.exerciseId}`).toBeDefined();
        expect(s.sets).toBeGreaterThan(0);
        expect(s.amount).toBeGreaterThan(0);
        expect(s.restSec).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('filters by equipment and preference', () => {
    const dumbbell = getWorkout('dumbbell_full')!;
    const gym = getWorkout('gym_beginner')!;
    expect(canDo(dumbbell, home)).toBe(false);
    expect(canDo(dumbbell, { ...home, equipment: ['Dumbbells'] })).toBe(true);
    expect(canDo(gym, home)).toBe(false);
    expect(canDo(gym, { ...home, workoutPreference: 'gym' })).toBe(true);
    expect(canDo(getWorkout('home_beginner')!, home)).toBe(true);
  });

  it('reads injuries from free text in English and Telugu', () => {
    expect([...jointsFromText('Left knee pain')]).toEqual(['knee']);
    expect(jointsFromText('lower back ache, shoulder').has('shoulder')).toBe(true);
    expect(jointsFromText('మోకాలు నొప్పి').has('knee')).toBe(true);
    expect(jointsFromText(null).size).toBe(0);
  });

  it('swaps knee-heavy exercises for knee problems', () => {
    const { workout, swapped } = personalise(getWorkout('home_intermediate')!, { ...home, injuries: 'knee pain' });
    for (const s of workout.steps) {
      expect(getExercise(s.exerciseId)!.stresses ?? []).not.toContain('knee');
    }
    expect(swapped).toContain('squat');
    expect(swapped).toContain('lunge');
  });

  it('changes nothing without injuries', () => {
    const w = getWorkout('home_intermediate')!;
    const { workout, swapped } = personalise(w, home);
    expect(workout.steps).toEqual(w.steps);
    expect(swapped).toEqual([]);
  });

  it('suggests a stretch on Sunday and walking on Tuesday', () => {
    expect(suggestFor('2026-11-08', home, 1)?.id).toBe('stretch_daily'); // Sunday
    expect(suggestFor('2026-11-10', home, 1)?.id).toBe('walk_30'); // Tuesday
    expect(suggestFor('2026-11-09', home, 1)?.id).toBe('home_beginner'); // Monday
    expect(suggestFor('2026-11-09', { ...home, equipment: ['dumbbells'] }, 2)?.id).toBe('dumbbell_full');
    expect(suggestFor('2026-11-09', { ...home, workoutPreference: 'gym' }, 1)?.id).toBe('gym_beginner');
  });

  it('estimates calories and minutes', () => {
    const walk = getWorkout('walk_30')!;
    const kcal = estimateKcal(walk, 80);
    // 25 min at MET 4.3 × 80 kg ≈ 143 kcal, plus warm-up and stretches.
    expect(kcal).toBeGreaterThan(140);
    expect(kcal).toBeLessThan(200);
    expect(estimateMinutes(walk)).toBeGreaterThanOrEqual(29);
    expect(estimateKcal(walk, 60)).toBeLessThan(kcal);
  });
});

describe('session', () => {
  const w: Workout = {
    id: 't',
    name: 't',
    nameTe: 't',
    kind: 'home',
    level: 1,
    steps: [
      { exerciseId: 'squat', sets: 2, amount: 10, restSec: 30 },
      { exerciseId: 'plank', sets: 1, amount: 20, restSec: 0 },
    ],
  };

  it('walks through sets, rests and steps', () => {
    let s = startSession(0);
    expect(totalSets(w)).toBe(3);
    s = sessionReducer(w, s, { type: 'completeSet', now: 1000 });
    expect(s).toMatchObject({ phase: 'rest', stepIndex: 0, set: 1, completedSets: 1, restEndsAt: 31000 });
    expect(restSecondsLeft(s, 1000)).toBe(30);
    expect(restSecondsLeft(s, 40000)).toBe(0);
    s = sessionReducer(w, s, { type: 'endRest' });
    expect(s).toMatchObject({ phase: 'work', stepIndex: 0, set: 2 });
    s = sessionReducer(w, s, { type: 'completeSet', now: 2000 });
    expect(s.phase).toBe('rest');
    s = sessionReducer(w, s, { type: 'endRest' });
    expect(s).toMatchObject({ phase: 'work', stepIndex: 1, set: 1 });
    s = sessionReducer(w, s, { type: 'completeSet', now: 3000 });
    expect(s).toMatchObject({ phase: 'done', completedSets: 3 });
    // Done is final.
    expect(sessionReducer(w, s, { type: 'completeSet', now: 4000 })).toBe(s);
  });

  it('skips a step and can finish early', () => {
    let s = sessionReducer(w, startSession(0), { type: 'skipStep' });
    expect(s).toMatchObject({ stepIndex: 1, skippedSteps: [0], phase: 'work' });
    s = sessionReducer(w, s, { type: 'skipStep' });
    expect(s.phase).toBe('done');
    const early = sessionReducer(w, startSession(0), { type: 'finish' });
    expect(early).toMatchObject({ phase: 'done', completedSets: 0 });
  });

  it('ignores actions in the wrong phase', () => {
    const s = startSession(0);
    expect(sessionReducer(w, s, { type: 'endRest' })).toBe(s);
    const resting = sessionReducer(w, s, { type: 'completeSet', now: 0 });
    expect(sessionReducer(w, resting, { type: 'completeSet', now: 0 })).toBe(resting);
  });
});
