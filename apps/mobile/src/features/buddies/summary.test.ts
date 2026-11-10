import { buildSummary, DEFAULT_SHARE, loggingStreak, weightTrend, type LocalFacts } from './summary';

const facts = (over: Partial<LocalFacts> = {}): LocalFacts => ({
  today: '2026-11-10',
  stepsToday: 6400,
  stepGoal: 8000,
  workoutDays: ['2026-11-10', '2026-11-08', '2026-11-08', '2026-10-30'],
  waterByDay: { '2026-11-10': 1500, '2026-11-09': 3000, '2026-11-08': 3200 },
  waterTarget: 3000,
  foodDays: ['2026-11-10', '2026-11-09', '2026-11-08', '2026-11-06'],
  weights: [
    { date: '2026-10-28', value: 75 },
    { date: '2026-11-03', value: 74.6 },
    { date: '2026-11-09', value: 74.2 },
  ],
  gentle: false,
  ...over,
});

describe('buddy summary', () => {
  it('shares only the chosen numbers and never weight by default', () => {
    expect(buildSummary(facts(), DEFAULT_SHARE)).toEqual({
      loggedToday: true,
      steps: 6400,
      stepGoal: 8000,
      workoutsWeek: 2,
      workoutToday: true,
      waterDaysWeek: 2,
      waterPct: 50,
      streak: 3,
    });
  });

  it('respects every switch being off', () => {
    expect(buildSummary(facts(), { steps: false, workouts: false, water: false, streak: false, weightTrend: false })).toEqual({ loggedToday: true });
  });

  it('shares only a weight direction when allowed, and never in gentle mode', () => {
    expect(buildSummary(facts(), { ...DEFAULT_SHARE, weightTrend: true }).weightTrend).toBe('down');
    expect(buildSummary(facts({ gentle: true }), { ...DEFAULT_SHARE, weightTrend: true }).weightTrend).toBeUndefined();
    expect(JSON.stringify(buildSummary(facts(), { ...DEFAULT_SHARE, weightTrend: true }))).not.toMatch(/74|75/);
  });

  it('leaves steps out when they are not tracked', () => {
    expect(buildSummary(facts({ stepsToday: null }), DEFAULT_SHARE).steps).toBeUndefined();
  });
});

describe('helpers', () => {
  it('counts the logging streak from today or yesterday', () => {
    expect(loggingStreak(['2026-11-10', '2026-11-09'], '2026-11-10')).toBe(2);
    expect(loggingStreak(['2026-11-09', '2026-11-08'], '2026-11-10')).toBe(2);
    expect(loggingStreak([], '2026-11-10')).toBe(0);
  });
  it('calls small changes steady', () => {
    expect(weightTrend([{ date: 'a', value: 70 }, { date: 'b', value: 70.2 }])).toBe('steady');
    expect(weightTrend([{ date: 'a', value: 70 }, { date: 'b', value: 71 }])).toBe('up');
    expect(weightTrend([{ date: 'a', value: 70 }])).toBeUndefined();
  });
});
