import { describe, expect, it, vi } from 'vitest';
import { analyzeFace, buildFacePrompt, buildFaceRequest, parseFaceAnalysis, type FetchFn } from './index';

const res = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const reply = (o: unknown) => res({ candidates: [{ content: { parts: [{ text: JSON.stringify(o) }] } }] });

describe('face analysis', () => {
  it('asks for appearance only and sends older then newer photo', () => {
    const p = buildFacePrompt('en', true);
    expect(p).toMatch(/not a doctor/);
    expect(p).toMatch(/FIRST is older/);
    const body = buildFaceRequest(p, ['OLD', 'NEW']);
    expect(body.contents[0]!.parts.slice(0, 2)).toEqual([
      { inlineData: { mimeType: 'image/jpeg', data: 'OLD' } },
      { inlineData: { mimeType: 'image/jpeg', data: 'NEW' } },
    ]);
  });

  it('returns retake advice for unusable photos', () => {
    expect(parseFaceAnalysis('{"usable":false,"issues":["too_dark","blurry","made_up"],"observations":["x"]}')).toEqual({
      usable: false,
      issues: ['too_dark', 'blurry'],
      observations: [],
      comparison: null,
      conditionsDiffer: false,
    });
  });

  it('drops any sentence with medical, fat or fluid claims', () => {
    const r = parseFaceAnalysis(
      JSON.stringify({
        usable: true,
        issues: [],
        observations: ['The under-eye area appears slightly fuller.', 'This suggests water retention.', 'Possible thyroid issue.', 'Cheeks look similar.'],
        comparison: 'You have lost facial fat since last week.',
        conditions_differ: true,
      }),
    );
    expect(r.observations).toEqual(['The under-eye area appears slightly fuller.', 'Cheeks look similar.']);
    expect(r.comparison).toBeNull();
    expect(r.conditionsDiffer).toBe(true);
  });

  it('rejects malformed replies', () => {
    expect(() => parseFaceAnalysis('not json')).toThrow(/not JSON/);
    expect(() => parseFaceAnalysis('{"observations":[]}')).toThrow(/usable/);
  });

  it('calls Gemini with the key in a header and one or two photos only', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => reply({ usable: true, issues: [], observations: ['Looks rested.'], comparison: null, conditions_differ: false }));
    const r = await analyzeFace({ apiKey: 'K', model: 'm', jpegsBase64: ['A'], language: 'en', fetchFn });
    expect(r.observations).toEqual(['Looks rested.']);
    expect(fetchFn.mock.calls[0]![1].headers['x-goog-api-key']).toBe('K');
    await expect(analyzeFace({ apiKey: 'K', model: 'm', jpegsBase64: ['A', 'B', 'C'], language: 'en', fetchFn })).rejects.toMatchObject({ kind: 'bad_response' });
  });
});
