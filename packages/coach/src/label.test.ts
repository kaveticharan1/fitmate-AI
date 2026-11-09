import { describe, expect, it } from 'vitest';
import { LABEL_PROMPT, parseLabelReading } from './index';

describe('label reading', () => {
  it('forbids guessing a formula from the product name', () => {
    expect(LABEL_PROMPT).toMatch(/Do not add, guess or complete/);
  });
  it('accepts a real list and rejects missing or one-word lists', () => {
    expect(parseLabelReading('{"found":true,"ingredients":"Aqua, Niacinamide, Glycerin","product_name":"Serum"}')).toEqual({ found: true, ingredients: 'Aqua, Niacinamide, Glycerin', productName: 'Serum' });
    expect(parseLabelReading('{"found":true,"ingredients":"Aqua"}').found).toBe(false);
    expect(parseLabelReading('{"found":false,"ingredients":"Aqua, X"}')).toEqual({ found: false, ingredients: '', productName: null });
    expect(() => parseLabelReading('sorry')).toThrow(/not JSON/);
  });
});
