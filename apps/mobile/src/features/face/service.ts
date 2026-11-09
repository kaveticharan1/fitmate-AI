import { analyzeFace, CoachError, type FaceAnalysis, type FetchFn } from '@fitmate/coach';
import { checkinHistory, getPhoto, listPhotos, updatePhoto, type Checkin } from '../../db/faceRepo';
import { foodLogEntries } from '../../db/schema';
import { getDb } from '../../db/client';
import { sleepHistory } from '../../db/habitsRepo';
import { dailyWater } from '../../db/progressRepo';
import { getProfile, hasConsent, recordConsent, withdrawConsent } from '../../db/repositories';
import { addDays, localDate } from '../../lib/time';
import { getAiKey } from '../coach/aiKey';
import { targetsForProfile } from '../profile/targets';
import { averagePuffiness, escalation, findAssociations, SALTY_FOOD_IDS, type Association, type CheckinPoint, type DayLifestyle, type Escalation } from './logic';
import { readPhotoBase64 } from './photoStore';
import { and, gte, isNull } from 'drizzle-orm';

const fetchFn: FetchFn = (url, init) => fetch(url, init);

export const FACE_AI_CONSENT = 'face_ai' as const;

export const hasFaceAiConsent = () => hasConsent(FACE_AI_CONSENT);
export const giveFaceAiConsent = () => {
  if (!hasConsent(FACE_AI_CONSENT)) recordConsent(FACE_AI_CONSENT);
};
export const withdrawFaceAiConsent = () => withdrawConsent(FACE_AI_CONSENT);

export interface StoredObservation {
  observations: string[];
  comparison: string | null;
  conditionsDiffer: boolean;
}

/**
 * Sends one photo (or older + newer) to Gemini with the user's key, only after
 * the separate face-photo consent. Results are saved on the newest photo.
 */
export async function analyzePhotos(ids: string[]): Promise<FaceAnalysis> {
  if (!hasFaceAiConsent()) throw new CoachError('invalid_key', 'Face photo analysis is not allowed');
  const stored = await getAiKey();
  if (!stored || !hasConsent('ai_coach')) throw new CoachError('invalid_key', 'AI coach is not set up');
  const rows = ids.map((id) => getPhoto(id)).filter((r): r is NonNullable<typeof r> => !!r);
  if (rows.length !== ids.length || rows.length < 1 || rows.length > 2) throw new CoachError('bad_response', 'Photo not found');
  rows.sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  const images: string[] = [];
  for (const r of rows) {
    const b64 = await readPhotoBase64(r.id);
    if (!b64) throw new CoachError('bad_response', 'Photo not found');
    images.push(b64);
  }
  const language = getProfile()?.aiLanguage === 'te' ? 'te' : 'en';
  const result = await analyzeFace({ apiKey: stored.apiKey, model: stored.model, jpegsBase64: images, language, fetchFn });
  const newest = rows[rows.length - 1]!;
  updatePhoto(newest.id, {
    aiQuality: JSON.stringify({ usable: result.usable, issues: result.issues }),
    aiObservation: result.usable ? JSON.stringify({ observations: result.observations, comparison: result.comparison, conditionsDiffer: result.conditionsDiffer } satisfies StoredObservation) : null,
    aiComparedWith: rows.length === 2 ? rows[0]!.id : null,
    userVerdict: null,
  });
  return result;
}

export function readObservation(raw: string | null): StoredObservation | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as StoredObservation;
    return Array.isArray(v.observations) ? v : null;
  } catch {
    return null;
  }
}

const toPoint = (c: Checkin): CheckinPoint => ({
  day: c.day,
  puffiness: c.puffiness,
  symptoms: c.symptoms,
  saltyYesterday: c.saltyYesterday,
  alcoholYesterday: c.alcoholYesterday,
});

export interface FaceInsights {
  checkins: Checkin[];
  today: Checkin | null;
  avg7: number | null;
  avgPrev7: number | null;
  escalation: Escalation;
  associations: Association[];
  latestPhotoId: string | null;
  photoCount: number;
}

/** Everything the face dashboard and weekly report need, from data FitMate already has. */
export function faceInsights(now: Date = new Date(), days = 30): FaceInsights {
  const today = localDate(now);
  const since = addDays(today, -(days - 1));
  const checkins = checkinHistory(since);
  const points = checkins.map(toPoint);

  // Lifestyle for each check-in day, from existing modules. Unknown stays null (never zero).
  const sleep = new Map(sleepHistory(since).map((s) => [s.wokeOn, s.minutes]));
  const water = new Map(dailyWater(addDays(since, -1)).map((w) => [w.date, w.ml]));
  const foods = getDb()
    .select({ day: foodLogEntries.loggedOn, foodId: foodLogEntries.foodId })
    .from(foodLogEntries)
    .where(and(isNull(foodLogEntries.deletedAt), gte(foodLogEntries.loggedOn, addDays(since, -1))))
    .all();
  const foodByDay = new Map<string, string[]>();
  for (const f of foods) foodByDay.set(f.day, [...(foodByDay.get(f.day) ?? []), f.foodId ?? '']);
  const lifestyle = new Map<string, DayLifestyle>(
    checkins.map((c) => {
      const prev = addDays(c.day, -1);
      const prevFoods = foodByDay.get(prev);
      return [c.day, { sleepMin: sleep.get(c.day) ?? null, waterPrevMl: water.get(prev) ?? null, saltyPrev: prevFoods ? prevFoods.some((id) => SALTY_FOOD_IDS.includes(id)) : null }];
    }),
  );
  const profile = getProfile();
  const waterTarget = profile ? targetsForProfile(profile, now).waterMl : 2500;
  const todayRow = checkins.find((c) => c.day === today) ?? null;
  const photos = listPhotos();
  return {
    checkins,
    today: todayRow,
    avg7: averagePuffiness(points.filter((p) => p.day > addDays(today, -7))),
    avgPrev7: averagePuffiness(points.filter((p) => p.day <= addDays(today, -7) && p.day > addDays(today, -14))),
    escalation: escalation(todayRow ? toPoint(todayRow) : null, points),
    associations: findAssociations(points, lifestyle, waterTarget),
    latestPhotoId: photos[0]?.id ?? null,
    photoCount: photos.length,
  };
}
