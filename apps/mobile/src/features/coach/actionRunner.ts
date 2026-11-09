import type { CoachAction } from '@fitmate/coach';
import { bestMeasure, gramsFor, nutrientsFor, roundNutrients, searchFoods, type Food, type MeasureKey } from '@fitmate/food-data';
import { randomUUID } from 'expo-crypto';
import { addFoodEntry } from '../../db/foodRepo';
import { logSleep } from '../../db/habitsRepo';
import { addWater } from '../../db/progressRepo';
import { getSetting, logWeight, setSetting } from '../../db/repositories';
import { localDate } from '../../lib/time';
import { applyReminders } from '../reminders/notifications';
import { REMINDERS_KEY, withDefaults, type ReminderConfig } from '../reminders/schedule';

/** Words people (and the AI) use for measures. */
const UNIT_SYNONYMS: Record<string, MeasureKey> = {
  piece: 'piece', pieces: 'piece', pc: 'piece', pcs: 'piece', no: 'piece', nos: 'piece',
  katori: 'katori', katoris: 'katori', bowl: 'katori', bowls: 'katori', cup: 'cup', cups: 'cup',
  glass: 'glass', glasses: 'glass', tbsp: 'tbsp', tablespoon: 'tbsp', spoon: 'tbsp', tsp: 'tsp', teaspoon: 'tsp',
  slice: 'slice', slices: 'slice', plate: 'plate', plates: 'plate', ladle: 'ladle', ladles: 'ladle',
  g: 'g', gm: 'g', gms: 'g', gram: 'g', grams: 'g', handful: 'handful',
};

export interface ResolvedFood {
  name: string;
  food: Food | null;
  measureKey?: MeasureKey;
  count?: number;
  kcal?: number;
  protein?: number;
}

/** Finds each spoken/typed item in the food database and works out the amount. Unknown foods stay unresolved. */
export function resolveFoodItems(items: Extract<CoachAction, { type: 'log_food' }>['items']): ResolvedFood[] {
  return items.map((it) => {
    const food = searchFoods(it.name, { limit: 1 })[0] ?? null;
    if (!food) return { name: it.name, food: null };
    let measureKey: MeasureKey;
    let count: number;
    const unit = it.unit ? UNIT_SYNONYMS[it.unit] : undefined;
    if (it.grams != null) {
      const has = food.measures.some((m) => m.key === 'g');
      const best = bestMeasure(food, it.grams);
      measureKey = has ? 'g' : best.key;
      count = has ? it.grams : best.count;
    } else if (unit && food.measures.some((m) => m.key === unit)) {
      measureKey = unit;
      count = it.count ?? 1;
    } else {
      measureKey = food.defaultMeasure;
      count = it.count ?? 1;
    }
    const n = roundNutrients(nutrientsFor(food, gramsFor(food, measureKey, count), 'normal'));
    return { name: it.name, food, measureKey, count, kcal: n.kcal, protein: n.protein };
  });
}

export interface ReminderTexts {
  title: string;
  water: string;
  medicine: (name: string) => string;
  custom: (label: string) => string;
}

/** Performs a confirmed action through the app's own functions. Returns a short result for the UI. */
export async function runAction(action: CoachAction, texts: ReminderTexts, today: string = localDate()): Promise<{ done: number; skipped: string[] }> {
  switch (action.type) {
    case 'log_food': {
      const resolved = resolveFoodItems(action.items);
      let done = 0;
      const skipped: string[] = [];
      for (const r of resolved) {
        if (!r.food || !r.measureKey || r.count == null) {
          skipped.push(r.name);
          continue;
        }
        addFoodEntry({ date: today, meal: action.meal, foodId: r.food.id, measureKey: r.measureKey, count: r.count, oil: 'normal', source: 'manual' });
        done++;
      }
      return { done, skipped };
    }
    case 'log_water':
      addWater(action.ml, today);
      return { done: 1, skipped: [] };
    case 'log_weight':
      logWeight(action.kg, today);
      return { done: 1, skipped: [] };
    case 'log_sleep':
      logSleep(action.bed, action.wake, today);
      return { done: 1, skipped: [] };
    case 'set_reminder': {
      const config: ReminderConfig = withDefaults(getSetting<Partial<ReminderConfig> | null>(REMINDERS_KEY, null));
      const next: ReminderConfig = { ...config, custom: [...(config.custom ?? []), { id: randomUUID(), label: action.label, time: action.time }] };
      await applyReminders(next, texts);
      setSetting(REMINDERS_KEY, next);
      return { done: 1, skipped: [] };
    }
  }
}
