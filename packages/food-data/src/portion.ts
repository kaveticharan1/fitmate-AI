import { requireFood } from './foods';
import type { Food, MeasureKey, Nutrients } from './types';

export type OilLevel = 'less' | 'normal' | 'more';

/** Multiplier applied to a dish's typical cooking oil. */
export const OIL_FACTORS: Record<OilLevel, number> = { less: 0.5, normal: 1, more: 1.6 };

export const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

const r1 = (n: number) => Math.round(n * 10) / 10;

export function addNutrients(a: Nutrients, b: Nutrients): Nutrients {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
    fiber: a.fiber + b.fiber,
  };
}

export function roundNutrients(n: Nutrients): Nutrients {
  return { kcal: Math.round(n.kcal), protein: r1(n.protein), carbs: r1(n.carbs), fat: r1(n.fat), fiber: r1(n.fiber) };
}

export function sumNutrients(list: Nutrients[]): Nutrients {
  return list.reduce(addNutrients, ZERO);
}

/** Grams for `count` of a food's household measure (e.g. 2 idli = 80 g). */
export function gramsFor(food: Food, measure: MeasureKey, count: number): number {
  const m = food.measures.find((x) => x.key === measure);
  if (!m) throw new Error(`${food.id} has no measure ${measure}`);
  return m.grams * count;
}

/**
 * Nutrition for `grams` of a food. For dishes with typical oil, the oil level
 * scales only the oil part: e.g. "less" removes half the oil's fat and calories.
 */
export function nutrientsFor(food: Food, grams: number, oil: OilLevel = 'normal'): Nutrients {
  if (!(grams >= 0) || !Number.isFinite(grams)) throw new RangeError('Quantity must be zero or more');
  const k = grams / 100;
  const p = food.per100g;
  let fat = p.fat;
  let kcal = p.kcal;
  if (food.oilPer100g && oil !== 'normal') {
    const extraOil = (OIL_FACTORS[oil] - 1) * food.oilPer100g;
    fat = Math.max(0, fat + extraOil);
    kcal = Math.max(0, kcal + extraOil * 9);
  }
  return { kcal: kcal * k, protein: p.protein * k, carbs: p.carbs * k, fat: fat * k, fiber: p.fiber * k };
}

export function nutrientsForId(id: string, grams: number, oil: OilLevel = 'normal'): Nutrients {
  return nutrientsFor(requireFood(id), grams, oil);
}

/** Readable quantity in the most natural household unit, e.g. "3 piece", "1.5 katori". */
export function bestMeasure(food: Food, grams: number): { key: MeasureKey; count: number } {
  const options = food.measures.filter((m) => m.key !== 'g');
  for (const m of options) {
    const count = grams / m.grams;
    const step = m.key === 'piece' || m.key === 'slice' ? 1 : 0.5;
    const rounded = Math.round(count / step) * step;
    if (rounded > 0 && Math.abs(rounded - count) / count < 0.15) return { key: m.key, count: rounded };
  }
  return { key: 'g', count: Math.round(grams) };
}

// ── Family-pot recipes ─────────────────────────────────────────────────────

export interface RecipeIngredient {
  foodId: string;
  grams: number;
}

export interface RecipeInput {
  ingredients: RecipeIngredient[];
  /** How many servings the pot makes. */
  servings: number;
  /** Weight of the whole cooked pot, if weighed; enables logging by grams. */
  totalCookedGrams?: number | null;
}

export interface RecipeNutrition {
  total: Nutrients;
  perServing: Nutrients;
  /** Per 100 g of cooked food, when the cooked weight is known. */
  per100g: Nutrients | null;
}

/** Nutrition of a whole home-cooked pot, then shared out by servings or by weight. */
export function recipeNutrition(r: RecipeInput): RecipeNutrition {
  if (!(r.servings > 0)) throw new RangeError('Servings must be more than zero');
  const total = sumNutrients(r.ingredients.map((i) => nutrientsForId(i.foodId, i.grams)));
  const scale = (n: Nutrients, f: number): Nutrients => ({
    kcal: n.kcal * f,
    protein: n.protein * f,
    carbs: n.carbs * f,
    fat: n.fat * f,
    fiber: n.fiber * f,
  });
  return {
    total,
    perServing: scale(total, 1 / r.servings),
    per100g: r.totalCookedGrams && r.totalCookedGrams > 0 ? scale(total, 100 / r.totalCookedGrams) : null,
  };
}

/** Your share of a pot: by servings eaten, or by grams eaten when the pot was weighed. */
export function recipePortion(r: RecipeInput, eaten: { servings?: number; grams?: number }): Nutrients {
  const n = recipeNutrition(r);
  if (eaten.grams != null) {
    if (!n.per100g) throw new Error('Weigh the cooked pot to log by grams');
    return {
      kcal: (n.per100g.kcal * eaten.grams) / 100,
      protein: (n.per100g.protein * eaten.grams) / 100,
      carbs: (n.per100g.carbs * eaten.grams) / 100,
      fat: (n.per100g.fat * eaten.grams) / 100,
      fiber: (n.per100g.fiber * eaten.grams) / 100,
    };
  }
  const s = eaten.servings ?? 1;
  return {
    kcal: n.perServing.kcal * s,
    protein: n.perServing.protein * s,
    carbs: n.perServing.carbs * s,
    fat: n.perServing.fat * s,
    fiber: n.perServing.fiber * s,
  };
}
