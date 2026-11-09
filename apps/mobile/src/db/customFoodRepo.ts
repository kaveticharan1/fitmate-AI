import { per100For, type Per100 } from '@fitmate/food-data';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import { nowIso } from '../lib/time';
import { getDb } from './client';
import { customFoods, foodLogEntries, type CustomFoodRow, type Meal } from './schema';

export interface CustomFoodInput {
  barcode: string | null;
  name: string;
  brand: string | null;
  per100: Per100;
  servingG: number | null;
  source: 'barcode' | 'label';
}

export const per100Of = (f: CustomFoodRow): Per100 => ({ kcal: f.kcal100, protein: f.protein100, carbs: f.carbs100, fat: f.fat100, fiber: f.fiber100 });

export function getCustomFood(id: string): CustomFoodRow | null {
  return getDb().select().from(customFoods).where(eq(customFoods.id, id)).get() ?? null;
}

export function findByBarcode(barcode: string): CustomFoodRow | null {
  return getDb().select().from(customFoods).where(and(eq(customFoods.barcode, barcode), isNull(customFoods.deletedAt))).get() ?? null;
}

export function listCustomFoods(): CustomFoodRow[] {
  return getDb().select().from(customFoods).where(isNull(customFoods.deletedAt)).orderBy(desc(customFoods.updatedAt)).all();
}

/** Saves a packaged food. A barcode already saved is updated in place. Returns its id. */
export function saveCustomFood(input: CustomFoodInput): string {
  const now = nowIso();
  const values = {
    name: input.name.trim().slice(0, 120),
    brand: input.brand?.trim() || null,
    kcal100: input.per100.kcal,
    protein100: input.per100.protein,
    carbs100: input.per100.carbs,
    fat100: input.per100.fat,
    fiber100: input.per100.fiber,
    servingG: input.servingG,
    source: input.source,
    updatedAt: now,
    deletedAt: null,
  };
  const existing = input.barcode ? getDb().select().from(customFoods).where(eq(customFoods.barcode, input.barcode)).get() : null;
  if (existing) {
    getDb().update(customFoods).set(values).where(eq(customFoods.id, existing.id)).run();
    return existing.id;
  }
  const id = randomUUID();
  getDb()
    .insert(customFoods)
    .values({ id, barcode: input.barcode, createdAt: now, ...values })
    .run();
  return id;
}

export function deleteCustomFood(id: string): void {
  const now = nowIso();
  getDb().update(customFoods).set({ deletedAt: now, updatedAt: now }).where(eq(customFoods.id, id)).run();
}

function entryValues(food: CustomFoodRow, grams: number) {
  if (!(grams > 0 && grams <= 5000)) throw new RangeError('Quantity must be between 1 g and 5 kg');
  const n = per100For(per100Of(food), grams);
  return {
    name: food.brand ? `${food.name} (${food.brand})` : food.name,
    quantityG: grams,
    measureKey: 'g',
    measureCount: grams,
    kcal: n.kcal,
    proteinG: n.protein,
    carbsG: n.carbs,
    fatG: n.fat,
    fiberG: n.fiber,
  };
}

export function addCustomEntry(input: { date: string; meal: Meal; customFoodId: string; grams: number }): string {
  const food = getCustomFood(input.customFoodId);
  if (!food) throw new Error('Unknown packaged food');
  const now = nowIso();
  const id = randomUUID();
  getDb()
    .insert(foodLogEntries)
    .values({ id, loggedOn: input.date, meal: input.meal, customFoodId: food.id, oilLevel: 'normal', source: 'barcode', createdAt: now, updatedAt: now, ...entryValues(food, input.grams) })
    .run();
  return id;
}

export function updateCustomEntry(entryId: string, grams: number, meal: Meal): void {
  const entry = getDb().select().from(foodLogEntries).where(eq(foodLogEntries.id, entryId)).get();
  const food = entry?.customFoodId ? getCustomFood(entry.customFoodId) : null;
  if (!entry || !food) throw new Error('Entry not found');
  getDb()
    .update(foodLogEntries)
    .set({ ...entryValues(food, grams), meal, updatedAt: nowIso() })
    .where(eq(foodLogEntries.id, entryId))
    .run();
}

export interface PhotoEntryItem {
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

/** Saves the items a food photo was estimated to contain, one diary entry each. */
export function addPhotoEntries(date: string, meal: Meal, items: PhotoEntryItem[]): number {
  const now = nowIso();
  const db = getDb();
  db.transaction((tx) => {
    for (const it of items) {
      tx.insert(foodLogEntries)
        .values({
          id: randomUUID(),
          loggedOn: date,
          meal,
          name: it.name.trim().slice(0, 120) || 'Food',
          quantityG: Math.min(5000, Math.max(1, Math.round(it.grams))),
          measureKey: 'g',
          measureCount: Math.min(5000, Math.max(1, Math.round(it.grams))),
          oilLevel: 'normal',
          kcal: Math.max(0, Math.round(it.kcal)),
          proteinG: Math.max(0, it.protein),
          carbsG: Math.max(0, it.carbs),
          fatG: Math.max(0, it.fat),
          fiberG: Math.max(0, it.fiber),
          source: 'photo',
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
  });
  return items.length;
}
