const dayNum = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
};

/** "HH:MM" → minutes after midnight, or null. */
export function clockMinutes(text: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h <= 23 && min <= 59 ? h * 60 + min : null;
}

/** Minutes slept from bedtime to wake time, crossing midnight when needed (e.g. 23:30 → 06:30 = 420). */
export function sleepMinutes(bed: string, wake: string): number | null {
  const b = clockMinutes(bed);
  const w = clockMinutes(wake);
  if (b == null || w == null) return null;
  const mins = (w - b + 1440) % 1440;
  return mins === 0 ? null : mins;
}

/**
 * Forgiving streak: consecutive days with the habit done, counting back from today.
 * Today not done yet doesn't break it, and a single missed day between done days is
 * forgiven — only two missed days in a row end the streak.
 */
export function forgivingStreak(doneDates: string[], today: string): number {
  const done = new Set(doneDates.map(dayNum));
  let day = dayNum(today);
  if (!done.has(day)) day -= 1;
  let streak = 0;
  let misses = 0;
  while (true) {
    if (done.has(day)) {
      streak += 1;
      misses = 0;
    } else {
      misses += 1;
      if (misses >= 2 || !done.has(day - 1)) break;
    }
    day -= 1;
  }
  return streak;
}

/** Share of days (0–1) a habit was done within the last `days` days including today. */
export function completionRate(doneDates: string[], today: string, days: number): number {
  const end = dayNum(today);
  const n = new Set(doneDates.map(dayNum).filter((d) => d <= end && d > end - days)).size;
  return n / days;
}
