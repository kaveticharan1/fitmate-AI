import { DEFAULT_SMART, type SmartConfig } from './smart';

/** Reminder settings, stored in app_settings under REMINDERS_KEY. */
export interface ReminderConfig {
  water: { enabled: boolean; startHour: number; endHour: number; everyHours: 1 | 2 };
  medicines: { id: string; name: string; time: string }[];
  /** Your own daily reminders ("Evening walk 18:30"), also created by the coach after you confirm. */
  custom?: { id: string; label: string; time: string }[];
  /** Added in v0.12; older saved settings don't have it. */
  smart?: SmartConfig;
}

export const REMINDERS_KEY = 'reminders.v1';

export const DEFAULT_REMINDERS: ReminderConfig = {
  water: { enabled: false, startHour: 8, endHour: 21, everyHours: 1 },
  medicines: [],
  custom: [],
  smart: DEFAULT_SMART,
};

/** Saved settings with any missing (newer) parts filled from the defaults. */
export function withDefaults(c: Partial<ReminderConfig> | null | undefined): ReminderConfig {
  return {
    water: { ...DEFAULT_REMINDERS.water, ...(c?.water ?? {}) },
    medicines: c?.medicines ?? [],
    custom: c?.custom ?? [],
    smart: { ...DEFAULT_SMART, ...(c?.smart ?? {}) },
  };
}

export interface PlannedNotification {
  id: string;
  kind: 'water' | 'medicine' | 'custom';
  hour: number;
  minute: number;
  /** Medicine name, shown only when the phone is unlocked. */
  label?: string;
}

/** "07:30" / "7:30" → {hour, minute}, or null if invalid. */
export function parseTime(text: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  return hour <= 23 && minute <= 59 ? { hour, minute } : null;
}

/** Every daily notification the settings ask for. Pure, so it can be tested without a phone. */
export function buildSchedule(c: ReminderConfig): PlannedNotification[] {
  const out: PlannedNotification[] = [];
  if (c.water.enabled && c.water.endHour >= c.water.startHour) {
    for (let h = c.water.startHour; h <= c.water.endHour; h += c.water.everyHours) {
      out.push({ id: `water-${h}`, kind: 'water', hour: h, minute: 0 });
    }
  }
  for (const med of c.medicines) {
    const t = parseTime(med.time);
    if (t && med.name.trim()) out.push({ id: `med-${med.id}`, kind: 'medicine', ...t, label: med.name.trim() });
  }
  for (const r of c.custom ?? []) {
    const t = parseTime(r.time);
    if (t && r.label.trim()) out.push({ id: `custom-${r.id}`, kind: 'custom', ...t, label: r.label.trim() });
  }
  return out;
}
