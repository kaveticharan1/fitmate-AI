export interface ShareSettings {
  steps: boolean;
  workouts: boolean;
  water: boolean;
  streak: boolean;
  weightTrend: boolean;
}

export const DEFAULT_SHARE: ShareSettings = { steps: true, workouts: true, water: true, streak: true, weightTrend: false };

export interface BuddySummary {
  steps?: number;
  stepGoal?: number;
  workoutsWeek?: number;
  workoutToday?: boolean;
  waterDaysWeek?: number;
  waterPct?: number;
  streak?: number;
  loggedToday?: boolean;
  weightTrend?: 'down' | 'steady' | 'up';
}

export interface LocalFacts {
  today: string;
  /** null when steps aren't tracked. */
  stepsToday: number | null;
  stepGoal: number;
  workoutDays: string[];
  waterByDay: Record<string, number>;
  waterTarget: number;
  foodDays: string[];
  weights: { date: string; value: number }[];
  /** Gentle mode never shares weight. */
  gentle: boolean;
}

const addDays = (day: string, n: number) => {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const t = new Date(y, m - 1, d + n);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

/** Days in a row with food logged, counting back from today (or yesterday if today isn't logged yet). */
export function loggingStreak(foodDays: string[], today: string): number {
  const set = new Set(foodDays);
  let day = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

/** Compares the average of the first and last few weigh-ins in the last two weeks. */
export function weightTrend(weights: { date: string; value: number }[]): 'down' | 'steady' | 'up' | undefined {
  if (weights.length < 2) return undefined;
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const k = Math.min(3, Math.floor(sorted.length / 2) || 1);
  const avg = (xs: { value: number }[]) => xs.reduce((s, x) => s + x.value, 0) / xs.length;
  const diff = avg(sorted.slice(-k)) - avg(sorted.slice(0, k));
  return diff <= -0.3 ? 'down' : diff >= 0.3 ? 'up' : 'steady';
}

/** Only what the member chose to share; nothing else leaves the phone. */
export function buildSummary(f: LocalFacts, share: ShareSettings): BuddySummary {
  const week = Array.from({ length: 7 }, (_, i) => addDays(f.today, -i));
  const out: BuddySummary = { loggedToday: f.foodDays.includes(f.today) };
  if (share.steps && f.stepsToday != null) {
    out.steps = Math.round(f.stepsToday);
    out.stepGoal = f.stepGoal;
  }
  if (share.workouts) {
    out.workoutsWeek = new Set(f.workoutDays.filter((d) => week.includes(d))).size;
    out.workoutToday = f.workoutDays.includes(f.today);
  }
  if (share.water && f.waterTarget > 0) {
    out.waterDaysWeek = week.filter((d) => (f.waterByDay[d] ?? 0) >= f.waterTarget).length;
    out.waterPct = Math.min(100, Math.round(((f.waterByDay[f.today] ?? 0) / f.waterTarget) * 100));
  }
  if (share.streak) out.streak = loggingStreak(f.foodDays, f.today);
  if (share.weightTrend && !f.gentle) {
    const t = weightTrend(f.weights.filter((w) => w.date >= addDays(f.today, -13)));
    if (t) out.weightTrend = t;
  }
  return out;
}
