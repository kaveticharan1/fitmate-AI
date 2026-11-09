import { describe, expect, it, vi } from 'vitest';
import {
  buildRequest,
  buildSystemPrompt,
  CoachError,
  contextLines,
  extractMemory,
  generateReply,
  parseReply,
  plainText,
  speakableText,
  pickModel,
  safetyFlags,
  trimHistory,
  verifyKey,
  type CoachContext,
  type FetchFn,
} from './index';

const ctx: CoachContext = {
  today: '2026-11-09',
  age: 29,
  sex: 'male',
  heightCm: 175,
  weightKg: 86,
  targetWeightKg: 75,
  goal: 'fat_loss',
  activityLevel: 'light',
  dietType: 'non_vegetarian',
  allergies: ['peanut'],
  dislikedFoods: [],
  workoutPreference: 'home',
  equipment: [],
  injuries: null,
  hasMedicalCondition: false,
  isPregnantOrBreastfeeding: false,
  hasEatingDisorderHistory: false,
  targets: { kcal: 2000, proteinG: 138, waterMl: 3000 },
  todayEaten: { kcal: 850, proteinG: 40, logged: true },
  waterTodayMl: 1250,
  weeklyWeightChangeKg: -0.4,
  sleepLastNightMin: 400,
  workoutsThisWeek: 2,
  stepsToday: 4200,
  stepsAverage7: 6100,
  stepGoal: 8000,
  lastWorkout: '2026-11-08 Home beginner',
};

const res = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

describe('system prompt', () => {
  it('includes useful facts but nothing identifying', () => {
    const p = buildSystemPrompt({ context: ctx, personality: 'friendly', language: 'en', memory: ['Works night shifts'] });
    expect(p).toContain('Weight: 86 kg');
    expect(p).toContain('Daily targets: 2000 kcal, 138 g protein, 3000 ml water');
    expect(p).toContain('Logged today: 850 kcal, 40 g protein');
    expect(p).toContain('Sleep last night: 6 h 40 min');
    expect(p).toContain('Steps today: 4200 (goal 8000)');
    expect(p).toContain('Average steps, last 7 days: 6100');
    expect(p).toContain('Allergies: peanut');
    expect(p).toContain('- Works night shifts');
    expect(p).toContain('14416');
    expect(p).not.toMatch(/Dislikes|Injuries|Pregnant/);
  });

  it('switches language and personality', () => {
    const p = buildSystemPrompt({ context: ctx, personality: 'military', language: 'te', memory: [] });
    expect(p).toContain('Reply in Telugu');
    expect(p).toMatch(/drill-instructor/);
    expect(p).not.toContain('Things the user asked you to remember');
  });

  it('hides calorie numbers for eating-disorder history and adds rules', () => {
    const c = { ...ctx, hasEatingDisorderHistory: true, isPregnantOrBreastfeeding: true, injuries: 'knee pain' };
    const lines = contextLines(c).join('\n');
    expect(lines).not.toMatch(/kcal/);
    expect(lines).toContain('Daily targets: 138 g protein, 3000 ml water');
    const p = buildSystemPrompt({ context: c, personality: 'strict', language: 'en', memory: [] });
    expect(p).toContain('history of an eating disorder');
    expect(p).toContain('pregnant or breastfeeding');
    expect(p).toContain("Respect the user's injuries (knee pain)");
  });
});

describe('memory and history', () => {
  it('extracts remember tags', () => {
    const r = extractMemory('Try 2 boiled eggs at breakfast.\n\n[[remember: Hates oats]]');
    expect(r).toEqual({ text: 'Try 2 boiled eggs at breakfast.', remember: ['Hates oats'] });
    expect(extractMemory('No tags here').remember).toEqual([]);
  });

  it('trims to recent turns starting with the user', () => {
    const turns = Array.from({ length: 20 }, (_, i) => ({ role: (i % 2 === 0 ? 'user' : 'coach') as 'user' | 'coach', text: `m${i}` }));
    const t = trimHistory(turns, 5);
    expect(t[0]!.role).toBe('user');
    expect(t.at(-1)!.text).toBe('m19');
    expect(t.length).toBeLessThanOrEqual(5);
    const long = trimHistory([{ role: 'user', text: 'x'.repeat(5000) }, { role: 'coach', text: 'y'.repeat(5000) }, { role: 'user', text: 'hi' }]);
    expect(long).toEqual([{ role: 'user', text: 'hi' }]);
  });
});

describe('plain text', () => {
  it('strips simple markdown', () => {
    expect(plainText('## Plan\n**Breakfast:** 2 *idli* with `sambar`\n* Dal\n- Curd')).toBe('Plan\nBreakfast: 2 idli with sambar\n• Dal\n• Curd');
    expect(speakableText('**Great job!** 💪\n* Drink water')).toBe('Great job! Drink water');
  });
});

describe('safety', () => {
  it('flags crisis and emergency messages in English and Telugu', () => {
    expect(safetyFlags('I want to die')).toEqual(['crisis']);
    expect(safetyFlags('నాకు ఆత్మహత్య ఆలోచనలు వస్తున్నాయి')).toEqual(['crisis']);
    expect(safetyFlags('chest pain while running')).toEqual(['emergency']);
    expect(safetyFlags('ఛాతీ నొప్పి')).toEqual(['emergency']);
    expect(safetyFlags('my lips and tongue are swelling after a new cream')).toEqual(['emergency']);
    expect(safetyFlags('swollen throat, can’t swallow')).toEqual(['emergency']);
    expect(safetyFlags('I can’t breathe properly')).toEqual(['emergency']);
    expect(safetyFlags('My face looks puffy this morning')).toEqual([]);
  });

  it('does not flag ordinary fitness talk', () => {
    for (const t of ['I am dying for some biryani', 'chest press form?', 'killing it at the gym', 'cut down sugar', 'how to end my workout']) {
      expect(safetyFlags(t)).toEqual([]);
    }
  });
});

describe('Gemini client', () => {
  it('picks a stable Flash model over Lite, preview and image models', () => {
    const models = [
      { name: 'models/gemini-3.5-flash-lite', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-3.8-flash-preview', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-3.6-flash', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-3.5-flash', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-3.9-flash-image', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-4-argon', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/text-embedding-005', supportedGenerationMethods: ['embedContent'] },
    ];
    expect(pickModel(models)).toBe('gemini-3.6-flash');
    expect(pickModel([{ name: 'models/gemini-3.5-flash-lite', supportedGenerationMethods: ['generateContent'] }])).toBe('gemini-3.5-flash-lite');
    expect(pickModel([])).toBeNull();
  });

  it('sends the key in a header, not the URL', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => res(200, { models: [{ name: 'models/gemini-3.6-flash', supportedGenerationMethods: ['generateContent'] }] }));
    expect(await verifyKey('AIzaSECRET', fetchFn)).toBe('gemini-3.6-flash');
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).not.toContain('AIzaSECRET');
    expect(init.headers['x-goog-api-key']).toBe('AIzaSECRET');
  });

  it('maps API errors to friendly kinds', async () => {
    const cases: [number, unknown, string][] = [
      [400, { error: { status: 'INVALID_ARGUMENT', message: 'API key not valid. Please pass a valid API key.' } }, 'invalid_key'],
      [403, { error: { status: 'PERMISSION_DENIED', message: 'denied' } }, 'invalid_key'],
      [429, { error: { status: 'RESOURCE_EXHAUSTED', message: 'quota' } }, 'quota'],
      [503, { error: { status: 'UNAVAILABLE', message: 'overloaded' } }, 'unavailable'],
    ];
    for (const [status, body, kind] of cases) {
      await expect(verifyKey('k', async () => res(status, body))).rejects.toMatchObject({ kind });
    }
    await expect(verifyKey('k', async () => { throw new TypeError('Network request failed'); })).rejects.toMatchObject({ kind: 'network' });
  });

  it('times out slow requests', async () => {
    const slow: FetchFn = (_u, init) =>
      new Promise((_, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted'))));
    await expect(verifyKey('k', slow, 20)).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('builds a request and parses replies', async () => {
    const body = buildRequest('SYS', [{ role: 'user', text: 'hi' }, { role: 'coach', text: 'hello' }, { role: 'user', text: 'eggs?' }]);
    expect(body.systemInstruction.parts[0]!.text).toBe('SYS');
    expect(body.contents.map((c) => c.role)).toEqual(['user', 'model', 'user']);

    const fetchFn = vi.fn<FetchFn>(async () => res(200, { candidates: [{ content: { parts: [{ text: 'thinking…', thought: true }, { text: 'Eat 2 eggs.' }] }, finishReason: 'STOP' }] }));
    expect(await generateReply({ apiKey: 'k', model: 'gemini-3.6-flash', system: 'S', turns: [{ role: 'user', text: 'eggs?' }], fetchFn })).toBe('Eat 2 eggs.');
    expect(fetchFn.mock.calls[0]![0]).toMatch(/models\/gemini-3\.6-flash:generateContent$/);
  });

  it('reports blocked and empty replies', () => {
    expect(() => parseReply({ promptFeedback: { blockReason: 'SAFETY' } })).toThrow(CoachError);
    expect(() => parseReply({ candidates: [{ finishReason: 'SAFETY' }] })).toThrow(/SAFETY/);
    expect(() => parseReply({ candidates: [] })).toThrow(/Empty reply/);
  });
});
