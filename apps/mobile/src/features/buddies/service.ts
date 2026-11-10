import { defaultStepGoal } from '@fitmate/core';
import { dailyFoodTotals, dailyWater, weightHistory } from '../../db/progressRepo';
import { getProfile, getSetting, recordConsent, setSetting, withdrawConsent } from '../../db/repositories';
import { stepHistory } from '../../db/stepsRepo';
import { workoutHistory } from '../../db/workoutRepo';
import { addDays, localDate } from '../../lib/time';
import { targetsForProfile } from '../profile/targets';
import { rpc, type BuddyFetch } from './client';
import { clearMembership, getMembership, newSecret, saveMembership, type Membership } from './store';
import { buildSummary, DEFAULT_SHARE, type BuddySummary, type ShareSettings } from './summary';

export const SHARE_KEY = 'buddyShare';
const LAST_PUSH_KEY = 'buddyLastPush';
export const PUSH_EVERY_MS = 15 * 60 * 1000;

export interface BuddyMember {
  id: string;
  name: string;
  lastSeen: string;
  day: string | null;
  summary: BuddySummary | null;
  updatedAt: string | null;
}
export interface BuddyGroup {
  group: { id: string; name: string; code: string };
  me: string;
  members: BuddyMember[];
  cheers: { from: string; kind: CheerKind; at: string }[];
}
export type CheerKind = 'clap' | 'fire' | 'strong' | 'water' | 'walk';

export function getShareSettings(): ShareSettings {
  return { ...DEFAULT_SHARE, ...getSetting<Partial<ShareSettings>>(SHARE_KEY, {}) };
}
export function setShareSettings(s: ShareSettings) {
  setSetting(SHARE_KEY, s);
}

/** Today's summary from the phone's own data, limited to what you chose to share. */
export function mySummary(now: Date = new Date()): BuddySummary {
  const profile = getProfile();
  const today = localDate(now);
  const since = addDays(today, -13);
  const healthOn = getSetting<boolean>('healthEnabled', false);
  const stepsRow = stepHistory(today).find((d) => d.day === today);
  const targets = profile ? targetsForProfile(profile, now) : null;
  const water = Object.fromEntries(dailyWater(addDays(today, -6)).map((d) => [d.date, Number(d.ml)]));
  return buildSummary(
    {
      today,
      stepsToday: stepsRow ? stepsRow.steps : healthOn ? 0 : null,
      stepGoal: getSetting<number | null>('stepGoal', null) ?? defaultStepGoal(profile?.activityLevel ?? 'light'),
      workoutDays: workoutHistory(addDays(today, -6)).map((w) => w.doneOn),
      waterByDay: water,
      waterTarget: targets?.waterMl ?? 0,
      foodDays: dailyFoodTotals(addDays(today, -60)).map((d) => d.date),
      weights: weightHistory(since).map((w) => ({ date: w.date, value: Number(w.value) })),
      gentle: !!profile?.hasEatingDisorderHistory,
    },
    getShareSettings(),
  );
}

export async function createGroup(groupName: string, displayName: string, fetchFn?: BuddyFetch): Promise<Membership> {
  const secret = newSecret();
  const r = await rpc<{ groupId: string; code: string; memberId: string }>('buddy_create_group', { p_group_name: groupName, p_display_name: displayName, p_secret: secret }, fetchFn);
  const m = { memberId: r.memberId, groupId: r.groupId, code: r.code, secret };
  await saveMembership(m);
  recordConsent('buddies');
  await pushSummary({ force: true, fetchFn }).catch(() => undefined);
  return m;
}

export async function joinGroup(code: string, displayName: string, fetchFn?: BuddyFetch): Promise<Membership> {
  const secret = newSecret();
  const r = await rpc<{ groupId: string; code: string; memberId: string }>('buddy_join_group', { p_code: code.replace(/[\s-]/g, ''), p_display_name: displayName, p_secret: secret }, fetchFn);
  const m = { memberId: r.memberId, groupId: r.groupId, code: r.code, secret };
  await saveMembership(m);
  recordConsent('buddies');
  await pushSummary({ force: true, fetchFn }).catch(() => undefined);
  return m;
}

/** Sends your summary (at most every 15 minutes unless forced). Does nothing outside a group. */
export async function pushSummary(opts: { force?: boolean; now?: Date; fetchFn?: BuddyFetch } = {}): Promise<boolean> {
  const m = await getMembership();
  if (!m) return false;
  const now = opts.now ?? new Date();
  const last = getSetting<number>(LAST_PUSH_KEY, 0);
  if (!opts.force && now.getTime() - last < PUSH_EVERY_MS) return false;
  await rpc('buddy_push_summary', { p_member: m.memberId, p_secret: m.secret, p_day: localDate(now), p_data: mySummary(now) }, opts.fetchFn);
  setSetting(LAST_PUSH_KEY, now.getTime());
  return true;
}

export async function fetchGroup(fetchFn?: BuddyFetch): Promise<BuddyGroup | null> {
  const m = await getMembership();
  if (!m) return null;
  return rpc<BuddyGroup>('buddy_get_group', { p_member: m.memberId, p_secret: m.secret }, fetchFn);
}

export async function sendCheer(to: string, kind: CheerKind, fetchFn?: BuddyFetch): Promise<void> {
  const m = await getMembership();
  if (!m) return;
  await rpc('buddy_send_cheer', { p_member: m.memberId, p_secret: m.secret, p_to: to, p_kind: kind }, fetchFn);
}

/** Leaves the group: your member record, summary and cheers are deleted on the server. */
export async function leaveGroup(fetchFn?: BuddyFetch): Promise<void> {
  const m = await getMembership();
  if (!m) return;
  try {
    await rpc('buddy_leave_group', { p_member: m.memberId, p_secret: m.secret }, fetchFn);
  } catch (e) {
    // Already removed on the server: still forget it here.
    if (!(e instanceof Error && /not_member/.test(e.message))) throw e;
  }
  await clearMembership();
  withdrawConsent('buddies');
}

/** For "Delete all data": best effort, never blocks the wipe. */
export async function leaveGroupQuietly(): Promise<void> {
  const m = await getMembership();
  if (!m) return;
  await rpc('buddy_leave_group', { p_member: m.memberId, p_secret: m.secret }, undefined, 8000).catch(() => undefined);
  await clearMembership().catch(() => undefined);
}
