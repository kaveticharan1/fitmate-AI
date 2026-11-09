/** A dated measurement (date = local YYYY-MM-DD). */
export interface Point {
  date: string;
  value: number;
}

const dayNumber = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Trailing 7-day average at each measurement: the mean of all points within
 * the 7 days up to and including that date. Smooths out daily water-weight swings.
 */
export function rollingAverage(points: Point[], days = 7): Point[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((p) => {
    const end = dayNumber(p.date);
    const window = sorted.filter((q) => {
      const d = dayNumber(q.date);
      return d <= end && d > end - days;
    });
    return { date: p.date, value: round1(window.reduce((s, q) => s + q.value, 0) / window.length) };
  });
}

/**
 * Change per week from a least-squares line through the points (positive = gaining).
 * Null with fewer than 2 points or under 7 days of data, where a trend means little.
 */
export function weeklyRate(points: Point[]): number | null {
  if (points.length < 2) return null;
  const xs = points.map((p) => dayNumber(p.date));
  const span = Math.max(...xs) - Math.min(...xs);
  if (span < 7) return null;
  const ys = points.map((p) => p.value);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  return den === 0 ? null : Math.round((num / den) * 7 * 100) / 100;
}

export interface WeekSummary {
  daysLogged: number;
  avgKcal: number | null;
  avgProtein: number | null;
  /** Days within ±10% of the calorie target. */
  daysOnTarget: number;
  /** Days reaching at least 90% of the protein target. */
  daysProteinMet: number;
}

/** Summary of daily food totals; only days with something logged count (missing ≠ zero). */
export function summariseWeek(
  days: { date: string; kcal: number; protein: number }[],
  targets: { kcal: number; protein: number },
): WeekSummary {
  const logged = days.filter((d) => d.kcal > 0);
  if (logged.length === 0) return { daysLogged: 0, avgKcal: null, avgProtein: null, daysOnTarget: 0, daysProteinMet: 0 };
  return {
    daysLogged: logged.length,
    avgKcal: Math.round(logged.reduce((s, d) => s + d.kcal, 0) / logged.length),
    avgProtein: Math.round(logged.reduce((s, d) => s + d.protein, 0) / logged.length),
    daysOnTarget: logged.filter((d) => Math.abs(d.kcal - targets.kcal) <= targets.kcal * 0.1).length,
    daysProteinMet: logged.filter((d) => d.protein >= targets.protein * 0.9).length,
  };
}
