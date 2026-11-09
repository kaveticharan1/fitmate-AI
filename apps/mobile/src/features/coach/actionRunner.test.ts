import { resolveFoodItems, runAction } from './actionRunner';

const mockAddFood = jest.fn();
jest.mock('../../db/foodRepo', () => ({ addFoodEntry: (e: unknown) => mockAddFood(e) }));
const mockSleep = jest.fn();
jest.mock('../../db/habitsRepo', () => ({ logSleep: (...a: unknown[]) => mockSleep(...a) }));
const mockWater = jest.fn();
jest.mock('../../db/progressRepo', () => ({ addWater: (...a: unknown[]) => mockWater(...a) }));
const mockSettings: Record<string, unknown> = {};
const mockWeight = jest.fn();
jest.mock('../../db/repositories', () => ({
  getSetting: (k: string, d: unknown) => (k in mockSettings ? mockSettings[k] : d),
  setSetting: (k: string, v: unknown) => {
    mockSettings[k] = v;
  },
  logWeight: (...a: unknown[]) => mockWeight(...a),
}));
const mockApply = jest.fn(async () => 1);
jest.mock('../reminders/notifications', () => ({ applyReminders: (...a: unknown[]) => mockApply(...(a as [])) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid-1' }));

const texts = { title: 'FitMate', water: 'w', medicine: (n: string) => n, custom: (l: string) => `Reminder: ${l}` };

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(mockSettings)) delete mockSettings[k];
});

describe('coach action runner', () => {
  it('matches spoken foods to the food list with sensible amounts', () => {
    const [dosa, sambar, mystery, rice] = resolveFoodItems([
      { name: 'dosa', count: 2, unit: 'pieces' },
      { name: 'sambar', count: 1, unit: 'bowl' },
      { name: 'unicorn steak', count: 1 },
      { name: 'rice', grams: 200 },
    ]);
    expect(dosa).toMatchObject({ food: { id: 'dosa' }, measureKey: 'piece', count: 2 });
    expect(dosa!.kcal).toBeGreaterThan(150);
    expect(sambar).toMatchObject({ food: { id: 'sambar' }, measureKey: 'katori', count: 1 });
    expect(mystery).toEqual({ name: 'unicorn steak', food: null });
    expect(rice!.food).not.toBeNull();
  });

  it('logs only the foods it found, as today’s entries', async () => {
    const r = await runAction({ type: 'log_food', meal: 'breakfast', items: [{ name: 'idli', count: 3 }, { name: 'unicorn steak' }] }, texts, '2026-11-10');
    expect(r).toEqual({ done: 1, skipped: ['unicorn steak'] });
    expect(mockAddFood).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-11-10', meal: 'breakfast', foodId: 'idli', count: 3, source: 'manual' }));
  });

  it('logs water, weight and sleep through the normal app functions', async () => {
    await runAction({ type: 'log_water', ml: 500 }, texts, '2026-11-10');
    await runAction({ type: 'log_weight', kg: 84.6 }, texts, '2026-11-10');
    await runAction({ type: 'log_sleep', bed: '23:15', wake: '06:30' }, texts, '2026-11-10');
    expect(mockWater).toHaveBeenCalledWith(500, '2026-11-10');
    expect(mockWeight).toHaveBeenCalledWith(84.6, '2026-11-10');
    expect(mockSleep).toHaveBeenCalledWith('23:15', '06:30', '2026-11-10');
  });

  it('adds a custom daily reminder and reschedules', async () => {
    await runAction({ type: 'set_reminder', label: 'Evening walk', time: '18:30' }, texts);
    const saved = mockSettings['reminders.v1'] as { custom: unknown[] };
    expect(saved.custom).toEqual([{ id: 'uuid-1', label: 'Evening walk', time: '18:30' }]);
    expect(mockApply).toHaveBeenCalledWith(expect.objectContaining({ custom: saved.custom }), texts);
  });
});
