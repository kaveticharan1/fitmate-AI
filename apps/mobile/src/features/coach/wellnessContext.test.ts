import { faceSkinContext, knowledgeFor } from './wellnessContext';

const mockSettings: Record<string, unknown> = {};
jest.mock('../../db/repositories', () => ({ getSetting: (k: string, d: unknown) => (k in mockSettings ? mockSettings[k] : d) }));
let mockCheckins: unknown[] = [];
let mockPhotos: unknown[] = [];
jest.mock('../../db/faceRepo', () => ({ checkinHistory: () => mockCheckins, listPhotos: () => mockPhotos }));
let mockSkin: unknown = null;
jest.mock('../../db/skinRepo', () => ({ getSkinProfile: () => mockSkin, listSteps: () => [] }));
jest.mock('../face/service', () => ({ readObservation: (s: string | null) => (s ? JSON.parse(s) : null) }));

const now = new Date(2026, 10, 10, 9);
const row = (day: string, puffiness: number) => ({ day, puffiness, areas: ['under_eyes'], timeOfDay: 'morning' });

beforeEach(() => {
  for (const k of Object.keys(mockSettings)) delete mockSettings[k];
  mockCheckins = [];
  mockPhotos = [];
  mockSkin = null;
});

describe('knowledgeFor', () => {
  it('finds ingredient and concern entries with their source', () => {
    const k = knowledgeFor('Can I use niacinamide for acne?')!;
    expect(k).toMatch(/Niacinamide/);
    expect(k).toMatch(/acne:/);
    expect(k).toMatch(/Sources:/);
  });
  it('stays quiet for food and workout questions', () => {
    expect(knowledgeFor('How much coconut oil can I use for cooking dal?')).toBeNull();
    expect(knowledgeFor('I want to reduce my calories and get toned')).toBeNull();
    expect(knowledgeFor('Is boiled rice ok after a workout?')).toBeNull();
  });
  it('limits the number of entries', () => {
    const k = knowledgeFor('niacinamide, salicylic acid, glycolic acid, azelaic acid and retinol', 2)!;
    expect(k.split('\n').filter((l) => l.startsWith('- ')).length).toBe(2);
  });
});

describe('faceSkinContext', () => {
  it('returns nothing without data', () => {
    expect(faceSkinContext(now)).toBeNull();
  });
  it('labels check-ins as user-reported and photos as AI estimates', () => {
    mockCheckins = [row('2026-11-10', 2), row('2026-11-09', 1)];
    mockPhotos = [{ takenOn: '2026-11-10', aiObservation: JSON.stringify({ observations: ['Slight under-eye fullness.'], comparison: null }), userVerdict: 'disagree' }];
    const c = faceSkinContext(now)!;
    expect(c).toMatch(/user-reported/);
    expect(c).toMatch(/today: moderate \(under_eyes\), morning/);
    expect(c).toMatch(/AI visual estimate \(2026-11-10, user disagreed\)/);
  });
  it('respects the share settings', () => {
    mockCheckins = [row('2026-11-10', 2)];
    mockSettings.wellnessShareWithCoach = false;
    mockSkin = { shareWithCoach: false, skinType: 'oily', concerns: [] };
    expect(faceSkinContext(now)).toBeNull();
    mockSkin = { shareWithCoach: true, skinType: 'oily', sensitive: true, concerns: ['acne'], experience: 'beginner', budget: 'low', fragranceFree: false, pregnant: true, allergies: null };
    expect(faceSkinContext(now)).toMatch(/oily, sensitive; concerns: acne.*pregnant/);
  });
});
