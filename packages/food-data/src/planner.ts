import { allergensFromText, hasAllergen, isDisliked } from './allergens';
import { requireFood } from './foods';
import { bestMeasure, nutrientsFor, roundNutrients, sumNutrients } from './portion';
import { TEMPLATES, type MealSlot, type MealTemplate } from './templates';
import type { FoodDiet, MeasureKey, Nutrients } from './types';

export type DietType = 'vegan' | 'vegetarian' | 'eggetarian' | 'non_vegetarian';

export interface PlannerInput {
  /** Local date, YYYY-MM-DD; the same inputs always give the same plan. */
  date: string;
  targetKcal: number;
  targetProteinG: number;
  dietType: DietType;
  allergies: string[];
  dislikes: string[];
  cookingTime?: 'none' | 'under_15' | 'under_30' | 'over_30';
  budget?: 'low' | 'medium' | 'high';
  /** How many times each meal has been swapped (0 = first suggestion). */
  swaps?: Partial<Record<MealSlot, number>>;
}

export interface PlannedItem {
  foodId: string;
  grams: number;
  measure: { key: MeasureKey; count: number };
  nutrients: Nutrients;
}

export interface PlannedMeal {
  slot: MealSlot;
  templateId: string;
  items: PlannedItem[];
  totals: Nutrients;
  /** How many different suggestions exist for this meal (for "swap"). */
  options: number;
}

export interface DayPlan {
  date: string;
  meals: PlannedMeal[];
  totals: Nutrients;
  targetKcal: number;
  targetProteinG: number;
}

export const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'snack', 'dinner'];
export const SLOT_SHARE: Record<MealSlot, number> = { breakfast: 0.25, lunch: 0.35, snack: 0.1, dinner: 0.3 };

const DIET_RANK: Record<FoodDiet, number> = { vegan: 0, vegetarian: 1, egg: 2, nonveg: 3 };
const ALLOWED_RANK: Record<DietType, number> = { vegan: 0, vegetarian: 1, eggetarian: 2, non_vegetarian: 3 };

/** Small deterministic hash (FNV-1a) so a date always maps to the same suggestion. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function foodAllowed(foodId: string, input: PlannerInput, allergens: ReturnType<typeof allergensFromText>): boolean {
  const f = requireFood(foodId);
  if (DIET_RANK[f.diet] > ALLOWED_RANK[input.dietType]) return false;
  if (hasAllergen(f, allergens)) return false;
  if (isDisliked(f, input.dislikes)) return false;
  return true;
}

/** Templates this person can eat for a meal, in a stable order. */
export function eligibleTemplates(slot: MealSlot, input: PlannerInput): MealTemplate[] {
  const allergens = allergensFromText(input.allergies);
  let list = TEMPLATES.filter(
    (t) =>
      t.slot === slot &&
      !(input.budget === 'low' && t.premium) &&
      t.items.every(([id]) => foodAllowed(id, input, allergens)),
  );
  if (input.cookingTime === 'none' || input.cookingTime === 'under_15') {
    const quick = list.filter((t) => t.quick);
    if (quick.length >= 2) list = quick;
  }
  return list;
}

function roundGrams(foodId: string, grams: number): number {
  const f = requireFood(foodId);
  const def = f.measures[0]!;
  if (def.key === 'piece' || def.key === 'slice') {
    return Math.max(1, Math.round(grams / def.grams)) * def.grams;
  }
  const step = def.key === 'tbsp' || def.key === 'tsp' || def.key === 'handful' ? 5 : 10;
  return Math.max(step, Math.round(grams / step) * step);
}

function buildMeal(t: MealTemplate, targetKcal: number, options: number): PlannedMeal {
  const baseKcal = sumNutrients(t.items.map(([id, g]) => nutrientsFor(requireFood(id), g))).kcal;
  const scale = Math.min(1.6, Math.max(0.6, targetKcal / baseKcal));
  const items = t.items.map(([foodId, g]) => {
    const grams = roundGrams(foodId, g * scale);
    const food = requireFood(foodId);
    return { foodId, grams, measure: bestMeasure(food, grams), nutrients: roundNutrients(nutrientsFor(food, grams)) };
  });
  return { slot: t.slot, templateId: t.id, items, totals: roundNutrients(sumNutrients(items.map((i) => i.nutrients))), options };
}

/** The main protein dish of a template (to avoid the same curry at lunch and dinner). */
const mainDish = (t: MealTemplate) => t.items.find(([id]) => !['rice_cooked', 'phulka', 'salad', 'curd'].includes(id))?.[0];

const PROTEIN_ADDONS: [foodId: string, grams: number][] = [
  ['boiled_egg', 50],
  ['curd', 100],
  ['paneer', 50],
  ['sprouts', 100],
  ['roasted_chana', 30],
];

/**
 * Builds one day's plan: picks a template per meal (diet, allergies, dislikes,
 * budget and cooking time respected), scales portions to the calorie split,
 * then tops up protein with simple add-ons if the day falls short.
 */
export function planDay(input: PlannerInput): DayPlan {
  if (!(input.targetKcal >= 1000 && input.targetKcal <= 5000)) throw new RangeError('Calorie target out of range');
  const allergens = allergensFromText(input.allergies);
  const meals: PlannedMeal[] = [];
  let lunchMain: string | undefined;

  for (const slot of SLOTS) {
    const list = eligibleTemplates(slot, input);
    if (list.length === 0) continue;
    const swaps = input.swaps?.[slot] ?? 0;
    let idx = (hash(`${input.date}:${slot}`) + swaps) % list.length;
    if (slot === 'dinner' && list.length > 1 && mainDish(list[idx]!) === lunchMain) idx = (idx + 1) % list.length;
    const t = list[idx]!;
    if (slot === 'lunch') lunchMain = mainDish(t);
    meals.push(buildMeal(t, input.targetKcal * SLOT_SHARE[slot], list.length));
  }

  // Protein top-up, at most two add-ons, on the meals with the least protein.
  let totals = sumNutrients(meals.map((m) => m.totals));
  for (let added = 0; added < 2 && totals.protein < input.targetProteinG * 0.9; added++) {
    const addon = PROTEIN_ADDONS.find(([id]) => foodAllowed(id, input, allergens));
    if (!addon) break;
    const meal = [...meals].sort((a, b) => a.totals.protein - b.totals.protein)[0];
    if (!meal) break;
    const [foodId, grams] = addon;
    const food = requireFood(foodId);
    const existing = meal.items.find((i) => i.foodId === foodId);
    if (existing) {
      existing.grams += grams;
      existing.measure = bestMeasure(food, existing.grams);
      existing.nutrients = roundNutrients(nutrientsFor(food, existing.grams));
    } else {
      meal.items.push({ foodId, grams, measure: bestMeasure(food, grams), nutrients: roundNutrients(nutrientsFor(food, grams)) });
    }
    meal.totals = roundNutrients(sumNutrients(meal.items.map((i) => i.nutrients)));
    totals = sumNutrients(meals.map((m) => m.totals));
  }

  return {
    date: input.date,
    meals,
    totals: roundNutrients(totals),
    targetKcal: input.targetKcal,
    targetProteinG: input.targetProteinG,
  };
}

/** Plans for `days` consecutive dates starting at `startDate` (YYYY-MM-DD). */
export function planWeek(input: Omit<PlannerInput, 'date' | 'swaps'> & { startDate: string; days?: number; swapsByDate?: Record<string, PlannerInput['swaps']> }): DayPlan[] {
  const [y, m, d] = input.startDate.split('-').map(Number) as [number, number, number];
  const out: DayPlan[] = [];
  for (let i = 0; i < (input.days ?? 7); i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i));
    const date = dt.toISOString().slice(0, 10);
    out.push(planDay({ ...input, date, swaps: input.swapsByDate?.[date] }));
  }
  return out;
}
