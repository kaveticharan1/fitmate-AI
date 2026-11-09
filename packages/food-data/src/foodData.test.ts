import { describe, expect, it } from 'vitest';
import {
  allergensFromText,
  bestMeasure,
  eligibleTemplates,
  FOODS,
  getFood,
  gramsFor,
  groceryList,
  isDisliked,
  nutrientsFor,
  planDay,
  planWeek,
  recipeNutrition,
  recipePortion,
  requireFood,
  searchFoods,
  SLOTS,
  TEMPLATES,
  type DietType,
  type PlannerInput,
} from './index';

describe('food database integrity', () => {
  it('has unique ids and at least 100 foods', () => {
    const ids = FOODS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(FOODS.length).toBeGreaterThanOrEqual(100);
  });

  it('every food has calories consistent with its macros (4/4/9 rule, ±15% or ±15 kcal)', () => {
    const bad = FOODS.filter((f) => {
      const p = f.per100g;
      const est = p.protein * 4 + p.carbs * 4 + p.fat * 9;
      return Math.abs(est - p.kcal) > Math.max(15, p.kcal * 0.15);
    }).map((f) => `${f.id}: ${f.per100g.kcal} vs ${Math.round(f.per100g.protein * 4 + f.per100g.carbs * 4 + f.per100g.fat * 9)}`);
    expect(bad).toEqual([]);
  });

  it('every food has sane values and measures', () => {
    for (const f of FOODS) {
      const p = f.per100g;
      for (const v of [p.kcal, p.protein, p.carbs, p.fat, p.fiber]) expect(v).toBeGreaterThanOrEqual(0);
      expect(p.protein + p.carbs + p.fat).toBeLessThanOrEqual(101);
      expect(f.measures.length).toBeGreaterThan(0);
      for (const m of f.measures) expect(m.grams).toBeGreaterThan(0);
      if (f.oilPer100g) expect(f.oilPer100g).toBeLessThanOrEqual(f.per100g.fat);
    }
  });

  it('raw-ingredient links and template foods all exist', () => {
    for (const f of FOODS) for (const r of f.raw ?? []) expect(getFood(r.id), `${f.id} → ${r.id}`).toBeDefined();
    for (const t of TEMPLATES) for (const [id] of t.items) expect(getFood(id), `${t.id} → ${id}`).toBeDefined();
  });

  it('a dish with nuts or dairy is tagged with that allergen', () => {
    for (const f of FOODS) {
      for (const r of f.raw ?? []) {
        const raw = requireFood(r.id);
        for (const a of raw.allergens ?? []) {
          // Tiny garnish amounts still count — allergies are about presence.
          expect(f.allergens ?? [], `${f.id} contains ${r.id} (${a})`).toContain(a);
        }
      }
    }
  });
});

describe('search', () => {
  it('finds foods by English, Telugu script and Roman Telugu', () => {
    expect(searchFoods('idli')[0]?.id).toBe('idli');
    expect(searchFoods('పప్పు')[0]?.id).toBe('pappu');
    expect(searchFoods('annam')[0]?.id).toBe('rice_cooked');
    expect(searchFoods('kodi kura')[0]?.id).toBe('chicken_curry');
    expect(searchFoods('majjiga')[0]?.id).toBe('buttermilk');
  });
  it('prefers cooked dishes over raw ingredients', () => {
    const r = searchFoods('rice').map((f) => f.id);
    expect(r.indexOf('rice_cooked')).toBeLessThan(r.indexOf('rice_raw'));
  });
  it('returns nothing for empty input', () => {
    expect(searchFoods('   ')).toEqual([]);
  });
});

describe('portions and oil', () => {
  it('converts household measures', () => {
    expect(gramsFor(requireFood('idli'), 'piece', 3)).toBe(120);
    expect(gramsFor(requireFood('rice_cooked'), 'katori', 1.5)).toBe(225);
  });
  it('scales nutrition by weight', () => {
    const n = nutrientsFor(requireFood('rice_cooked'), 200);
    expect(n.kcal).toBe(260);
    expect(n.protein).toBeCloseTo(5.4);
  });
  it('less/more oil changes only the oil part', () => {
    const curry = requireFood('chicken_curry'); // 6 g oil per 100 g
    const normal = nutrientsFor(curry, 150);
    const less = nutrientsFor(curry, 150, 'less');
    const more = nutrientsFor(curry, 150, 'more');
    expect(normal.kcal - less.kcal).toBeCloseTo(0.5 * 6 * 9 * 1.5); // 40.5 kcal
    expect(more.kcal - normal.kcal).toBeCloseTo(0.6 * 6 * 9 * 1.5);
    expect(less.protein).toBe(normal.protein);
  });
  it('ignores oil level for foods without cooking oil', () => {
    expect(nutrientsFor(requireFood('banana'), 100, 'less')).toEqual(nutrientsFor(requireFood('banana'), 100));
  });
  it('rejects negative quantities', () => {
    expect(() => nutrientsFor(requireFood('banana'), -1)).toThrow(RangeError);
  });
  it('describes amounts in household units', () => {
    expect(bestMeasure(requireFood('idli'), 120)).toEqual({ key: 'piece', count: 3 });
    expect(bestMeasure(requireFood('pappu'), 225)).toEqual({ key: 'katori', count: 1.5 });
    expect(bestMeasure(requireFood('chicken_raw'), 250)).toEqual({ key: 'g', count: 250 });
  });
});

describe('family-pot recipes', () => {
  const pot = {
    ingredients: [
      { foodId: 'toor_dal_raw', grams: 200 },
      { foodId: 'tomato', grams: 200 },
      { foodId: 'oil', grams: 20 },
    ],
    servings: 4,
    totalCookedGrams: 1200,
  };
  it('totals the pot and splits it', () => {
    const n = recipeNutrition(pot);
    expect(Math.round(n.total.kcal)).toBe(686 + 36 + 177); // 899
    expect(n.perServing.kcal).toBeCloseTo(n.total.kcal / 4);
    expect(n.per100g!.kcal).toBeCloseTo(n.total.kcal / 12);
  });
  it('logs a share by servings or by weight', () => {
    expect(recipePortion(pot, { servings: 1.5 }).kcal).toBeCloseTo(recipeNutrition(pot).total.kcal * 0.375);
    expect(recipePortion(pot, { grams: 300 }).kcal).toBeCloseTo(recipeNutrition(pot).total.kcal / 4);
    expect(() => recipePortion({ ...pot, totalCookedGrams: null }, { grams: 100 })).toThrow();
    expect(() => recipeNutrition({ ...pot, servings: 0 })).toThrow(RangeError);
  });
});

describe('allergies and dislikes', () => {
  it('maps everyday words to allergens', () => {
    expect([...allergensFromText(['Peanuts', 'paalu'])].sort()).toEqual(['milk', 'peanut']);
    expect([...allergensFromText(['no prawns please'])]).toEqual(['shellfish']);
    expect(allergensFromText(['bitter gourd']).size).toBe(0);
  });
  it('matches dislikes against names and aliases', () => {
    expect(isDisliked(requireFood('brinjal_curry'), ['vankaya'])).toBe(true);
    expect(isDisliked(requireFood('bhindi_fry'), ['ladies'])).toBe(false); // alias is on the raw okra, not the fry
    expect(isDisliked(requireFood('bhindi_fry'), ['okra'])).toBe(true);
    expect(isDisliked(requireFood('idli'), ['ab'])).toBe(false); // too short to match
  });
});

describe('meal planner', () => {
  const base: PlannerInput = {
    date: '2026-11-10',
    targetKcal: 1800,
    targetProteinG: 120,
    dietType: 'non_vegetarian',
    allergies: [],
    dislikes: [],
  };

  it('plans all four meals close to the calorie target', () => {
    for (const targetKcal of [1400, 1800, 2400]) {
      const p = planDay({ ...base, targetKcal });
      expect(p.meals.map((m) => m.slot)).toEqual(SLOTS);
      // Within 15% (portions are rounded to whole idlis, chapatis, eggs…).
      expect(Math.abs(p.totals.kcal - targetKcal) / targetKcal).toBeLessThan(0.15);
    }
  });

  it('is deterministic for a date and changes with a swap', () => {
    const a = planDay(base);
    expect(planDay(base)).toEqual(a);
    const swapped = planDay({ ...base, swaps: { lunch: 1 } });
    expect(swapped.meals[1]!.templateId).not.toBe(a.meals[1]!.templateId);
    expect(swapped.meals[0]!.templateId).toBe(a.meals[0]!.templateId);
  });

  const dietCases: [DietType, string[]][] = [
    ['vegan', ['vegetarian', 'egg', 'nonveg']],
    ['vegetarian', ['egg', 'nonveg']],
    ['eggetarian', ['nonveg']],
  ];
  it.each(dietCases)('respects a %s diet on every day of a week', (dietType, forbidden) => {
    for (const day of planWeek({ ...base, dietType, startDate: '2026-11-10' })) {
      for (const m of day.meals) for (const i of m.items) expect(forbidden).not.toContain(requireFood(i.foodId).diet);
    }
  });

  it('never suggests allergens or disliked foods', () => {
    const week = planWeek({ ...base, startDate: '2026-11-10', days: 14, allergies: ['peanuts', 'milk'], dislikes: ['brinjal', 'fish'] });
    for (const day of week)
      for (const m of day.meals)
        for (const i of m.items) {
          const f = requireFood(i.foodId);
          expect(f.allergens ?? []).not.toContain('peanut');
          expect(f.allergens ?? []).not.toContain('milk');
          expect(f.name.toLowerCase()).not.toMatch(/brinjal|fish/);
        }
  });

  it('skips premium dishes on a tight budget and prefers quick meals when short on time', () => {
    expect(eligibleTemplates('lunch', { ...base, budget: 'low' }).some((t) => t.premium)).toBe(false);
    expect(eligibleTemplates('breakfast', { ...base, cookingTime: 'under_15' }).every((t) => t.quick)).toBe(true);
  });

  it('tops up protein when the day falls short', () => {
    const p = planDay({ ...base, dietType: 'vegetarian', targetProteinG: 110 });
    const plainVeg = planDay({ ...base, dietType: 'vegetarian', targetProteinG: 10 });
    expect(p.totals.protein).toBeGreaterThan(plainVeg.totals.protein);
  });

  it('uses whole pieces for idli, chapati and eggs', () => {
    for (const day of planWeek({ ...base, startDate: '2026-11-01', days: 14 }))
      for (const m of day.meals)
        for (const i of m.items) {
          const f = requireFood(i.foodId);
          if (f.measures[0]!.key === 'piece') expect(i.grams % f.measures[0]!.grams).toBe(0);
        }
  });

  it('rejects impossible targets', () => {
    expect(() => planDay({ ...base, targetKcal: 300 })).toThrow(RangeError);
  });
});

describe('grocery list', () => {
  it('converts cooked dishes to raw ingredients and groups them', () => {
    const plan = planDay({ date: '2026-11-10', targetKcal: 1800, targetProteinG: 100, dietType: 'non_vegetarian', allergies: [], dislikes: [] });
    const list = groceryList([plan]);
    expect(list.length).toBeGreaterThan(3);
    // No cooked dishes in a shopping list.
    for (const item of list) expect(requireFood(item.foodId).raw, `${item.foodId} should be a buyable item`).toBeUndefined();
    // Groups come in shop order.
    const order = ['grains', 'pulses', 'vegetables', 'fruits', 'dairy', 'protein', 'pantry', 'ready'];
    const idx = list.map((i) => order.indexOf(i.group));
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
  });

  it('adds up a week and uses friendly units', () => {
    const fake = (grams: number) => ({
      date: 'x',
      targetKcal: 0,
      targetProteinG: 0,
      totals: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      meals: [{ slot: 'lunch' as const, templateId: 't', options: 1, totals: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }, items: [
        { foodId: 'rice_cooked', grams, measure: { key: 'g' as const, count: grams }, nutrients: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 } },
        { foodId: 'boiled_egg', grams: 100, measure: { key: 'piece' as const, count: 2 }, nutrients: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 } },
      ] }],
    });
    const list = groceryList(Array.from({ length: 7 }, () => fake(300)));
    const rice = list.find((i) => i.foodId === 'rice_raw')!;
    expect(rice.grams).toBe(693); // 7 × 300 g cooked × 33%
    expect(rice.amount).toEqual({ value: 700, unit: 'g' });
    expect(list.find((i) => i.foodId === 'egg_raw')!.amount).toEqual({ value: 14, unit: 'pcs' });
  });
});
