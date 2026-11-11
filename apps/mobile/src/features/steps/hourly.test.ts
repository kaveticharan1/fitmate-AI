import { hourLabel, mergeHours, summarizeHours } from './hourly';

const day = (pairs: [number, number][]) => {
  const h = Array.from({ length: 24 }, () => 0);
  for (const [i, n] of pairs) h[i] = n;
  return h;
};

describe('hourly summary', () => {
  it('finds the total, busiest hour and active hours, latest first', () => {
    const s = summarizeHours(day([[7, 2140], [8, 600], [13, 120], [19, 3000]]));
    expect(s.total).toBe(5860);
    expect(s.busiest).toEqual({ hour: 19, steps: 3000 });
    expect(s.activeHours).toBe(3);
    expect(s.hours.map((h) => h.hour)).toEqual([19, 13, 8, 7]);
  });
  it('copes with an empty day', () => {
    expect(summarizeHours(day([]))).toEqual({ total: 0, hours: [], busiest: null, activeHours: 0 });
  });
  it('labels hours in 12-hour time', () => {
    expect([0, 7, 12, 13, 23].map(hourLabel)).toEqual(['12 AM', '7 AM', '12 PM', '1 PM', '11 PM']);
  });
  it('keeps the newer (larger) count for each hour', () => {
    expect(mergeHours(day([[7, 100]]), day([[7, 150], [8, 40]])).slice(7, 9)).toEqual([150, 40]);
  });
});
