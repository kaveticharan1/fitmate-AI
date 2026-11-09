import { buildSmartNudges, DEFAULT_SMART, findGaps, inQuietHours, type DayStatus } from './smart';

const base: DayStatus = {
  now: new Date(2026, 10, 10, 12, 0),
  foodEntries: 3,
  proteinG: 60,
  proteinTarget: 138,
  waterMl: 1500,
  waterTarget: 3000,
  steps: 3000,
  stepGoal: 8000,
  workoutToday: false,
  gentle: false,
};
const all = { ...DEFAULT_SMART, checkIn: true, logNudge: true, morning: true, weighIn: true };

describe('smart reminders', () => {
  it('are all off by default', () => {
    expect(buildSmartNudges(DEFAULT_SMART, base)).toEqual([]);
  });

  it('name the biggest gaps, at most two', () => {
    expect(findGaps(base)).toEqual(['protein', 'water']);
    expect(findGaps({ ...base, proteinG: 130, waterMl: 2800 })).toEqual(['steps']);
    expect(findGaps({ ...base, proteinG: 130, waterMl: 2800, steps: 7000 })).toEqual([]);
    expect(findGaps({ ...base, proteinG: 130, waterMl: 2800, steps: null })).toEqual(['move']);
    expect(findGaps({ ...base, proteinG: 130, waterMl: 2800, steps: null, workoutToday: true })).toEqual([]);
  });

  it('never nudge about food numbers with eating-disorder history', () => {
    expect(findGaps({ ...base, gentle: true })).toEqual(['water', 'steps']);
  });

  it('schedule tonight’s check-in with what is still short', () => {
    const [n] = buildSmartNudges({ ...DEFAULT_SMART, checkIn: true }, base);
    expect(n).toEqual({
      id: 'smart-checkin',
      kind: 'checkIn',
      when: { date: new Date(2026, 10, 10, 19, 30) },
      gaps: ['protein', 'water'],
      generic: false,
      params: { proteinLeft: 78, waterLeft: 6, stepsLeft: 5000 },
    });
  });

  it('stay quiet on a day that is on track', () => {
    const onTrack = { ...base, proteinG: 130, waterMl: 2900, steps: 9000 };
    expect(buildSmartNudges({ ...DEFAULT_SMART, checkIn: true }, onTrack)).toEqual([]);
  });

  it('send a gentle check-in when nothing is logged, and prepare tomorrow after the time passes', () => {
    const empty = buildSmartNudges({ ...DEFAULT_SMART, checkIn: true }, { ...base, foodEntries: 0 });
    expect(empty[0]).toMatchObject({ generic: true, gaps: [] });
    const late = buildSmartNudges({ ...DEFAULT_SMART, checkIn: true }, { ...base, now: new Date(2026, 10, 10, 21, 0) });
    expect(late[0]!.when).toEqual({ date: new Date(2026, 10, 11, 19, 30) });
  });

  it('nudge to log at 2 pm only if nothing is logged yet', () => {
    const morningEmpty = buildSmartNudges({ ...DEFAULT_SMART, logNudge: true }, { ...base, now: new Date(2026, 10, 10, 9, 0), foodEntries: 0 });
    expect(morningEmpty[0]!.when).toEqual({ date: new Date(2026, 10, 10, 14, 0) });
    const logged = buildSmartNudges({ ...DEFAULT_SMART, logNudge: true }, { ...base, now: new Date(2026, 10, 10, 9, 0) });
    expect(logged[0]!.when).toEqual({ date: new Date(2026, 10, 11, 14, 0) });
  });

  it('add the daily morning plan and Sunday weigh-in', () => {
    const kinds = buildSmartNudges(all, base).map((n) => [n.kind, n.when]);
    expect(kinds).toContainEqual(['morning', { daily: { hour: 8, minute: 0 } }]);
    expect(kinds).toContainEqual(['weighIn', { weekly: { weekday: 1, hour: 7, minute: 30 } }]);
  });

  it('fall back to 19:30 for a broken time', () => {
    const [n] = buildSmartNudges({ ...DEFAULT_SMART, checkIn: true, checkInTime: '99:99' }, base);
    expect(n!.when).toEqual({ date: new Date(2026, 10, 10, 19, 30) });
  });
});

describe('smart reminders (agent)', () => {
  const now = new Date(2026, 10, 10, 9, 0);
  const ids = (ns: { id: string }[]) => ns.map((n) => n.id);

  it('skip a meal reminder once that meal is logged', () => {
    const cfg = { ...DEFAULT_SMART, meals: true, quiet: { enabled: false, start: '22:00', end: '07:00' } };
    const r = buildSmartNudges(cfg, { ...base, now, mealsLogged: ['breakfast'] });
    expect(ids(r)).not.toContain('smart-meal-breakfast-today');
    expect(ids(r)).toContain('smart-meal-lunch-today');
    expect(ids(r)).toContain('smart-meal-breakfast-d1');
  });

  it('skip the workout reminder after a workout', () => {
    const cfg = { ...DEFAULT_SMART, workout: true };
    expect(ids(buildSmartNudges(cfg, { ...base, now, workoutToday: false }))).toContain('smart-workout-today');
    expect(ids(buildSmartNudges(cfg, { ...base, now, workoutToday: true }))).not.toContain('smart-workout-today');
  });

  it('stop today’s water reminders once the target is reached', () => {
    const water = { enabled: true, startHour: 8, endHour: 12, everyHours: 1 as const };
    const cfg = { ...DEFAULT_SMART, dailyLimit: 10 };
    const below = buildSmartNudges(cfg, { ...base, now, waterMl: 500 }, water);
    expect(ids(below)).toEqual(expect.arrayContaining(['smart-water-d0-10', 'smart-water-d0-12', 'smart-water-d1-8']));
    expect(ids(below)).not.toContain('smart-water-d0-8'); // already past
    const reached = buildSmartNudges(cfg, { ...base, now, waterMl: 3200 }, water);
    expect(ids(reached).some((i) => i.startsWith('smart-water-d0'))).toBe(false);
    expect(ids(reached)).toContain('smart-water-d1-8');
  });

  it('respect quiet hours, including windows that cross midnight', () => {
    expect(inQuietHours(23, 0, { enabled: true, start: '22:45', end: '07:00' })).toBe(true);
    expect(inQuietHours(6, 59, { enabled: true, start: '22:45', end: '07:00' })).toBe(true);
    expect(inQuietHours(7, 0, { enabled: true, start: '22:45', end: '07:00' })).toBe(false);
    expect(inQuietHours(13, 0, { enabled: true, start: '13:00', end: '15:00' })).toBe(true);
    expect(inQuietHours(23, 0, { enabled: false, start: '22:45', end: '07:00' })).toBe(false);
    const cfg = { ...DEFAULT_SMART, bedtime: true, bedtimeTime: '23:30' };
    expect(ids(buildSmartNudges(cfg, { ...base, now }))).not.toContain('smart-bedtime');
  });

  it('cap reminders per day, counting water as one', () => {
    const cfg = { ...DEFAULT_SMART, dailyLimit: 3, meals: true, workout: true, faceCheckIn: true, quiet: { enabled: false, start: '22:00', end: '07:00' } };
    const water = { enabled: true, startHour: 10, endHour: 20, everyHours: 1 as const };
    const r = buildSmartNudges(cfg, { ...base, now, waterMl: 0 }, water);
    const today = r.filter((n) => 'date' in n.when && n.when.date.getDate() === 10);
    const nonWater = today.filter((n) => n.kind !== 'water');
    expect(nonWater.length + (today.some((n) => n.kind === 'water') ? 1 : 0)).toBeLessThanOrEqual(3);
  });
});
