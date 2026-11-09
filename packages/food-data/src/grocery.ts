import { getFood, requireFood } from './foods';
import type { DayPlan } from './planner';
import type { Food } from './types';

export type GroceryGroup = 'grains' | 'pulses' | 'vegetables' | 'fruits' | 'dairy' | 'protein' | 'pantry' | 'ready';

export interface GroceryItem {
  foodId: string;
  name: string;
  nameTe?: string;
  group: GroceryGroup;
  grams: number;
  /** Friendly amount: "1.2 kg", "750 g", "1.5 L", "12 eggs". */
  amount: { value: number; unit: 'g' | 'kg' | 'ml' | 'L' | 'pcs' };
}

const GROUP_BY_ID: Record<string, GroceryGroup> = {
  rice_raw: 'grains', brown_rice_raw: 'grains', atta: 'grains', rava: 'grains', oats: 'grains', poha_raw: 'grains', ragi_flour: 'grains',
  toor_dal_raw: 'pulses', moong_dal_raw: 'pulses', moong_whole_raw: 'pulses', urad_dal_raw: 'pulses', chana_dal_raw: 'pulses',
  chickpeas_raw: 'pulses', rajma_raw: 'pulses', peanuts_raw: 'pulses',
  chicken_raw: 'protein', mutton_raw: 'protein', fish_raw: 'protein', prawns_raw: 'protein', egg_raw: 'protein', tofu: 'protein',
  oil: 'pantry', ghee: 'pantry', butter: 'dairy', sugar: 'pantry', jaggery: 'pantry', coconut_fresh: 'vegetables',
};

function groupOf(f: Food): GroceryGroup {
  if (GROUP_BY_ID[f.id]) return GROUP_BY_ID[f.id]!;
  if (f.category === 'fruits') return 'fruits';
  if (f.category === 'dairy' || f.allergens?.includes('milk')) return 'dairy';
  if (f.category === 'raw') return 'vegetables';
  return 'ready';
}

const LIQUIDS = new Set(['milk_toned', 'milk_full', 'oil']);

function amountFor(f: Food, grams: number): GroceryItem['amount'] {
  if (f.id === 'egg_raw') return { value: Math.ceil(grams / 50), unit: 'pcs' };
  const liquid = LIQUIDS.has(f.id);
  // Round up to a sensible shopping amount.
  const step = grams >= 1000 ? 100 : 50;
  const g = Math.max(step, Math.ceil(grams / step) * step);
  if (g >= 1000) return { value: Math.round(g / 100) / 10, unit: liquid ? 'L' : 'kg' };
  return { value: g, unit: liquid ? 'ml' : 'g' };
}

/**
 * Turns planned dishes into a shopping list of raw ingredients
 * (e.g. 200 g cooked rice → 66 g raw rice). Approximate by design.
 */
export function groceryList(plans: DayPlan[]): GroceryItem[] {
  const totals = new Map<string, number>();
  const add = (id: string, g: number) => totals.set(id, (totals.get(id) ?? 0) + g);

  for (const plan of plans) {
    for (const meal of plan.meals) {
      for (const item of meal.items) {
        const f = requireFood(item.foodId);
        if (f.raw && f.raw.length) {
          for (const r of f.raw) {
            const rf = getFood(r.id);
            // Ingredients that are themselves dishes (curd in curd rice) are bought as-is.
            if (rf) add(rf.id, (item.grams * r.g) / 100);
          }
        } else {
          add(f.id, item.grams);
        }
      }
    }
  }

  const order: GroceryGroup[] = ['grains', 'pulses', 'vegetables', 'fruits', 'dairy', 'protein', 'pantry', 'ready'];
  return [...totals.entries()]
    .filter(([, g]) => g >= 1)
    .map(([id, grams]) => {
      const f = requireFood(id);
      return { foodId: id, name: f.name, nameTe: f.nameTe, group: groupOf(f), grams: Math.round(grams), amount: amountFor(f, grams) };
    })
    .sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || a.name.localeCompare(b.name));
}
