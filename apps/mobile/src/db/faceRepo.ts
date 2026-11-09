import { and, asc, desc, eq, gte, isNull } from 'drizzle-orm';
import { nowIso } from '../lib/time';
import { getDb } from './client';
import { faceCheckins, facePhotos, type FaceCheckinRow, type FacePhotoRow } from './schema';

export interface CheckinInput {
  day: string;
  puffiness: number;
  areas: string[];
  timeOfDay: FaceCheckinRow['timeOfDay'];
  symptoms: string[];
  stress: number | null;
  saltyYesterday: boolean | null;
  alcoholYesterday: boolean | null;
  note: string | null;
}

export interface Checkin extends Omit<FaceCheckinRow, 'areas' | 'symptoms'> {
  areas: string[];
  symptoms: string[];
}

const list = (raw: string): string[] => {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};
const toCheckin = (r: FaceCheckinRow): Checkin => ({ ...r, areas: list(r.areas), symptoms: list(r.symptoms) });
const bool = (b: boolean | null) => (b == null ? null : b ? 1 : 0);

/** One check-in per day; saving again the same day updates it. */
export function saveCheckin(c: CheckinInput): void {
  if (!(c.puffiness >= 0 && c.puffiness <= 3)) throw new RangeError('puffiness');
  const now = nowIso();
  const values = {
    puffiness: Math.round(c.puffiness),
    areas: JSON.stringify(c.areas),
    timeOfDay: c.timeOfDay,
    symptoms: JSON.stringify(c.symptoms),
    stress: c.stress,
    saltyYesterday: bool(c.saltyYesterday),
    alcoholYesterday: bool(c.alcoholYesterday),
    note: c.note?.trim().slice(0, 300) || null,
    updatedAt: now,
  };
  getDb()
    .insert(faceCheckins)
    .values({ day: c.day, createdAt: now, ...values })
    .onConflictDoUpdate({ target: faceCheckins.day, set: values })
    .run();
}

export function getCheckin(day: string): Checkin | null {
  const r = getDb().select().from(faceCheckins).where(eq(faceCheckins.day, day)).get();
  return r ? toCheckin(r) : null;
}

export function checkinHistory(sinceDay: string): Checkin[] {
  return getDb().select().from(faceCheckins).where(gte(faceCheckins.day, sinceDay)).orderBy(asc(faceCheckins.day)).all().map(toCheckin);
}

export function deleteCheckin(day: string): void {
  getDb().delete(faceCheckins).where(eq(faceCheckins.day, day)).run();
}

// ── Photos (metadata only; images are encrypted files) ─────────────────────

export function addPhotoRow(p: { id: string; takenOn: string; takenAt: string; fileName: string; note: string | null }): void {
  const now = nowIso();
  getDb()
    .insert(facePhotos)
    .values({ ...p, note: p.note?.trim().slice(0, 300) || null, createdAt: now, updatedAt: now })
    .run();
}

export function listPhotos(): FacePhotoRow[] {
  return getDb().select().from(facePhotos).where(isNull(facePhotos.deletedAt)).orderBy(desc(facePhotos.takenAt)).all();
}

export function getPhoto(id: string): FacePhotoRow | null {
  return getDb().select().from(facePhotos).where(and(eq(facePhotos.id, id), isNull(facePhotos.deletedAt))).get() ?? null;
}

export function updatePhoto(id: string, patch: Partial<Pick<FacePhotoRow, 'note' | 'aiQuality' | 'aiObservation' | 'aiComparedWith' | 'userVerdict'>>): void {
  getDb().update(facePhotos).set({ ...patch, updatedAt: nowIso() }).where(eq(facePhotos.id, id)).run();
}

/** Removes the row completely (the caller deletes the encrypted file). */
export function deletePhotoRow(id: string): void {
  getDb().delete(facePhotos).where(eq(facePhotos.id, id)).run();
}
