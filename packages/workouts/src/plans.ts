import { requireExercise, type Equipment, type Joint } from './exercises';

export interface WorkoutStep {
  exerciseId: string;
  sets: number;
  /** Reps per set, or seconds per set for timed exercises. */
  amount: number;
  restSec: number;
}

export interface Workout {
  id: string;
  name: string;
  nameTe: string;
  kind: 'home' | 'gym' | 'walking' | 'stretch';
  level: 1 | 2 | 3;
  steps: WorkoutStep[];
}

const s = (exerciseId: string, sets: number, amount: number, restSec = 45): WorkoutStep => ({ exerciseId, sets, amount, restSec });

export const WORKOUTS: Workout[] = [
  {
    id: 'home_beginner',
    name: 'Home beginner — full body',
    nameTe: 'ఇంట్లో ప్రారంభ స్థాయి — పూర్తి శరీరం',
    kind: 'home',
    level: 1,
    steps: [s('march', 1, 120, 30), s('chair_squat', 2, 10), s('wall_pushup', 2, 10), s('glute_bridge', 2, 12), s('plank_knee', 2, 20), s('calf_raise', 2, 12), s('hamstring_stretch', 1, 40, 15)],
  },
  {
    id: 'home_intermediate',
    name: 'Home intermediate — full body',
    nameTe: 'ఇంట్లో మధ్యస్థ స్థాయి — పూర్తి శరీరం',
    kind: 'home',
    level: 2,
    steps: [s('step_jacks', 1, 60, 30), s('squat', 3, 15), s('pushup', 3, 10, 60), s('lunge', 3, 10), s('plank', 3, 30), s('dead_bug', 2, 10), s('child_pose', 1, 45, 15)],
  },
  {
    id: 'home_cardio',
    name: 'Home cardio (low impact)',
    nameTe: 'ఇంట్లో కార్డియో (తక్కువ ఒత్తిడి)',
    kind: 'home',
    level: 1,
    steps: [s('march', 1, 120, 20), s('step_jacks', 4, 45, 30), s('march', 3, 60, 30), s('calf_raise', 2, 15), s('quad_stretch', 1, 30, 15)],
  },
  {
    id: 'home_hiit',
    name: 'Home cardio blast',
    nameTe: 'ఇంట్లో వేగమైన కార్డియో',
    kind: 'home',
    level: 3,
    steps: [s('step_jacks', 1, 60, 20), s('jumping_jacks', 4, 40, 20), s('high_knees', 4, 30, 30), s('mountain_climber', 3, 30, 30), s('child_pose', 1, 45, 15)],
  },
  {
    id: 'dumbbell_full',
    name: 'Dumbbell full body',
    nameTe: 'డంబెల్స్‌తో పూర్తి శరీరం',
    kind: 'home',
    level: 2,
    steps: [s('march', 1, 90, 20), s('db_goblet_squat', 3, 12, 60), s('db_row', 3, 10, 60), s('db_press', 3, 10, 60), s('db_curl', 2, 12), s('plank', 2, 30)],
  },
  {
    id: 'gym_beginner',
    name: 'Gym beginner — machines',
    nameTe: 'జిమ్ ప్రారంభ స్థాయి — మెషిన్లు',
    kind: 'gym',
    level: 1,
    steps: [s('brisk_walk', 1, 300, 30), s('leg_press', 3, 12, 75), s('chest_press', 3, 12, 75), s('lat_pulldown', 3, 12, 75), s('seated_row', 3, 12, 75), s('plank_knee', 2, 30)],
  },
  {
    id: 'walk_30',
    name: '30-minute brisk walk',
    nameTe: '30 నిమిషాల వేగమైన నడక',
    kind: 'walking',
    level: 1,
    steps: [s('march', 1, 180, 0), s('brisk_walk', 1, 1500, 0), s('quad_stretch', 1, 30, 10), s('hamstring_stretch', 1, 30, 0)],
  },
  {
    id: 'stretch_daily',
    name: 'Daily stretch and mobility (10 min)',
    nameTe: 'రోజువారీ స్ట్రెచ్ (10 ని)',
    kind: 'stretch',
    level: 1,
    steps: [s('neck_rolls', 1, 60, 10), s('cat_cow', 1, 60, 10), s('chest_opener', 2, 30, 10), s('hamstring_stretch', 2, 40, 10), s('quad_stretch', 2, 30, 10), s('child_pose', 1, 60, 0)],
  },
];

export const getWorkout = (id: string) => WORKOUTS.find((w) => w.id === id);

/** Joints mentioned in free-text injuries ("knee pain", "back problem", "మోకాలు"). */
export function jointsFromText(text: string | null | undefined): Set<Joint> {
  const t = (text ?? '').toLowerCase();
  const out = new Set<Joint>();
  if (/knee|మోకాలు|మోకాళ్ళ|ghutna/.test(t)) out.add('knee');
  if (/back|spine|disc|నడుము నొప్పి|వెన్ను|kamar/.test(t)) out.add('back');
  if (/shoulder|భుజం|kandha/.test(t)) out.add('shoulder');
  if (/wrist|మణికట్టు/.test(t)) out.add('wrist');
  return out;
}

export interface Personalisation {
  equipment: string[];
  workoutPreference: 'none' | 'walking' | 'home' | 'gym' | 'mixed';
  injuries?: string | null;
}

/** Can this person do the workout with what they have? */
export function canDo(w: Workout, p: Personalisation): boolean {
  if (w.kind === 'gym' && !['gym', 'mixed'].includes(p.workoutPreference)) return false;
  const hasDumbbells = p.equipment.some((e) => /dumbbell|డంబెల్/i.test(e));
  return w.steps.every((st) => {
    const ex = requireExercise(st.exerciseId);
    const eq: Equipment = ex.equipment;
    if (eq === 'dumbbells') return hasDumbbells;
    if (eq === 'band') return p.equipment.some((e) => /band/i.test(e));
    return true;
  });
}

/**
 * The workout as this person should do it: exercises that load an injured joint
 * are swapped for an easier alternative that doesn't (or dropped if none exists).
 */
export function personalise(w: Workout, p: Personalisation): { workout: Workout; swapped: string[] } {
  const joints = jointsFromText(p.injuries);
  const swapped: string[] = [];
  const steps: WorkoutStep[] = [];
  for (const st of w.steps) {
    let ex = requireExercise(st.exerciseId);
    while (ex.stresses?.some((j) => joints.has(j)) && ex.easier) {
      ex = requireExercise(ex.easier);
    }
    if (ex.stresses?.some((j) => joints.has(j))) {
      swapped.push(st.exerciseId);
      continue;
    }
    if (ex.id !== st.exerciseId) swapped.push(st.exerciseId);
    steps.push({ ...st, exerciseId: ex.id });
  }
  return { workout: { ...w, steps }, swapped };
}

/** Suggested workout for a day: rotates strength, cardio/walk and stretch days by weekday. */
export function suggestFor(date: string, p: Personalisation, level: 1 | 2 | 3): Workout | null {
  if (p.workoutPreference === 'none') return getWorkout('stretch_daily') ?? null;
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  const pool = WORKOUTS.filter((w) => canDo(w, p));
  const pick = (ids: string[]) => ids.map(getWorkout).find((w): w is Workout => !!w && pool.includes(w)) ?? null;
  if (weekday === 0) return pick(['stretch_daily']);
  if (p.workoutPreference === 'walking' || weekday === 2 || weekday === 4) {
    return pick(level >= 3 ? ['home_hiit', 'walk_30'] : ['walk_30', 'home_cardio']);
  }
  if (p.workoutPreference === 'gym') return pick(['gym_beginner', 'home_beginner']);
  const strength = level === 1 ? ['home_beginner'] : ['dumbbell_full', 'home_intermediate', 'home_beginner'];
  return pick(strength);
}

/** Estimated calories: MET × weight(kg) × hours, counting work time only (approximate). */
export function estimateKcal(w: Workout, weightKg: number, secondsPerRep = 3): number {
  let kcal = 0;
  for (const st of w.steps) {
    const ex = requireExercise(st.exerciseId);
    const sec = st.sets * (ex.mode === 'time' ? st.amount : st.amount * secondsPerRep);
    kcal += ex.met * weightKg * (sec / 3600);
  }
  return Math.round(kcal);
}

/** Total minutes including rests. */
export function estimateMinutes(w: Workout, secondsPerRep = 3): number {
  let sec = 0;
  for (const st of w.steps) {
    const ex = requireExercise(st.exerciseId);
    sec += st.sets * (ex.mode === 'time' ? st.amount : st.amount * secondsPerRep) + Math.max(0, st.sets - 1) * st.restSec + st.restSec;
  }
  return Math.max(1, Math.round(sec / 60));
}
