/**
 * Turns readings of the phone's hardware step counter into steps per day.
 *
 * The counter is a running total since the phone started. Each new reading
 * adds (total − last total) to the days between the two readings, split by
 * time if a walk crosses midnight. After a restart the counter begins again
 * from 0, so the new total itself is the steps since the restart.
 */
export interface StepLedger {
  /** Last running total seen, or null before the first reading. */
  lastTotal: number | null;
  /** When the last reading was taken (ms). */
  lastAt: number;
  /** When the phone last started, as of the last reading (ms). */
  bootMs: number | null;
  /** Steps counted per local day (YYYY-MM-DD). */
  days: Record<string, number>;
}

export interface Reading {
  total: number;
  bootMs: number;
  at: number;
}

export const EMPTY_LEDGER: StepLedger = { lastTotal: null, lastAt: 0, bootMs: null, days: {} };

/** A person can't walk more than about 4 steps a second; anything above is a sensor glitch. */
const MAX_STEPS_PER_SEC = 4;
const KEEP_DAYS = 35;
const REBOOT_TOLERANCE_MS = 2 * 60 * 1000;

export function localDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nextMidnight(ms: number): number {
  const d = new Date(ms);
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}

/** Splits `steps` over [from, to) in proportion to the time spent in each local day. */
export function splitByDay(steps: number, from: number, to: number): Record<string, number> {
  const out: Record<string, number> = {};
  if (steps <= 0) return out;
  if (to <= from) {
    out[localDay(to)] = steps;
    return out;
  }
  const span = to - from;
  let start = from;
  let given = 0;
  while (start < to) {
    const end = Math.min(nextMidnight(start), to);
    const day = localDay(start);
    const share = end >= to ? steps - given : Math.round((steps * (end - start)) / span);
    out[day] = (out[day] ?? 0) + share;
    given += share;
    start = end;
  }
  return out;
}

function prune(days: Record<string, number>, nowMs: number): Record<string, number> {
  const oldest = localDay(nowMs - KEEP_DAYS * 86400000);
  return Object.fromEntries(Object.entries(days).filter(([d, n]) => d >= oldest && n > 0));
}

/** Adds one reading to the ledger and returns the new ledger. Never mutates its input. */
export function applyReading(ledger: StepLedger, r: Reading): StepLedger {
  const total = Math.max(0, Math.floor(r.total));
  const days = { ...ledger.days };

  if (ledger.lastTotal == null) {
    // First reading ever: if the phone started today, all its steps are today's.
    if (localDay(r.bootMs) === localDay(r.at) && total > 0) {
      for (const [d, n] of Object.entries(splitByDay(total, Math.max(r.bootMs, r.at - 86400000), r.at))) days[d] = (days[d] ?? 0) + n;
    }
    return { lastTotal: total, lastAt: r.at, bootMs: r.bootMs, days: prune(days, r.at) };
  }

  if (r.at < ledger.lastAt) return ledger; // out-of-order reading

  const rebooted = total < ledger.lastTotal || (ledger.bootMs != null && Math.abs(r.bootMs - ledger.bootMs) > REBOOT_TOLERANCE_MS && r.bootMs > ledger.lastAt);
  const delta = rebooted ? total : total - ledger.lastTotal;
  const from = rebooted ? Math.max(ledger.lastAt, r.bootMs) : ledger.lastAt;
  const maxPossible = Math.max(0, ((r.at - from) / 1000) * MAX_STEPS_PER_SEC);

  if (delta > 0 && delta <= maxPossible + 50) {
    for (const [d, n] of Object.entries(splitByDay(delta, from, r.at))) days[d] = (days[d] ?? 0) + n;
  }
  return { lastTotal: total, lastAt: r.at, bootMs: r.bootMs, days: prune(days, r.at) };
}

/** Steps counted on `day` (YYYY-MM-DD). */
export function stepsOn(ledger: StepLedger, day: string): number {
  return ledger.days[day] ?? 0;
}
