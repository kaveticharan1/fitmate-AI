import { applyReading, EMPTY_LEDGER, splitByDay, stepsOn } from './ledger';

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
    expect(splitByDay(100, t(10, 22), t(11, 2))).toEqual({ '2026-11-10': 50, '2026-11-11': 50 });
    expect(splitByDay(0, t(10, 1), t(10, 2))).toEqual({});
  });
});
