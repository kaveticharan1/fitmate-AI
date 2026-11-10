import { CoachError } from '@fitmate/coach';
import { modelChain, withModels } from './model';

const mockSet = jest.fn();
jest.mock('./aiKey', () => ({ setAiKey: (v: unknown) => mockSet(v) }));

const list = {
  models: ['gemini-3.5-flash-deep-think', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3-flash'].map((id) => ({ name: `models/${id}`, supportedGenerationMethods: ['generateContent'] })),
};

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => list })) as unknown as typeof fetch;
});

describe('modelChain', () => {
  it('uses the saved main model and backups without asking Google', async () => {
    expect(await modelChain({ apiKey: 'k', model: 'gemini-3.5-flash', fallbacks: ['gemini-3.5-flash-lite'] })).toEqual(['gemini-3.5-flash', 'gemini-3.5-flash-lite']);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fetches backups once for keys saved by older versions, skipping slow variants', async () => {
    expect(await modelChain({ apiKey: 'k', model: 'gemini-3.5-flash-deep-think' })).toEqual(['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3-flash']);
    expect(mockSet).toHaveBeenCalledWith({ apiKey: 'k', model: 'gemini-3.5-flash', fallbacks: ['gemini-3.5-flash-lite', 'gemini-3-flash'] });
  });

  it('keeps the saved model if Google can’t be reached', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await modelChain({ apiKey: 'k', model: 'gemini-3.5-flash' })).toEqual(['gemini-3.5-flash']);
  });
});

describe('withModels', () => {
  const stored = { apiKey: 'k', model: 'gemini-3.5-flash', fallbacks: ['gemini-3.5-flash-lite', 'gemini-3-flash'] };

  it('moves to the backup when the main model is too slow', async () => {
    const attempt = jest.fn(async (m: string) => {
      if (m === 'gemini-3.5-flash') throw new CoachError('timeout', 'slow');
      return `answer from ${m}`;
    });
    expect(await withModels(stored, attempt)).toBe('answer from gemini-3.5-flash-lite');
  });

  it('retries a busy model once, then uses a backup', async () => {
    const attempt = jest.fn(async (m: string) => {
      if (m === 'gemini-3.5-flash') throw new CoachError('unavailable', 'The model is overloaded');
      return 'ok';
    });
    expect(await withModels(stored, attempt)).toBe('ok');
    expect(attempt.mock.calls.map((c) => c[0])).toEqual(['gemini-3.5-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite']);
  });

  it('stops at once for a bad key and reports the last error when all are busy', async () => {
    await expect(withModels(stored, async () => Promise.reject(new CoachError('invalid_key', 'bad')))).rejects.toMatchObject({ kind: 'invalid_key' });
    await expect(withModels(stored, async () => Promise.reject(new CoachError('quota', 'limit')))).rejects.toMatchObject({ kind: 'quota' });
  });
});

describe('Groq keys', () => {
  const GSK = 'gsk_' + 'a'.repeat(52);
  const groqList = { data: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'].map((id) => ({ id })) };

  it('saves the chat chain and the photo model when connecting', async () => {
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => groqList })) as unknown as typeof fetch;
    const { refreshModels } = jest.requireActual('./model') as typeof import('./model');
    expect(await refreshModels(GSK)).toEqual(['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b']);
    expect(mockSet).toHaveBeenCalledWith({ provider: 'groq', apiKey: GSK, model: 'openai/gpt-oss-120b', fallbacks: ['openai/gpt-oss-20b', 'qwen/qwen3.8-27b'], visionModels: ['qwen/qwen3.8-27b'] });
  });

  it('uses the saved chains for chat and photos', async () => {
    const stored = { provider: 'groq' as const, apiKey: GSK, model: 'openai/gpt-oss-120b', fallbacks: ['openai/gpt-oss-20b'], visionModels: ['qwen/qwen3.8-27b'] };
    expect(await modelChain(stored)).toEqual(['openai/gpt-oss-120b', 'openai/gpt-oss-20b']);
    expect(await modelChain(stored, 'vision')).toEqual(['qwen/qwen3.8-27b']);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('says clearly when Groq has no photo model', async () => {
    await expect(modelChain({ provider: 'groq', apiKey: GSK, model: 'openai/gpt-oss-120b', fallbacks: [], visionModels: [] }, 'vision')).rejects.toMatchObject({ kind: 'no_model' });
  });
});
