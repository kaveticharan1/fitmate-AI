/** Current time as an ISO-8601 UTC string, for created_at/updated_at columns. */
export const nowIso = (d: Date = new Date()) => d.toISOString();

/** The user's local calendar date as YYYY-MM-DD (so "today" means their today, not UTC's). */
export function localDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Formats YYYY-MM-DD as DD-MM-YYYY for display in forms. */
export function isoToDisplayDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}

/** Adds days to a YYYY-MM-DD date (calendar arithmetic, no time zones involved). */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
