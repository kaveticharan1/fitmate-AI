import { describe, expect, it } from 'vitest';
import { kitchenIngredients, kitchenQuestion, suggestDishes } from './kitchen';

const veg = { dietType: 'vegetarian' as const, allergies: [], dislikes: [] };
const nonveg = { dietType: 'non_vegetarian' as const, allergies: [], dislikes: [] };
const ids = (ms: { food: { id: string } }[]) => ms.map((m) => m.food.id);

describe('kitchen assistant', () => {
  it('lists ingredients without the staples', () => {
    const list = kitchenIngredients().map((f) => f.id);
    expect(list).toContain('toor_dal_raw');
    expect(list).toContain('egg_raw');
    expect(list).not.toContain('oil');
    expect(new Set(list).size).toBe(list.length);
  });

  it('finds what you can make now and with one more thing', () => {
    const r = suggestDishes(['egg_raw', 'onion'], nonveg);
    expect(ids(r.canMake)).toEqual(expect.arrayContaining(['boiled_egg', 'omelette', 'egg_bhurji']));
    expect(ids(r.missingOne)).toContain('egg_curry');
    expect(r.missingOne.find((m) => m.food.id === 'egg_curry')!.missing).toEqual(['tomato']);
    // Ranked by protein for the calories.
    const p = r.canMake.map((m) => m.proteinPer100Kcal);
    expect([...p].sort((a, b) => b - a)).toEqual(p);
  });

  it('treats any vegetable as mixed vegetables', () => {
    const r = suggestDishes(['toor_dal_raw', 'tomato', 'carrot'], veg);
    expect(ids(r.canMake)).toEqual(expect.arrayContaining(['sambar', 'pappu', 'tomato_pappu', 'rasam']));
  });

  it('respects diet, allergies and dislikes', () => {
    expect(ids(suggestDishes(['egg_raw', 'chicken_raw', 'onion'], veg).canMake)).toEqual([]);
    const peanut = suggestDishes(['peanuts_raw', 'poha_raw', 'onion'], { ...veg, allergies: ['peanut'] });
    expect(ids(peanut.canMake)).not.toContain('poha');
    const noBhindi = suggestDishes(['okra'], { ...veg, dislikes: ['bhindi'] });
    expect(ids(noBhindi.canMake)).not.toContain('bhindi_fry');
  });

  it('needs at least one real ingredient', () => {
    expect(suggestDishes([], veg)).toEqual({ canMake: [], missingOne: [] });
  });

  it('writes a coach question in English or Telugu', () => {
    expect(kitchenQuestion(['egg_raw', 'spinach'], 'en')).toMatch(/^I have: Egg.*Spinach.*\. Suggest one easy, high-protein dish/);
    expect(kitchenQuestion(['egg_raw'], 'te')).toMatch(/^నా దగ్గర ఇవి ఉన్నాయి/);
  });
});
