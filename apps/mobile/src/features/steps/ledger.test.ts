import { allocate, applyReading, EMPTY_LEDGER, hoursOf, splitByHour, stepsOn, type StepLedger } from './ledger';

const t = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime();
const boot = t(1, 6); // phone started on the 1st

describe('step ledger', () => {
  it('counts the difference between readings', () => {
    let l = applyReading(EMPTY_LEDGER, { total: 10000, bootMs: boot, at: t(10, 8) });
    expect(stepsOn(l, '2026-11-10')).toBe(0); // can't know steps before the first reading
    l = applyReading(l, { total: 12500, bootMs: boot, at: t(10, 9) });
    l = applyReading(l, { total: 13000, bootMs: boot, at: t(10, 10) });
    expect(stepsOn(l, '2026-11-10')).toBe(3000);
  });

  it('gives a phone started today all its steps on the first reading', () => {
    const l = applyReading(EMPTY_LEDGER, { total: 1800, bootMs: t(10, 7), at: t(10, 9) });
    expect(stepsOn(l, '2026-11-10')).toBe(1800);
  });

  it('splits a walk across midnight', () => {
    let l = applyReading(EMPTY_LEDGER, { total: 5000, bootMs: boot, at: t(10, 23, 30) });
    l = applyReading(l, { total: 6000, bootMs: boot, at: t(11, 0, 30) });
    expect(stepsOn(l, '2026-11-10')).toBe(500);
    expect(stepsOn(l, '2026-11-11')).toBe(500);
  });

  it('handles a phone restart: the counter starts again from zero', () => {
    let l = applyReading(EMPTY_LEDGER, { total: 9000, bootMs: boot, at: t(10, 9) });
    l = applyReading(l, { total: 300, bootMs: t(10, 12), at: t(10, 13) });
    expect(stepsOn(l, '2026-11-10')).toBe(300);
    l = applyReading(l, { total: 1300, bootMs: t(10, 12), at: t(10, 14) });
    expect(stepsOn(l, '2026-11-10')).toBe(1300);
  });

  it('ignores impossible jumps and out-of-order readings', () => {
    let l = applyReading(EMPTY_LEDGER, { total: 1000, bootMs: boot, at: t(10, 9) });
    l = applyReading(l, { total: 90000, bootMs: boot, at: t(10, 9, 5) }); // 89,000 steps in 5 minutes
    expect(stepsOn(l, '2026-11-10')).toBe(0);
    const same = applyReading(l, { total: 95000, bootMs: boot, at: t(10, 8) });
    expect(same).toBe(l);
  });

  it('keeps about five weeks of days', () => {
    let l = applyReading(EMPTY_LEDGER, { total: 0, bootMs: boot, at: t(1, 8) });
    l = applyReading(l, { total: 2000, bootMs: boot, at: t(1, 9) });
    l = applyReading({ ...l, lastAt: new Date(2026, 11, 20).getTime() - 1000 }, { total: 2100, bootMs: boot, at: new Date(2026, 11, 20).getTime() });
    expect(l.days['2026-11-01']).toBeUndefined();
  });

  it('splits by time share', () => {
    expect(splitByHour(100, t(10, 22, 30), t(10, 23, 30))).toEqual({ '2026-11-10T22': 50, '2026-11-10T23': 50 });
    expect(splitByHour(0, t(10, 1), t(10, 2))).toEqual({});
  });
});

describe('hourly steps', () => {
  it('logs each hour exactly when readings are frequent (screen open)', () => {
    let l = applyReading(EMPTY_LEDGER, { total: 1000, bootMs: boot, at: t(11, 7, 0) });
    for (const [h, m, total] of [[7, 20, 1800], [7, 55, 2600], [8, 10, 3100], [9, 30, 3150]] as const) l = applyReading(l, { total, bootMs: boot, at: t(11, h, m) });
    const hours = hoursOf(l.hours, '2026-11-11');
    // 7:00–7:55 = 1,600; 7:55–8:10 = 500 split 5 min / 10 min; 8:10–9:30 is a long gap, so its 50 steps go just before 9:30.
    expect(hours[7]).toBe(1600 + 167);
    expect(hours[8]).toBe(333);
    expect(hours[9]).toBe(50);
    expect(hours.reduce((a, b) => a + b, 0)).toBe(stepsOn(l, '2026-11-11'));
  });

  it('never invents night-time walks after a long idle gap', () => {
    let l = applyReading(EMPTY_LEDGER, { total: 5000, bootMs: boot, at: t(10, 22, 0) });
    l = applyReading(l, { total: 7000, bootMs: boot, at: t(11, 8, 30) }); // 2,000 steps, last reading 10.5 h ago
    expect(hoursOf(l.hours, '2026-11-11').slice(0, 8).reduce((a, b) => a + b, 0)).toBe(0);
    expect(hoursOf(l.hours, '2026-11-11')[8]).toBe(2000); // placed 8:10–8:30 at walking pace
    expect(stepsOn(l, '2026-11-10')).toBe(0);
  });

  it('places a long walk over the hours before the reading', () => {
    // 9,000 steps at 100/min = 90 minutes before 10:00
    expect(allocate(9000, t(11, 0), t(11, 10))).toEqual({ '2026-11-11T08': 3000, '2026-11-11T09': 6000 });
  });

  it('keeps day totals equal to the sum of hours', () => {
    let l = applyReading(EMPTY_LEDGER, { total: 0, bootMs: boot, at: t(10, 23, 40) });
    l = applyReading(l, { total: 600, bootMs: boot, at: t(11, 0, 20) });
    expect(stepsOn(l, '2026-11-10') + stepsOn(l, '2026-11-11')).toBe(600);
    expect(hoursOf(l.hours, '2026-11-10')[23]! + hoursOf(l.hours, '2026-11-11')[0]!).toBe(600);
  });

  it('upgrades a ledger saved before hourly logs', () => {
    const old = { lastTotal: 100, lastAt: t(11, 9), bootMs: boot, days: { '2026-11-11': 50 } } as unknown as StepLedger;
    const l = applyReading(old, { total: 300, bootMs: boot, at: t(11, 9, 30) });
    expect(l.hours['2026-11-11T09']).toBe(200);
    expect(stepsOn(l, '2026-11-11')).toBe(250);
  });

  it('keeps about a week of hours in the ledger', () => {
    let l = applyReading(EMPTY_LEDGER, { total: 0, bootMs: boot, at: t(1, 8) });
    l = applyReading(l, { total: 500, bootMs: boot, at: t(1, 8, 30) });
    l = applyReading({ ...l, lastAt: t(20, 8) - 1000 }, { total: 510, bootMs: boot, at: t(20, 8) });
    expect(l.hours['2026-11-01T08']).toBeUndefined();
    expect(l.days['2026-11-01']).toBe(500);
  });
});
