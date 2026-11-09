/**
 * Daily briefing (morning) and evening review, worked out on the phone.
 * Encouraging and non-judgemental: wins first, then at most three next steps.
 */
export interface DayFacts {
  kcal: number;
  kcalTarget: number;
  proteinG: number;
  proteinTarget: number;
  foodEntries: number;
  waterMl: number;
  waterTarget: number;
  steps: number | null;
  stepGoal: number;
  workoutDone: boolean;
  sleepMin: number | null;
  faceCheckedIn: boolean | null;
  gentle: boolean;
}

export type Win = 'protein' | 'water' | 'steps' | 'workout' | 'logged' | 'sleep' | 'calories' | 'face';
export type NextStep = 'logFood' | 'protein' | 'water' | 'steps' | 'workout' | 'sleepEarly' | 'face';

export interface Review {
  wins: Win[];
  next: NextStep[];
}

export function eveningReview(f: DayFacts): Review {
  const wins: Win[] = [];
  const next: NextStep[] = [];
  if (f.foodEntries > 0) wins.push('logged');
  else next.push('logFood');
  if (!f.gentle && f.foodEntries > 0) {
    if (f.proteinG >= f.proteinTarget * 0.9) wins.push('protein');
    else next.push('protein');
    if (f.kcal > 0 && f.kcal <= f.kcalTarget * 1.05 && f.kcal >= f.kcalTarget * 0.75) wins.push('calories');
  }
  if (f.waterMl >= f.waterTarget * 0.9) wins.push('water');
  else next.push('water');
  if (f.steps != null) {
    if (f.steps >= f.stepGoal) wins.push('steps');
    else if (f.steps < f.stepGoal * 0.7) next.push('steps');
  }
  if (f.workoutDone) wins.push('workout');
  else if (f.steps == null || f.steps < f.stepGoal * 0.7) next.push('workout');
  if (f.sleepMin != null && f.sleepMin >= 420) wins.push('sleep');
  else if (f.sleepMin != null && f.sleepMin < 390) next.push('sleepEarly');
  if (f.faceCheckedIn === true) wins.push('face');
  else if (f.faceCheckedIn === false) next.push('face');
  return { wins, next: next.slice(0, 3) };
}

/** Which card Home shows at this hour: the plan in the morning, the review from 5 pm. */
export function dayCardFor(now: Date): 'briefing' | 'review' | 'none' {
  const h = now.getHours();
  if (h >= 5 && h < 15) return 'briefing';
  if (h >= 17) return 'review';
  return 'none';
}
