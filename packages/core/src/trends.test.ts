import { describe, expect, it } from 'vitest';
import { rollingAverage, summariseWeek, weeklyRate } from './trends';

describe('rollingAverage', () => {
  it('averages the last 7 days at each point', () => {
    const pts = [
      { date: '2026-11-01', value: 86 },
      { date: '2026-11-03', value: 85 },
      { date: '2026-11-08', value: 84 },
      { date: '2026-11-09', value: 85.5 },
    ];
    expect(rollingAverage(pts).map((p) => p.value)).toEqual([86, 85.5, 84.5, 84.8]);
  });
  it('sorts unsorted input', () => {
    expect(rollingAverage([{ date: '2026-11-02', value: 2 }, { date: '2026-11-01', value: 4 }])[0]!.date).toBe('2026-11-01');
  });
});

describe('weeklyRate', () => {
  it('finds a steady loss of 0.5 kg a week', () => {
    const pts = Array.from({ length: 5 }, (_, i) => ({ date: `2026-11-${String(1 + i * 7).padStart(2, '0')}`, value: 86 - 0.5 * i }));
    expect(weeklyRate(pts)).toBe(-0.5);
  });
  it('ignores noise-sized data', () => {
    expect(weeklyRate([{ date: '2026-11-01', value: 86 }])).toBeNull();
    expect(weeklyRate([{ date: '2026-11-01', value: 86 }, { date: '2026-11-03', value: 85 }])).toBeNull();
  });
});

describe('summariseWeek', () => {
  it('counts only logged days', () => {
    const s = summariseWeek(
      [
        { date: 'a', kcal: 1800, protein: 120 },
        { date: 'b', kcal: 2200, protein: 80 },
        { date: 'c', kcal: 0, protein: 0 },
      ],
      { kcal: 1800, protein: 120 },
    );
    expect(s).toEqual({ daysLogged: 2, avgKcal: 2000, avgProtein: 100, daysOnTarget: 1, daysProteinMet: 1 });
  });
  it('returns nulls with no data', () => {
    expect(summariseWeek([], { kcal: 1800, protein: 120 }).avgKcal).toBeNull();
  });
});
