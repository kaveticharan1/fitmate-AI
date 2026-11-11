/**
 * Turns readings of the phone's hardware step counter into steps per hour
 * (and from those, per day).
 *
 * The counter is a running total since the phone started. Each new reading
 * adds (total − last total) to the hours between the two readings. After a
 * restart the counter begins again from 0, so the new total itself is the
 * steps since the restart.
 *
 * Placing steps in hours: while a screen is open, readings come on every
 * step, so hours are exact. Between background readings (about every 30
 * minutes) steps are spread evenly over the gap. After a long gap (the phone
 * was idle overnight, say), spreading would invent night-time walks, so the
 * steps are placed just before the reading at an ordinary walking pace.
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
  /** Steps counted per local hour (YYYY-MM-DDTHH), last few days. */
  hours: Record<string, number>;
}

export interface Reading {
  total: number;
  bootMs: number;
  at: number;
}

export const EMPTY_LEDGER: StepLedger = { lastTotal: null, lastAt: 0, bootMs: null, days: {}, hours: {} };

/** A person can't walk more than about 4 steps a second; anything above is a sensor glitch. */
const MAX_STEPS_PER_SEC = 4;
const KEEP_DAYS = 35;
const KEEP_HOURS_DAYS = 8;
const REBOOT_TOLERANCE_MS = 2 * 60 * 1000;
/** Gaps longer than this are treated as "idle, then a walk just before the reading". */
export const LONG_GAP_MS = 75 * 60 * 1000;
/** Ordinary walking pace used to place steps after a long gap. */
export const WALK_STEPS_PER_MIN = 100;

const pad = (n: number) => String(n).padStart(2, '0');

export function localDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local hour key, e.g. 2026-11-11T07 for 7:00–7:59. */
export function localHour(ms: number): string {
  return `${localDay(ms)}T${pad(new Date(ms).getHours())}`;
}

function nextHour(ms: number): number {
  const d = new Date(ms);
  d.setMinutes(60, 0, 0);
  return d.getTime();
}

/** Splits `steps` over [from, to) in proportion to the time spent in each local hour. */
export function splitByHour(steps: number, from: number, to: number): Record<string, number> {
  const out: Record<string, number> = {};
  if (steps <= 0) return out;
  if (to <= from) {
    out[localHour(to)] = steps;
    return out;
  }
  const span = to - from;
  let start = from;
  let given = 0;
  while (start < to) {
    const end = Math.min(nextHour(start), to);
    const hour = localHour(start);
    const share = end >= to ? steps - given : Math.round((steps * (end - start)) / span);
    out[hour] = (out[hour] ?? 0) + share;
    given += share;
    start = end;
  }
  return out;
}

/** Where `steps` taken between `from` and `to` most likely happened, by hour. */
export function allocate(steps: number, from: number, to: number): Record<string, number> {
  if (to - from <= LONG_GAP_MS) return splitByHour(steps, from, to);
  const walkMs = (steps / WALK_STEPS_PER_MIN) * 60000;
  return splitByHour(steps, Math.max(from, to - walkMs), to);
}

function addHours(ledger: StepLedger, add: Record<string, number>): Pick<StepLedger, 'days' | 'hours'> {
  const hours = { ...ledger.hours };
  const days = { ...ledger.days };
  for (const [h, n] of Object.entries(add)) {
    hours[h] = (hours[h] ?? 0) + n;
    const d = h.slice(0, 10);
    days[d] = (days[d] ?? 0) + n;
  }
  return { days, hours };
}

function prune(l: Pick<StepLedger, 'days' | 'hours'>, nowMs: number): Pick<StepLedger, 'days' | 'hours'> {
  const oldestDay = localDay(nowMs - KEEP_DAYS * 86400000);
  const oldestHour = localDay(nowMs - KEEP_HOURS_DAYS * 86400000);
  return {
    days: Object.fromEntries(Object.entries(l.days).filter(([d, n]) => d >= oldestDay && n > 0)),
    hours: Object.fromEntries(Object.entries(l.hours).filter(([h, n]) => h >= oldestHour && n > 0)),
  };
}

/** Adds one reading to the ledger and returns the new ledger. Never mutates its input. */
export function applyReading(ledger: StepLedger, r: Reading): StepLedger {
  const base: StepLedger = { ...ledger, hours: ledger.hours ?? {} };
  const total = Math.max(0, Math.floor(r.total));

  if (base.lastTotal == null) {
    // First reading ever: if the phone started today, all its steps are today's.
    const counted = localDay(r.bootMs) === localDay(r.at) && total > 0 ? addHours(base, allocate(total, Math.max(r.bootMs, r.at - 86400000), r.at)) : base;
    return { lastTotal: total, lastAt: r.at, bootMs: r.bootMs, ...prune(counted, r.at) };
  }

  if (r.at < base.lastAt) return ledger; // out-of-order reading

  const rebooted = total < base.lastTotal || (base.bootMs != null && Math.abs(r.bootMs - base.bootMs) > REBOOT_TOLERANCE_MS && r.bootMs > base.lastAt);
  const delta = rebooted ? total : total - base.lastTotal;
  const from = rebooted ? Math.max(base.lastAt, r.bootMs) : base.lastAt;
  const maxPossible = Math.max(0, ((r.at - from) / 1000) * MAX_STEPS_PER_SEC);

  const counted = delta > 0 && delta <= maxPossible + 50 ? addHours(base, allocate(delta, from, r.at)) : base;
  return { lastTotal: total, lastAt: r.at, bootMs: r.bootMs, ...prune(counted, r.at) };
}

/** Steps counted on `day` (YYYY-MM-DD). */
export function stepsOn(ledger: StepLedger, day: string): number {
  return ledger.days[day] ?? 0;
}

/** 24 numbers: steps in each hour of `day` (0 = midnight–1 AM). */
export function hoursOf(hours: Record<string, number>, day: string): number[] {
  return Array.from({ length: 24 }, (_, h) => hours[`${day}T${pad(h)}`] ?? 0);
}
