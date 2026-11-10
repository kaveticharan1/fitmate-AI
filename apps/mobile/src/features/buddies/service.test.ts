import { BuddyError, rpc } from './client';
import { createGroup, joinGroup, leaveGroup, pushSummary } from './service';

let mockStore: Record<string, unknown> | null = null;
jest.mock('./store', () => ({
  newSecret: () => 'f'.repeat(64),
  getMembership: async () => mockStore,
  saveMembership: async (m: Record<string, unknown>) => {
    mockStore = m;
  },
  clearMembership: async () => {
    mockStore = null;
  },
}));
const mockSettings: Record<string, unknown> = {};
const mockConsent = jest.fn();
const mockWithdraw = jest.fn();
jest.mock('../../db/repositories', () => ({
  getSetting: (k: string, d: unknown) => (k in mockSettings ? mockSettings[k] : d),
  setSetting: (k: string, v: unknown) => {
    mockSettings[k] = v;
  },
  getProfile: () => ({ activityLevel: 'light', hasEatingDisorderHistory: false }),
  recordConsent: (k: string) => mockConsent(k),
  withdrawConsent: (k: string) => mockWithdraw(k),
}));
jest.mock('../../db/progressRepo', () => ({ dailyFoodTotals: () => [], dailyWater: () => [], weightHistory: () => [{ date: '2026-11-01', value: 80 }] }));
jest.mock('../../db/stepsRepo', () => ({ stepHistory: () => [] }));
jest.mock('../../db/workoutRepo', () => ({ workoutHistory: () => [] }));
jest.mock('../profile/targets', () => ({ targetsForProfile: () => ({ waterMl: 3000 }) }));

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const fail = (status: number, message: string) => ({ ok: false, status, json: async () => ({ message }) });

beforeEach(() => {
  mockStore = null;
  for (const k of Object.keys(mockSettings)) delete mockSettings[k];
  jest.clearAllMocks();
});

describe('buddy client', () => {
  it('sends the publishable key, never a secret in the URL', async () => {
    const f = jest.fn(async () => ok({ x: 1 }));
    await rpc('buddy_get_group', { p_member: 'm', p_secret: 's' }, f);
    const [url, init] = f.mock.calls[0] as unknown as [string, { headers: Record<string, string>; body: string }];
    expect(url).toMatch(/\/rest\/v1\/rpc\/buddy_get_group$/);
    expect(url).not.toMatch(/s$|secret/);
    expect(init.headers.apikey).toMatch(/^sb_publishable_/);
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('turns server messages into friendly kinds', async () => {
    await expect(rpc('x', {}, async () => fail(400, 'no_group'))).rejects.toMatchObject({ kind: 'no_group' });
    await expect(rpc('x', {}, async () => fail(400, 'not_member'))).rejects.toMatchObject({ kind: 'not_member' });
    await expect(rpc('x', {}, async () => fail(500, 'boom'))).rejects.toMatchObject({ kind: 'server' });
    await expect(
      rpc('x', {}, async () => {
        throw new Error('offline');
      }),
    ).rejects.toMatchObject({ kind: 'network' });
  });
});

describe('buddy service', () => {
  it('creates a group, saves the membership, records consent and shares at once', async () => {
    const f = jest.fn().mockResolvedValueOnce(ok({ groupId: 'g', code: 'ABCD2345', memberId: 'me' })).mockResolvedValueOnce(ok(null));
    const m = await createGroup('Walkers', 'Charan', f);
    expect(m).toMatchObject({ memberId: 'me', code: 'ABCD2345', secret: 'f'.repeat(64) });
    expect(mockConsent).toHaveBeenCalledWith('buddies');
    const push = JSON.parse(f.mock.calls[1][1].body);
    expect(push.p_data).not.toHaveProperty('weightTrend');
    expect(JSON.stringify(push.p_data)).not.toMatch(/80/);
  });

  it('cleans spaces and dashes from codes when joining', async () => {
    const f = jest.fn().mockResolvedValueOnce(ok({ groupId: 'g', code: 'ABCD2345', memberId: 'me' })).mockResolvedValue(ok(null));
    await joinGroup('abcd-2345 ', 'Ravi', f);
    expect(JSON.parse(f.mock.calls[0][1].body).p_code).toBe('abcd2345');
  });

  it('throttles summary pushes and does nothing outside a group', async () => {
    const f = jest.fn(async () => ok(null));
    expect(await pushSummary({ fetchFn: f })).toBe(false);
    mockStore = { memberId: 'me', secret: 's', groupId: 'g', code: 'C' };
    const now = new Date(2026, 10, 10, 12);
    expect(await pushSummary({ now, fetchFn: f })).toBe(true);
    expect(await pushSummary({ now: new Date(now.getTime() + 60_000), fetchFn: f })).toBe(false);
    expect(await pushSummary({ now: new Date(now.getTime() + 16 * 60_000), fetchFn: f })).toBe(true);
  });

  it('leaving deletes on the server and forgets locally, even if the server already removed us', async () => {
    mockStore = { memberId: 'me', secret: 's', groupId: 'g', code: 'C' };
    await leaveGroup(async () => fail(400, 'not_member'));
    expect(mockStore).toBeNull();
    expect(mockWithdraw).toHaveBeenCalledWith('buddies');
  });

  it('keeps the membership if leaving fails because of the network', async () => {
    mockStore = { memberId: 'me', secret: 's', groupId: 'g', code: 'C' };
    await expect(
      leaveGroup(async () => {
        throw new Error('offline');
      }),
    ).rejects.toBeInstanceOf(BuddyError);
    expect(mockStore).not.toBeNull();
  });
});
