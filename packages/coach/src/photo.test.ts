import { describe, expect, it, vi } from 'vitest';
import { buildPhotoPrompt, buildPhotoRequest, estimateFromPhoto, parsePhotoEstimate, scaleItem, type FetchFn } from './index';

const res = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

describe('food photo', () => {
  it('asks for strict JSON with the image inline', () => {
    const body = buildPhotoRequest(buildPhotoPrompt('en'), 'BASE64');
    expect(body.contents[0]!.parts[0]).toEqual({ inlineData: { mimeType: 'image/jpeg', data: 'BASE64' } });
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(buildPhotoPrompt('te')).toContain('simple Telugu');
  });

  it('reads and sanity-checks the estimate', () => {
    const e = parsePhotoEstimate(
      '```json\n' +
        JSON.stringify({
          items: [
            { name: 'Idli', grams: 120, kcal: 175, protein_g: 5.4, carbs_g: 36, fat_g: 0.6, fiber_g: 1.8 },
            { name: 'Sambar', grams: 150, kcal: 2000, protein_g: 5, carbs_g: 14, fat_g: 4, fiber_g: 3 }, // kcal way off → from macros
            { name: '', grams: 50, kcal: 10, protein_g: 1, carbs_g: 1, fat_g: 0 }, // no name → dropped
            { name: 'Huge', grams: 99999, kcal: 100, protein_g: 5, carbs_g: 15, fat_g: 2 }, // clamped
          ],
          confidence: 'medium',
          note: 'Portion of sambar is a guess.',
        }) +
        '\n```',
    );
    expect(e.items).toEqual([
      { name: 'Idli', grams: 120, kcal: 175, protein: 5.4, carbs: 36, fat: 0.6, fiber: 1.8 },
      { name: 'Sambar', grams: 150, kcal: 112, protein: 5, carbs: 14, fat: 4, fiber: 3 },
      { name: 'Huge', grams: 2000, kcal: 100, protein: 5, carbs: 15, fat: 2, fiber: 0 },
    ]);
    expect(e.confidence).toBe('medium');
    expect(e.note).toBe('Portion of sambar is a guess.');
  });

  it('handles non-food photos and broken replies', () => {
    expect(parsePhotoEstimate('{"items":[],"confidence":"high","note":"This is a cat."}')).toEqual({ items: [], confidence: 'high', note: 'This is a cat.' });
    expect(parsePhotoEstimate('{"items":[],"confidence":"sure"}').confidence).toBe('low');
    expect(() => parsePhotoEstimate('Sorry, I cannot help')).toThrow(/not JSON/);
    expect(() => parsePhotoEstimate('{"foods":[]}')).toThrow(/no items/);
  });

  it('scales an item when the portion is corrected', () => {
    expect(scaleItem({ name: 'Rice', grams: 200, kcal: 260, protein: 5.4, carbs: 56, fat: 0.6, fiber: 0.8 }, 150)).toEqual({
      name: 'Rice',
      grams: 150,
      kcal: 195,
      protein: 4.1,
      carbs: 42,
      fat: 0.5,
      fiber: 0.6,
    });
  });

  it('calls Gemini with the key in a header and maps errors', async () => {
    const fetchFn = vi.fn<FetchFn>(async () =>
      res(200, { candidates: [{ content: { parts: [{ text: '{"items":[{"name":"Dosa","grams":100,"kcal":168,"protein_g":3.9,"carbs_g":29,"fat_g":3.7}],"confidence":"high","note":""}' }] } }] }),
    );
    const e = await estimateFromPhoto({ apiKey: 'K', model: 'gemini-3.6-flash', jpegBase64: 'B', language: 'en', fetchFn });
    expect(e.items[0]).toMatchObject({ name: 'Dosa', kcal: 168, fiber: 0 });
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).not.toContain('K');
    expect(init.headers['x-goog-api-key']).toBe('K');
    await expect(estimateFromPhoto({ apiKey: 'K', model: 'm', jpegBase64: 'B', language: 'en', fetchFn: async () => res(429, { error: { status: 'RESOURCE_EXHAUSTED' } }) })).rejects.toMatchObject({ kind: 'quota' });
  });
});
