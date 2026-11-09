import { buildCoachContext, connectAi, disconnectAi, requestCoachReply, saveUserMessage } from './service';

const mockMessages: { id: string; role: 'user' | 'coach'; text: string; flags: string[]; actions: unknown[]; createdAt: string }[] = [];
const mockMemory: string[] = [];
jest.mock('../../db/coachRepo', () => ({
  recentMessages: () => mockMessages,
  addMessage: (role: 'user' | 'coach', text: string, flags: string[] = [], actions: unknown[] = []) => {
    const m = { id: String(mockMessages.length), role, text, flags, actions, createdAt: '' };
    mockMessages.push(m);
    return m;
  },
  listMemory: () => mockMemory.map((text, i) => ({ id: String(i), text })),
  addMemory: (t: string) => mockMemory.push(t),
}));

const mockProfile = {
  name: 'Charan',
  dateOfBirth: '1997-05-01',
  sex: 'male',
  heightCm: 175,
  weightKg: 86,
  targetWeightKg: 75,
  goal: 'fat_loss',
  activityLevel: 'light',
  dietType: 'non_vegetarian',
  allergies: [],
  dislikedFoods: [],
  workoutPreference: 'home',
  equipment: [],
  injuries: null,
  hasMedicalCondition: false,
  isPregnantOrBreastfeeding: false,
  hasEatingDisorderHistory: false,
  healthNotes: 'private note',
  coachPersonality: 'friendly',
  aiLanguage: 'en',
};
let mockConsent = true;
let mockActionsOff = false;
const mockRecordConsent = jest.fn();
const mockWithdraw = jest.fn();
jest.mock('../../db/repositories', () => ({
  getProfile: () => mockProfile,
  getSetting: (k: string, fallback: unknown) => (k === 'coachActions' && mockActionsOff ? 'off' : fallback),
  hasConsent: () => mockConsent,
  recordConsent: (k: string) => mockRecordConsent(k),
  withdrawConsent: (k: string) => mockWithdraw(k),
}));
jest.mock('../../db/progressRepo', () => ({
  dailyFoodTotals: () => [{ date: '2026-11-09', kcal: 900.4, protein: 41.6 }],
  waterToday: () => 1500,
  weightHistory: () => [],
}));
jest.mock('../../db/stepsRepo', () => ({ stepHistory: () => [{ day: '2026-11-09', steps: 5200, source: 'health_connect', flags: [] }] }));
jest.mock('../../db/habitsRepo', () => ({ sleepHistory: () => [{ wokeOn: '2026-11-09', minutes: 420 }] }));
jest.mock('../../db/workoutRepo', () => ({ workoutHistory: () => [{ workoutId: 'walk_30', doneOn: '2026-11-08' }] }));

let mockStored: { apiKey: string; model: string } | null = { apiKey: 'AIzaTEST', model: 'gemini-3.6-flash' };
jest.mock('./aiKey', () => ({
  getAiKey: async () => mockStored,
  setAiKey: async (v: { apiKey: string; model: string }) => {
    mockStored = v;
  },
  deleteAiKey: async () => {
    mockStored = null;
  },
}));

const fetchMock = jest.fn();
beforeEach(() => {
  mockMessages.length = 0;
  mockMemory.length = 0;
  mockConsent = true;
  mockActionsOff = false;
  mockStored = { apiKey: 'AIzaTEST', model: 'gemini-3.6-flash' };
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

describe('coach service', () => {
  it('builds context without the name or health notes', () => {
    const c = buildCoachContext(new Date(2026, 10, 9, 20, 0))!;
    expect(c.context.today).toBe('2026-11-09');
    expect(c.context.age).toBe(29);
    expect(c.context.todayEaten).toEqual({ kcal: 900, proteinG: 42, logged: true });
    expect(c.context.sleepLastNightMin).toBe(420);
    expect(c.context.workoutsThisWeek).toBe(1);
    expect(c.context.stepsToday).toBe(5200);
    expect(c.context.stepGoal).toBe(8000);
    expect(c.context.lastWorkout).toBe('2026-11-08 30-minute brisk walk');
    expect(JSON.stringify(c)).not.toMatch(/Charan|private note|1997/);
  });

  it('sends the conversation, saves the reply and remembers facts', async () => {
    fetchMock.mockResolvedValue(ok({ candidates: [{ content: { parts: [{ text: 'Have dal and 2 rotis.\n[[remember: Works night shifts]]' }] } }] }));
    const msg = saveUserMessage("I'm on night shift, dinner ideas?");
    expect(msg.flags).toEqual([]);
    const reply = await requestCoachReply();
    expect(reply.text).toBe('Have dal and 2 rotis.');
    expect(mockMemory).toEqual(['Works night shifts']);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/gemini-3\.6-flash:generateContent$/);
    expect(init.headers['x-goog-api-key']).toBe('AIzaTEST');
    const body = JSON.parse(init.body);
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: "I'm on night shift, dinner ideas?" }] }]);
    expect(body.systemInstruction.parts[0].text).toContain('Water today: 1500 ml');
    expect(body.systemInstruction.parts[0].text).not.toContain('Charan');
  });

  it('saves proposed actions for the user to confirm, unless actions are off', async () => {
    const reply = 'I can log this — tap Confirm below.\n[[action: {"type":"log_water","ml":500}]]';
    fetchMock.mockResolvedValue(ok({ candidates: [{ content: { parts: [{ text: reply }] } }] }));
    saveUserMessage('I drank 2 glasses of water');
    const m = await requestCoachReply();
    expect(m.text).toBe('I can log this — tap Confirm below.');
    expect(m.actions).toEqual([{ action: { type: 'log_water', ml: 500 }, status: 'proposed' }]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).systemInstruction.parts[0].text).toContain('[[action:');

    mockActionsOff = true;
    const m2 = await requestCoachReply();
    expect(m2.actions).toEqual([]);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).systemInstruction.parts[0].text).not.toContain('[[action:');
  });

  it('flags crisis messages locally', () => {
    expect(saveUserMessage('I want to end my life').flags).toEqual(['crisis']);
  });

  it('refuses without consent or key', async () => {
    saveUserMessage('hi');
    mockConsent = false;
    await expect(requestCoachReply()).rejects.toMatchObject({ kind: 'invalid_key' });
    mockConsent = true;
    mockStored = null;
    await expect(requestCoachReply()).rejects.toMatchObject({ kind: 'invalid_key' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('connects only after Google accepts the key, and disconnects', async () => {
    mockStored = null;
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: { status: 'INVALID_ARGUMENT', message: 'API key not valid.' } }) });
    await expect(connectAi('bad')).rejects.toMatchObject({ kind: 'invalid_key' });
    expect(mockStored).toBeNull();

    mockConsent = false;
    fetchMock.mockResolvedValueOnce(ok({ models: [{ name: 'models/gemini-3.6-flash', supportedGenerationMethods: ['generateContent'] }] }));
    expect(await connectAi('AIzaGOOD')).toBe('gemini-3.6-flash');
    expect(mockStored).toEqual({ apiKey: 'AIzaGOOD', model: 'gemini-3.6-flash' });
    expect(mockRecordConsent).toHaveBeenCalledWith('ai_coach');

    await disconnectAi();
    expect(mockStored).toBeNull();
    expect(mockWithdraw).toHaveBeenCalledWith('ai_coach');
  });
});
