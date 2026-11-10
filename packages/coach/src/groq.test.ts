import { describe, expect, it, vi } from 'vitest';
import { analyzeFace, estimateFromPhoto, groqChat, groqReasoning, listGroqModels, parseGroqReply, providerForKey, readIngredientLabel, type FetchFn } from './index';

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const err = (status: number, message: string, code = '') => ({ ok: false, status, json: async () => ({ error: { message, code } }) });
const reply = (content: string) => ok({ choices: [{ message: { content }, finish_reason: 'stop' }] });
const body = (f: ReturnType<typeof vi.fn>, i = 0) => JSON.parse(f.mock.calls[i]![1].body);
const GSK = 'gsk_' + 'a'.repeat(52);

describe('providerForKey', () => {
  it('recognises Groq and Gemini keys', () => {
    expect(providerForKey(GSK)).toBe('groq');
    expect(providerForKey('AIza' + 'b'.repeat(35))).toBe('gemini');
    expect(providerForKey('sk-proj-123')).toBeNull();
    expect(providerForKey('gsk_short')).toBeNull();
  });
});

describe('groqChat', () => {
  it('uses the OpenAI-style API with low reasoning on GPT-OSS and a bearer key', async () => {
    const f = vi.fn(async () => reply('Have dal and curd.'));
    const text = await groqChat({ apiKey: GSK, model: 'openai/gpt-oss-120b', system: 'S', turns: [{ role: 'user', text: 'dinner?' }, { role: 'coach', text: 'hi' }], fetchFn: f as unknown as FetchFn });
    expect(text).toBe('Have dal and curd.');
    const [url, init] = f.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(init.headers.Authorization).toBe(`Bearer ${GSK}`);
    const b = body(f);
    expect(b.messages.map((m: { role: string }) => m.role)).toEqual(['system', 'user', 'assistant']);
    expect(b).toMatchObject({ model: 'openai/gpt-oss-120b', reasoning_effort: 'low', include_reasoning: false });
  });

  it('turns reasoning off for Qwen and hides any think tags', async () => {
    expect(groqReasoning('qwen/qwen3.8-27b')).toEqual({ reasoning_effort: 'none', reasoning_format: 'hidden' });
    expect(parseGroqReply({ choices: [{ message: { content: '<think>secret</think>Answer' } }] })).toBe('Answer');
  });

  it('retries without reasoning settings if a model rejects them', async () => {
    const f = vi.fn().mockResolvedValueOnce(err(400, '`reasoning_effort` is not supported with this model')).mockResolvedValueOnce(reply('ok'));
    expect(await groqChat({ apiKey: GSK, model: 'openai/gpt-oss-20b', system: 'S', turns: [{ role: 'user', text: 'hi' }], fetchFn: f as unknown as FetchFn })).toBe('ok');
    expect(body(f, 1).reasoning_effort).toBeUndefined();
  });

  it.each([
    [401, 'Invalid API Key', 'invalid_api_key', 'invalid_key'],
    [429, 'Rate limit reached on tokens per minute (TPM)', 'rate_limit_exceeded', 'quota'],
    [503, 'Service unavailable', '', 'unavailable'],
    [404, 'The model does not exist', 'model_not_found', 'bad_response'],
  ])('maps HTTP %s to %s', async (status, message, code, kind) => {
    const f = vi.fn(async () => err(status as number, message as string, code as string));
    await expect(groqChat({ apiKey: GSK, model: 'm', system: 'S', turns: [{ role: 'user', text: 'x' }], fetchFn: f as unknown as FetchFn })).rejects.toMatchObject({ kind });
  });

  it('rejects an empty reply', () => {
    expect(() => parseGroqReply({ choices: [{ message: { content: '' } }] })).toThrow();
  });
});

describe('listGroqModels', () => {
  it('orders chat models best first and finds the vision model', async () => {
    const f = vi.fn(async () => ok({ data: [{ id: 'whisper-large-v3' }, { id: 'openai/gpt-oss-20b' }, { id: 'qwen/qwen3.8-27b' }, { id: 'openai/gpt-oss-120b' }] }));
    expect(await listGroqModels(GSK, f as unknown as FetchFn)).toEqual({ chat: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'], vision: ['qwen/qwen3.8-27b'] });
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe('https://api.groq.com/openai/v1/models');
  });
  it('copes with renamed models and no vision model', async () => {
    const f = vi.fn(async () => ok({ data: [{ id: 'openai/gpt-oss-240b' }, { id: 'whisper-large-v3' }, { id: 'groq/compound' }] }));
    expect(await listGroqModels(GSK, f as unknown as FetchFn)).toEqual({ chat: ['openai/gpt-oss-240b'], vision: [] });
  });
});

describe('photos on Groq', () => {
  it('sends a food photo as a data URL with JSON mode and parses the estimate', async () => {
    const f = vi.fn(async () => reply(JSON.stringify({ items: [{ name: 'Idli', grams: 120, kcal: 160, protein_g: 5, carbs_g: 33, fat_g: 1, fiber_g: 2, confidence: 'medium' }], notes: '' })));
    const r = await estimateFromPhoto({ apiKey: GSK, model: 'qwen/qwen3.8-27b', jpegBase64: 'QUJD', language: 'en', fetchFn: f as unknown as FetchFn, provider: 'groq' });
    expect(r.items[0]?.name).toBe('Idli');
    const b = body(f);
    expect(b.response_format).toEqual({ type: 'json_object' });
    expect(b.messages[0].content[0]).toEqual({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,QUJD' } });
  });

  it('reads labels and compares two face photos', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(reply(JSON.stringify({ found: true, ingredients: 'Aqua, Glycerin, Niacinamide', product_name: 'Serum' })))
      .mockResolvedValueOnce(reply(JSON.stringify({ usable: true, issues: [], observations: ['Slight fullness under the eyes.'], comparison: 'Similar to before.', conditions_differ: false })));
    const label = await readIngredientLabel({ apiKey: GSK, model: 'qwen/qwen3.8-27b', jpegBase64: 'QQ', fetchFn: f as unknown as FetchFn, provider: 'groq' });
    expect(label.found).toBe(true);
    const face = await analyzeFace({ apiKey: GSK, model: 'qwen/qwen3.8-27b', jpegsBase64: ['QQ', 'Qg'], language: 'en', fetchFn: f as unknown as FetchFn, provider: 'groq' });
    expect(face.observations.length).toBe(1);
    expect(body(f, 1).messages[0].content.filter((c: { type: string }) => c.type === 'image_url')).toHaveLength(2);
  });
});
