/**
 * Packaged foods: barcode checks and reading Open Food Facts product data.
 * Open Food Facts is a free, open (ODbL) community database; values come from
 * product labels typed in by volunteers, so they are checked before use.
 */

export interface Per100 {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface PackagedProduct {
  barcode: string;
  name: string;
  brand: string | null;
  quantity: string | null;
  per100: Partial<Per100>;
  servingG: number | null;
  /** True when kcal, protein, carbs and fat per 100 g are all present and believable. */
  complete: boolean;
}

/** EAN-13, EAN-8, UPC-A (12) check digit validation. */
export function isValidBarcode(code: string): boolean {
  const c = code.trim();
  if (!/^\d{8}$|^\d{12,14}$/.test(c)) return false;
  const digits = c.split('').map(Number);
  const check = digits.pop()!;
  let sum = 0;
  // Weights 3,1,3,1… from the right (excluding the check digit).
  for (let i = digits.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += digits[i]! * w;
  return (10 - (sum % 10)) % 10 === check;
}

const LIMITS: Record<keyof Per100, number> = { kcal: 900, protein: 100, carbs: 100, fat: 100, fiber: 100 };

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Checks per-100 g values a person typed from a label (or that came from the database). */
export function checkPer100(p: Partial<Per100>): { ok: boolean; problems: (keyof Per100)[] } {
  const problems: (keyof Per100)[] = [];
  for (const k of ['kcal', 'protein', 'carbs', 'fat'] as const) {
    const v = p[k];
    if (v == null || v > LIMITS[k]) problems.push(k);
  }
  if (p.fiber != null && p.fiber > LIMITS.fiber) problems.push('fiber');
  // Macros can't weigh more than the food itself.
  if (!problems.length && (p.protein ?? 0) + (p.carbs ?? 0) + (p.fat ?? 0) > 105) problems.push('carbs');
  return { ok: problems.length === 0, problems };
}

/** Reads the /api/v2/product/{barcode}.json response. Returns null if the product is unknown. */
export function parseOffProduct(barcode: string, json: unknown): PackagedProduct | null {
  const body = json as { status?: number; product?: Record<string, unknown> };
  if (!body || body.status !== 1 || !body.product) return null;
  const p = body.product;
  const n = (p.nutriments ?? {}) as Record<string, unknown>;
  let kcal = num(n['energy-kcal_100g']);
  if (kcal == null) {
    const kj = num(n['energy-kj_100g']) ?? num(n['energy_100g']);
    if (kj != null) kcal = kj / 4.184;
  }
  const per100: Partial<Per100> = {};
  const set = (k: keyof Per100, v: number | undefined) => {
    if (v != null) per100[k] = k === 'kcal' ? Math.round(v) : round1(v);
  };
  set('kcal', kcal);
  set('protein', num(n['proteins_100g']));
  set('carbs', num(n['carbohydrates_100g']));
  set('fat', num(n['fat_100g']));
  set('fiber', num(n['fiber_100g']));

  const name = String(p.product_name_en || p.product_name || p.generic_name || '').trim();
  const brand = String(p.brands || '').split(',')[0]?.trim() || null;
  const servingQ = num(p.serving_quantity);
  const servingG = servingQ != null && servingQ > 0 && servingQ <= 2000 ? round1(servingQ) : null;
  return {
    barcode,
    name: name || brand || barcode,
    brand,
    quantity: typeof p.quantity === 'string' && p.quantity.trim() ? p.quantity.trim() : null,
    per100,
    servingG,
    complete: checkPer100(per100).ok,
  };
}

export const OFF_FIELDS = 'product_name,product_name_en,generic_name,brands,quantity,serving_quantity,nutriments';

export function offProductUrl(barcode: string): string {
  return `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${OFF_FIELDS}`;
}

/** Nutrients for an amount in grams. */
export function per100For(per100: Per100, grams: number): Per100 {
  const f = grams / 100;
  return {
    kcal: Math.round(per100.kcal * f),
    protein: round1(per100.protein * f),
    carbs: round1(per100.carbs * f),
    fat: round1(per100.fat * f),
    fiber: round1(per100.fiber * f),
  };
}
