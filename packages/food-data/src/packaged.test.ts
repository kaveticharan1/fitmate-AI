import { describe, expect, it } from 'vitest';
import { checkPer100, isValidBarcode, offProductUrl, parseOffProduct, per100For } from './packaged';

describe('barcodes', () => {
  it('validates check digits', () => {
    expect(isValidBarcode('8901058851298')).toBe(true); // EAN-13 (India prefix 890)
    expect(isValidBarcode('8901058851299')).toBe(false);
    expect(isValidBarcode('96385074')).toBe(true); // EAN-8
    expect(isValidBarcode('036000291452')).toBe(true); // UPC-A
    expect(isValidBarcode('12345')).toBe(false);
    expect(isValidBarcode('abc')).toBe(false);
  });
});

describe('Open Food Facts', () => {
  it('reads a complete product', () => {
    const p = parseOffProduct('8901058851298', {
      status: 1,
      product: {
        product_name: 'Masala Noodles',
        brands: 'Maggi, Nestlé',
        quantity: '70 g',
        serving_quantity: '70',
        nutriments: { 'energy-kcal_100g': 427, proteins_100g: 8.6, carbohydrates_100g: 63.3, fat_100g: 15.1, fiber_100g: '2,4' },
      },
    })!;
    expect(p).toEqual({
      barcode: '8901058851298',
      name: 'Masala Noodles',
      brand: 'Maggi',
      quantity: '70 g',
      per100: { kcal: 427, protein: 8.6, carbs: 63.3, fat: 15.1, fiber: 2.4 },
      servingG: 70,
      complete: true,
    });
  });

  it('converts kJ and marks missing values incomplete', () => {
    const p = parseOffProduct('1', { status: 1, product: { brands: 'Brand', nutriments: { energy_100g: 1674, proteins_100g: 5 } } })!;
    expect(p.per100).toEqual({ kcal: 400, protein: 5 });
    expect(p.name).toBe('Brand');
    expect(p.complete).toBe(false);
  });

  it('returns null for unknown products', () => {
    expect(parseOffProduct('1', { status: 0, status_verbose: 'product not found' })).toBeNull();
    expect(parseOffProduct('1', null)).toBeNull();
  });

  it('checks typed label values', () => {
    expect(checkPer100({ kcal: 120, protein: 3, carbs: 20, fat: 3 }).ok).toBe(true);
    expect(checkPer100({ kcal: 1200, protein: 3, carbs: 20, fat: 3 }).problems).toEqual(['kcal']);
    expect(checkPer100({ kcal: 300, protein: 60, carbs: 60, fat: 10 }).ok).toBe(false);
    expect(checkPer100({ protein: 3 }).problems).toEqual(['kcal', 'carbs', 'fat']);
  });

  it('builds a small request and scales portions', () => {
    expect(offProductUrl('8901058851298')).toBe(
      'https://world.openfoodfacts.org/api/v2/product/8901058851298.json?fields=product_name,product_name_en,generic_name,brands,quantity,serving_quantity,nutriments',
    );
    expect(per100For({ kcal: 427, protein: 8.6, carbs: 63.3, fat: 15.1, fiber: 2.4 }, 70)).toEqual({ kcal: 299, protein: 6, carbs: 44.3, fat: 10.6, fiber: 1.7 });
  });
});
