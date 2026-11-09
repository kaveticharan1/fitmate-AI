import { lookupBarcode, LookupError } from './packaged';

let mockSaved: { id: string; barcode: string } | null = null;
jest.mock('../../db/customFoodRepo', () => ({ findByBarcode: () => mockSaved }));
jest.mock('expo-constants', () => ({ expoConfig: { version: '0.9.0' } }));

const res = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

beforeEach(() => {
  mockSaved = null;
});

describe('barcode lookup', () => {
  it('uses a saved packaged food first, without going online', async () => {
    mockSaved = { id: 'c1', barcode: '8901058851298' };
    const fetchFn = jest.fn();
    expect(await lookupBarcode('8901058851298', fetchFn)).toEqual({ kind: 'saved', food: mockSaved });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('asks Open Food Facts with an app-only User-Agent', async () => {
    const fetchFn = jest.fn(async () =>
      res(200, { status: 1, product: { product_name: 'Oats', nutriments: { 'energy-kcal_100g': 389, proteins_100g: 13, carbohydrates_100g: 66, fat_100g: 7 } } }),
    );
    const r = await lookupBarcode('8901058851298', fetchFn);
    expect(r).toMatchObject({ kind: 'found', product: { name: 'Oats', complete: true } });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    expect(url).toMatch(/^https:\/\/world\.openfoodfacts\.org\/api\/v2\/product\/8901058851298\.json\?fields=/);
    expect(init.headers['User-Agent']).toBe('FitMate/0.9.0 (Android; personal fitness app)');
    expect(init.headers['User-Agent']).not.toMatch(/@/);
  });

  it('reports unknown products', async () => {
    expect(await lookupBarcode('1', async () => res(200, { status: 0 }))).toEqual({ kind: 'not_found', barcode: '1' });
    expect(await lookupBarcode('1', async () => res(404, { status: 0 }))).toEqual({ kind: 'not_found', barcode: '1' });
  });

  it('turns failures into network, server and timeout errors', async () => {
    await expect(lookupBarcode('1', async () => { throw new TypeError('Network request failed'); })).rejects.toMatchObject({ kind: 'network' });
    await expect(lookupBarcode('1', async () => res(503, {}))).rejects.toMatchObject({ kind: 'server' });
    const slow = (_u: string, init: { signal: AbortSignal }) =>
      new Promise<never>((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
    await expect(lookupBarcode('1', slow, 20)).rejects.toBeInstanceOf(LookupError);
    await expect(lookupBarcode('1', slow, 20)).rejects.toMatchObject({ kind: 'timeout' });
  });
});
