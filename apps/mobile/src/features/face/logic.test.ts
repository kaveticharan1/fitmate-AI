import { averagePuffiness, escalation, findAssociations, type CheckinPoint, type DayLifestyle } from './logic';

const c = (day: string, puffiness: number, extra: Partial<CheckinPoint> = {}): CheckinPoint => ({ day, puffiness, symptoms: [], saltyYesterday: null, alcoholYesterday: null, ...extra });
const days = (n: number) => Array.from({ length: n }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`);

describe('face wellness logic', () => {
  it('sends emergencies first and suggests a doctor for pain or persistent puffiness', () => {
    expect(escalation(c('2026-11-10', 1, { symptoms: ['lips_tongue_throat'] }), [])).toBe('emergency');
    expect(escalation(c('2026-11-10', 1, { symptoms: ['breathing'] }), [])).toBe('emergency');
    expect(escalation(c('2026-11-10', 1, { symptoms: ['pain'] }), [])).toBe('doctor');
    const persistent = days(7).map((d) => c(d, 2));
    expect(escalation(persistent[6]!, persistent)).toBe('doctor');
    const sudden = [c('2026-11-01', 0), c('2026-11-02', 1), c('2026-11-03', 0), c('2026-11-04', 3)];
    expect(escalation(sudden[3]!, sudden)).toBe('doctor');
    const ordinary = [c('2026-11-01', 1), c('2026-11-02', 2), c('2026-11-03', 1)];
    expect(escalation(ordinary[2]!, ordinary)).toBeNull();
    expect(escalation(null, [])).toBeNull();
  });

  it('averages puffiness', () => {
    expect(averagePuffiness([{ puffiness: 1 }, { puffiness: 2 }, { puffiness: 2 }])).toBe(1.7);
    expect(averagePuffiness([])).toBeNull();
  });

  it('finds a short-sleep association only with enough days on both sides', () => {
    const ds = days(8);
    const checkins = ds.map((d, i) => c(d, i < 4 ? 2 : 0));
    const life = new Map<string, DayLifestyle>(ds.map((d, i) => [d, { sleepMin: i < 4 ? 330 : 470, waterPrevMl: null, saltyPrev: null }]));
    const r = findAssociations(checkins, life, 3000);
    expect(r).toEqual([{ factor: 'short_sleep', withAvg: 2, withoutAvg: 0, withDays: 4, withoutDays: 4 }]);
    // Two days are not enough to say anything.
    expect(findAssociations(checkins.slice(2, 6), life, 3000)).toEqual([]);
  });

  it('never treats missing data as zero', () => {
    const ds = days(8);
    const checkins = ds.map((d) => c(d, 2));
    const life = new Map<string, DayLifestyle>(ds.map((d) => [d, { sleepMin: null, waterPrevMl: null, saltyPrev: null }]));
    expect(findAssociations(checkins, life, 3000)).toEqual([]);
  });

  it('prefers the user’s own salty-food answer over the diary guess', () => {
    const ds = days(6);
    const checkins = ds.map((d, i) => c(d, i < 3 ? 2 : 0, { saltyYesterday: i < 3 ? 1 : 0 }));
    const life = new Map<string, DayLifestyle>(ds.map((d) => [d, { sleepMin: null, waterPrevMl: null, saltyPrev: false }]));
    expect(findAssociations(checkins, life, 3000).map((a) => a.factor)).toEqual(['salty_food']);
  });

  it('ignores small differences', () => {
    const ds = days(8);
    const checkins = ds.map((d, i) => c(d, i % 2));
    const life = new Map<string, DayLifestyle>(ds.map((d, i) => [d, { sleepMin: i < 4 ? 330 : 470, waterPrevMl: null, saltyPrev: null }]));
    expect(findAssociations(checkins, life, 3000)).toEqual([]);
  });
});
