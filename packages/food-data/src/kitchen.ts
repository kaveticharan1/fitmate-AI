import { allergensFromText, hasAllergen, isDisliked } from './allergens';
import { FOODS, requireFood } from './foods';
import type { DietType } from './planner';
import type { Food, FoodDiet } from './types';

/**
 * Kitchen assistant (offline): "what can I cook with what I have?"
 * Matches the raw ingredients the user has against each dish's ingredient list.
 */

/** Assumed to be in every Indian kitchen (salt and spices aren't tracked at all). */
export const KITCHEN_STAPLES = ['oil', 'sugar'];

/** Any of these counts as "vegetables" for dishes made with mixed vegetables. */
export const VEGETABLE_IDS = ['carrot', 'cabbage', 'brinjal', 'okra', 'ivy_gourd', 'spinach', 'potato_raw', 'tomato', 'mixed_veg_raw'];

const DIET_RANK: Record<FoodDiet, number> = { vegan: 0, vegetarian: 1, egg: 2, nonveg: 3 };
const ALLOWED_RANK: Record<DietType, number> = { vegan: 0, vegetarian: 1, eggetarian: 2, non_vegetarian: 3 };

/** Every ingredient used by a dish, minus the staples, for the "what do you have?" picker. */
export function kitchenIngredients(): Food[] {
  const ids = new Set<string>();
  for (const f of FOODS) for (const r of f.raw ?? []) ids.add(r.id);
  for (const s of KITCHEN_STAPLES) ids.delete(s);
  return [...ids].map((id) => requireFood(id)).sort((a, b) => a.name.localeCompare(b.name));
}

export interface DishMatch {
  food: Food;
  /** Ingredient ids still needed (empty = can cook now). */
  missing: string[];
  /** Protein per 100 kcal, for ranking (higher = more filling for the calories). */
  proteinPer100Kcal: number;
}

export interface KitchenFilter {
  dietType: DietType;
  allergies: string[];
  dislikes: string[];
}

function has(id: string, have: Set<string>): boolean {
  if (KITCHEN_STAPLES.includes(id) || have.has(id)) return true;
  if (id === 'mixed_veg_raw') return VEGETABLE_IDS.some((v) => have.has(v));
  return false;
}

/** Dishes the user can make now, and ones missing just one ingredient. */
export function suggestDishes(haveIds: string[], filter: KitchenFilter, limit = 12): { canMake: DishMatch[]; missingOne: DishMatch[] } {
  const have = new Set(haveIds);
  if (have.size === 0) return { canMake: [], missingOne: [] };
  const allergens = allergensFromText(filter.allergies);
  const matches: DishMatch[] = [];
  for (const f of FOODS) {
    const raw = f.raw;
    if (!raw?.length || f.state === 'raw') continue;
    if (DIET_RANK[f.diet] > ALLOWED_RANK[filter.dietType]) continue;
    if (hasAllergen(f, allergens) || isDisliked(f, filter.dislikes)) continue;
    // A dish must use at least one thing the user actually has (not only staples).
    if (!raw.some((r) => !KITCHEN_STAPLES.includes(r.id) && has(r.id, have))) continue;
    const missing = raw.map((r) => r.id).filter((id) => !has(id, have));
    if (missing.length > 1) continue;
    const kcal = f.per100g.kcal || 1;
    matches.push({ food: f, missing, proteinPer100Kcal: Math.round((f.per100g.protein / kcal) * 1000) / 10 });
  }
  const byProtein = (a: DishMatch, b: DishMatch) => b.proteinPer100Kcal - a.proteinPer100Kcal || a.food.name.localeCompare(b.food.name);
  return {
    canMake: matches.filter((m) => m.missing.length === 0).sort(byProtein).slice(0, limit),
    missingOne: matches.filter((m) => m.missing.length === 1).sort(byProtein).slice(0, limit),
  };
}

/** A ready-made question for the AI coach, for ideas beyond the database. */
export function kitchenQuestion(haveIds: string[], language: 'en' | 'te'): string {
  const names = haveIds.map((id) => requireFood(id).name.replace(/\s*\(raw\)/i, '')).join(', ');
  return language === 'te'
    ? `నా దగ్గర ఇవి ఉన్నాయి: ${names}. నా లక్ష్యాలకు సరిపోయే, ఎక్కువ ప్రోటీన్ ఉన్న ఒక సులభమైన వంటకం సూచించండి — పదార్థాలు, దశలు, ఒక్కో సర్వింగ్‌కి సుమారు కేలరీలు, ప్రోటీన్.`
    : `I have: ${names}. Suggest one easy, high-protein dish that fits my targets — ingredients, short steps, and rough calories and protein per serving.`;
}
