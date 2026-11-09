/**
 * @jest-environment node
 */
import { randomBytes } from 'node:crypto';
import { generateDbKey, lockoutDelayMs, unwrapDbKey, wrapDbKey } from './keyWrap';

const rnd = (n: number) => new Uint8Array(randomBytes(n));
const FAST = { N: 2 ** 10, r: 8, p: 1 };

describe('database key wrapping', () => {
  it('generates 256-bit hex keys that differ every time', () => {
    const a = generateDbKey(rnd);
    const b = generateDbKey(rnd);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });

  it('unwraps with the right PIN only', () => {
    const key = generateDbKey(rnd);
    const wrapped = wrapDbKey(key, '482916', rnd, FAST);
    expect(unwrapDbKey(wrapped, '482916')).toBe(key);
    expect(unwrapDbKey(wrapped, '482917')).toBeNull();
    expect(JSON.stringify(wrapped)).not.toContain(key);
  });

  it('detects a tampered blob', () => {
    const key = generateDbKey(rnd);
    const wrapped = wrapDbKey(key, '482916', rnd, FAST);
    const flipped = (wrapped.wrapped[0] === 'a' ? 'b' : 'a') + wrapped.wrapped.slice(1);
    expect(unwrapDbKey({ ...wrapped, wrapped: flipped }, '482916')).toBeNull();
  });

  it('rejects malformed keys', () => {
    expect(() => wrapDbKey('not-hex', '482916', rnd, FAST)).toThrow();
  });
});

describe('wrong-PIN delays', () => {
  it('allows four free tries, then grows', () => {
    expect([1, 2, 3, 4].map(lockoutDelayMs)).toEqual([0, 0, 0, 0]);
    expect(lockoutDelayMs(5)).toBe(30_000);
    expect(lockoutDelayMs(6)).toBe(60_000);
    expect(lockoutDelayMs(7)).toBe(300_000);
    expect(lockoutDelayMs(8)).toBe(900_000);
    expect(lockoutDelayMs(9)).toBe(1_800_000);
    expect(lockoutDelayMs(50)).toBe(1_800_000);
  });
});
