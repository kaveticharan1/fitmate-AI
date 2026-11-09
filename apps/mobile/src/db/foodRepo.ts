import {
  bestMeasure,
  gramsFor,
  nutrientsFor,
  recipePortion,
  requireFood,
  roundNutrients,
  sumNutrients,
  type MeasureKey,
  type Nutrients,
  type OilLevel,
  type PlannedMeal,
} from '@fitmate/food-data';
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import { nowIso } from '../lib/time';
import { getDb } from './client';
import {
  favouriteFoods,
  foodLogEntries,
  mealPlanChoices,
  recipeIngredients,
  recipes,
  type FoodLogEntryRow,
  type Meal,
  type RecipeIngredientRow,
  type RecipeRow,
} from './schema';

const live = isNull(foodLogEntries.deletedAt);

export function listEntries(date: string): FoodLogEntryRow[] {
  return getDb()
    .select()
    .from(foodLogEntries)
    .where(and(eq(foodLogEntries.loggedOn, date), live))
    .orderBy(asc(foodLogEntries.createdAt))
    .all();
}

export function getEntry(id: string): FoodLogEntryRow | null {
  return getDb().select().from(foodLogEntries).where(and(eq(foodLogEntries.id, id), live)).get() ?? null;
}

export function totalsOf(entries: Pick<FoodLogEntryRow, 'kcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG'>[]): Nutrients {
  return roundNutrients(
    sumNutrients(entries.map((e) => ({ kcal: e.kcal, protein: e.proteinG, carbs: e.carbsG, fat: e.fatG, fiber: e.fiberG }))),
  );
}

export interface FoodEntryInput {
  date: string;
  meal: Meal;
  foodId: string;
  measureKey: MeasureKey;
  count: number;
  oil: OilLevel;
  source?: 'manual' | 'plan' | 'repeat';
}

function foodValues(input: Omit<FoodEntryInput, 'date' | 'meal' | 'source'>) {
  const food = requireFood(input.foodId);
  const grams = gramsFor(food, input.measureKey, input.count);
  if (!(grams > 0 && grams <= 5000)) throw new RangeError('Quantity must be between 1 g and 5 kg');
  const n = roundNutrients(nutrientsFor(food, grams, input.oil));
  return {
    foodId: food.id,
    name: food.name,
    quantityG: grams,
    measureKey: input.measureKey,
    measureCount: input.count,
    oilLevel: food.oilPer100g ? input.oil : ('normal' as const),
    kcal: n.kcal,
    proteinG: n.protein,
    carbsG: n.carbs,
    fatG: n.fat,
    fiberG: n.fiber,
  };
}

export function addFoodEntry(input: FoodEntryInput): string {
  const id = randomUUID();
  const now = nowIso();
  getDb()
    .insert(foodLogEntries)
    .values({
      id,
      loggedOn: input.date,
      meal: input.meal,
      recipeId: null,
      source: input.source ?? 'manual',
      createdAt: now,
      updatedAt: now,
      ...foodValues(input),
    })
    .run();
  return id;
}

export function updateFoodEntry(id: string, patch: Omit<FoodEntryInput, 'date' | 'source'>): void {
  getDb()
    .update(foodLogEntries)
    .set({ meal: patch.meal, updatedAt: nowIso(), ...foodValues(patch) })
    .where(eq(foodLogEntries.id, id))
    .run();
}

export function deleteEntry(id: string): void {
  const now = nowIso();
  getDb().update(foodLogEntries).set({ deletedAt: now, updatedAt: now }).where(eq(foodLogEntries.id, id)).run();
}

/** Copies one meal from another day ("same as yesterday"). Returns how many items were copied. */
export function copyMeal(fromDate: string, toDate: string, meal: Meal): number {
  const source = listEntries(fromDate).filter((e) => e.meal === meal);
  const now = nowIso();
  const db = getDb();
  db.transaction((tx) => {
    for (const e of source) {
      tx.insert(foodLogEntries)
        .values({ ...e, id: randomUUID(), loggedOn: toDate, source: e.source === 'photo' ? 'photo' : 'repeat', createdAt: now, updatedAt: now, deletedAt: null })
        .run();
    }
  });
  return source.length;
}

/** Food ids logged most recently (newest first, no repeats). */
export function recentFoodIds(limit = 15): string[] {
  const rows = getDb()
    .select({ foodId: foodLogEntries.foodId })
    .from(foodLogEntries)
    .where(live)
    .orderBy(desc(foodLogEntries.createdAt))
    .limit(200)
    .all();
  const out: string[] = [];
  for (const r of rows) if (r.foodId && !out.includes(r.foodId)) out.push(r.foodId);
  return out.slice(0, limit);
}

export function favouriteIds(): string[] {
  return getDb().select().from(favouriteFoods).orderBy(desc(favouriteFoods.createdAt)).all().map((r) => r.foodId);
}

export function setFavourite(foodId: string, on: boolean): void {
  const db = getDb();
  if (on) db.insert(favouriteFoods).values({ foodId, createdAt: nowIso() }).onConflictDoNothing().run();
  else db.delete(favouriteFoods).where(eq(favouriteFoods.foodId, foodId)).run();
}

// ── Family-pot recipes ─────────────────────────────────────────────────────

export interface RecipeWithIngredients extends RecipeRow {
  ingredients: RecipeIngredientRow[];
}

export function listRecipes(): RecipeWithIngredients[] {
  const db = getDb();
  const rs = db.select().from(recipes).where(isNull(recipes.deletedAt)).orderBy(asc(recipes.name)).all();
  if (rs.length === 0) return [];
  const ings = db
    .select()
    .from(recipeIngredients)
    .where(and(inArray(recipeIngredients.recipeId, rs.map((r) => r.id)), isNull(recipeIngredients.deletedAt)))
    .all();
  return rs.map((r) => ({ ...r, ingredients: ings.filter((i) => i.recipeId === r.id) }));
}

export function getRecipe(id: string): RecipeWithIngredients | null {
  return listRecipes().find((r) => r.id === id) ?? null;
}

export interface RecipeSave {
  name: string;
  servings: number;
  totalCookedG: number | null;
  ingredients: { foodId: string; grams: number }[];
}

export function saveRecipe(input: RecipeSave, id?: string): string {
  const now = nowIso();
  const recipeId = id ?? randomUUID();
  getDb().transaction((tx) => {
    if (id) {
      tx.update(recipes)
        .set({ name: input.name, servings: input.servings, totalCookedG: input.totalCookedG, updatedAt: now })
        .where(eq(recipes.id, id))
        .run();
      tx.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, id)).run();
    } else {
      tx.insert(recipes)
        .values({ id: recipeId, name: input.name, servings: input.servings, totalCookedG: input.totalCookedG, createdAt: now, updatedAt: now })
        .run();
    }
    for (const ing of input.ingredients) {
      requireFood(ing.foodId);
      tx.insert(recipeIngredients)
        .values({ id: randomUUID(), recipeId, foodId: ing.foodId, grams: ing.grams, createdAt: now, updatedAt: now })
        .run();
    }
  });
  return recipeId;
}

export function deleteRecipe(id: string): void {
  const now = nowIso();
  getDb().update(recipes).set({ deletedAt: now, updatedAt: now }).where(eq(recipes.id, id)).run();
}

/** Logs your share of a pot by servings, or by grams if the pot was weighed. */
export function addRecipeEntry(input: { date: string; meal: Meal; recipeId: string; servings?: number; grams?: number }): string {
  const r = getRecipe(input.recipeId);
  if (!r) throw new Error('Recipe not found');
  const recipe = { ingredients: r.ingredients, servings: r.servings, totalCookedGrams: r.totalCookedG };
  const n = roundNutrients(recipePortion(recipe, { servings: input.servings, grams: input.grams }));
  // Quantity in grams: weighed pot → exact; otherwise an estimate from raw ingredient weight.
  const grams =
    input.grams ?? Math.round(((r.totalCookedG ?? r.ingredients.reduce((s, i) => s + i.grams, 0)) / r.servings) * (input.servings ?? 1));
  const id = randomUUID();
  const now = nowIso();
  getDb()
    .insert(foodLogEntries)
    .values({
      id,
      loggedOn: input.date,
      meal: input.meal,
      foodId: null,
      recipeId: r.id,
      name: r.name,
      quantityG: Math.max(1, grams),
      measureKey: input.grams != null ? 'g' : 'serving',
      measureCount: input.grams ?? input.servings ?? 1,
      oilLevel: 'normal',
      kcal: n.kcal,
      proteinG: n.protein,
      carbsG: n.carbs,
      fatG: n.fat,
      fiberG: n.fiber,
      source: 'recipe',
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return id;
}

// ── Meal plan choices ──────────────────────────────────────────────────────

export interface PlanChoice {
  swapIndex: number;
  eatenAt: string | null;
}

export function planChoices(date: string): Partial<Record<Meal, PlanChoice>> {
  const rows = getDb().select().from(mealPlanChoices).where(eq(mealPlanChoices.planDate, date)).all();
  return Object.fromEntries(rows.map((r) => [r.meal, { swapIndex: r.swapIndex, eatenAt: r.eatenAt }]));
}

export function swapPlannedMeal(date: string, meal: Meal): void {
  const current = planChoices(date)[meal];
  const now = nowIso();
  getDb()
    .insert(mealPlanChoices)
    .values({ planDate: date, meal, swapIndex: (current?.swapIndex ?? 0) + 1, eatenAt: null, updatedAt: now })
    .onConflictDoUpdate({
      target: [mealPlanChoices.planDate, mealPlanChoices.meal],
      set: { swapIndex: (current?.swapIndex ?? 0) + 1, updatedAt: now },
    })
    .run();
}

/** Adds every item of a planned meal to the diary and marks the meal as eaten. */
export function logPlannedMeal(date: string, planned: PlannedMeal): void {
  const now = nowIso();
  const meal = planned.slot as Meal;
  const current = planChoices(date)[meal];
  if (current?.eatenAt) return; // already logged
  getDb().transaction((tx) => {
    for (const item of planned.items) {
      const food = requireFood(item.foodId);
      const m = bestMeasure(food, item.grams);
      const n = roundNutrients(nutrientsFor(food, item.grams));
      tx.insert(foodLogEntries)
        .values({
          id: randomUUID(),
          loggedOn: date,
          meal,
          foodId: food.id,
          recipeId: null,
          name: food.name,
          quantityG: item.grams,
          measureKey: m.key,
          measureCount: m.count,
          oilLevel: 'normal',
          kcal: n.kcal,
          proteinG: n.protein,
          carbsG: n.carbs,
          fatG: n.fat,
          fiberG: n.fiber,
          source: 'plan',
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
    tx.insert(mealPlanChoices)
      .values({ planDate: date, meal, swapIndex: current?.swapIndex ?? 0, eatenAt: now, updatedAt: now })
      .onConflictDoUpdate({ target: [mealPlanChoices.planDate, mealPlanChoices.meal], set: { eatenAt: now, updatedAt: now } })
      .run();
  });
}
