import { usableModel } from './model';

const mockSet = jest.fn();
jest.mock('./aiKey', () => ({ setAiKey: (v: unknown) => mockSet(v) }));

const models = { models: [{ name: 'models/gemini-3.5-flash-deep-think', supportedGenerationMethods: ['generateContent'] }, { name: 'models/gemini-3.5-flash', supportedGenerationMethods: ['generateContent'] }] };

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => models })) as unknown as typeof fetch;
});

it('keeps a normal Flash model without asking Google', async () => {
  expect(await usableModel({ apiKey: 'k', model: 'gemini-3.5-flash' })).toBe('gemini-3.5-flash');
  expect(global.fetch).not.toHaveBeenCalled();
});

it('replaces a slow thinking variant and saves the new choice', async () => {
  expect(await usableModel({ apiKey: 'k', model: 'gemini-3.5-flash-deep-think' })).toBe('gemini-3.5-flash');
  expect(mockSet).toHaveBeenCalledWith({ apiKey: 'k', model: 'gemini-3.5-flash' });
});

it('keeps the old model if Google can’t be reached', async () => {
  global.fetch = jest.fn(async () => {
    throw new Error('offline');
  }) as unknown as typeof fetch;
  expect(await usableModel({ apiKey: 'k', model: 'gemini-3.5-flash-thinking' })).toBe('gemini-3.5-flash-thinking');
});
