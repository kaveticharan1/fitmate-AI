import { buildSmartNudges, DEFAULT_SMART, findGaps, type DayStatus } from './smart';

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
