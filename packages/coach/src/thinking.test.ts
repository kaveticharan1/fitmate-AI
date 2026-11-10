import { describe, expect, it, vi } from 'vitest';
import { generateReply, thinkingConfig, type FetchFn } from './index';

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const reply = { candidates: [{ content: { parts: [{ text: 'Plan: dal, 3 L water, 30-min walk.' }] } }] };

describe('thinkingConfig', () => {
  it('uses thinking levels on Gemini 3+ and budgets on 2.5', () => {
    expect(thinkingConfig('gemini-3.5-flash', 'minimal')).toEqual({ thinkingLevel: 'minimal' });
    expect(thinkingConfig('gemini-3.6-flash', 'low')).toEqual({ thinkingLevel: 'low' });
    expect(thinkingConfig('gemini-2.5-flash', 'minimal')).toEqual({ thinkingBudget: 0 });
    expect(thinkingConfig('gemini-2.5-pro', 'minimal')).toEqual({ thinkingBudget: 128 });
    expect(thinkingConfig('gemini-2.0-flash', 'minimal')).toBeUndefined();
  });
});

describe('generateReply speed settings', () => {
  it('asks for minimal thinking and allows a minute', async () => {
    const fetchFn = vi.fn(async () => ok(reply)) as unknown as FetchFn;
    expect(await generateReply({ apiKey: 'k', model: 'gemini-3.5-flash', system: 's', turns: [{ role: 'user', text: 'Plan my day' }], fetchFn })).toMatch(/Plan/);
    const body = JSON.parse((fetchFn as unknown as { mock: { calls: [string, { body: string }][] } }).mock.calls[0]![1].body);
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'minimal' });
  });

  it('retries without the thinking setting if the model rejects it', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: { message: 'Unknown name "thinkingLevel" at generation_config.thinking_config', status: 'INVALID_ARGUMENT' } }) })
      .mockResolvedValueOnce(ok(reply));
    expect(await generateReply({ apiKey: 'k', model: 'gemini-3-flash', system: 's', turns: [{ role: 'user', text: 'hi' }], fetchFn: fetchFn as unknown as FetchFn })).toMatch(/Plan/);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchFn.mock.calls[1]![1].body).generationConfig.thinkingConfig).toBeUndefined();
  });

  it('does not retry other errors', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({ error: { status: 'RESOURCE_EXHAUSTED', message: 'quota' } }) });
    await expect(generateReply({ apiKey: 'k', model: 'gemini-3.5-flash', system: 's', turns: [{ role: 'user', text: 'hi' }], fetchFn: fetchFn as unknown as FetchFn })).rejects.toMatchObject({ kind: 'quota' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
