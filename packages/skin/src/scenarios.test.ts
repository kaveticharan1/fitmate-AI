import { describe, expect, it } from 'vitest';
import { analyseIngredients, buildRoutine, CONCERNS, getIngredient, splitIngredients, type RoutineProfile } from './index';

const p = { skinType: 'normal' as const, sensitive: false, fragranceFree: false, pregnant: false, allergies: null, routineIngredients: [] };
const ids = (r: ReturnType<typeof buildRoutine>) => [...r.am, ...r.pm].map((s) => s.ingredient).filter(Boolean) as string[];

describe('ingredient list edge cases', () => {
  it.each(['', '   ', ',,,;;', 'Ingredients:'])('handles empty input %j', (t) => {
    const a = analyseIngredients(t, p);
    expect(a.items).toEqual([]);
    expect(a.actives).toEqual([]);
  });
  it('handles messy real labels', () => {
    const items = splitIngredients('INGREDIENTS: Aqua (Water), Niacinamide 5%; Glycerin • Zinc PCA. May contain: CI 77891');
    expect(items).toEqual(expect.arrayContaining(['niacinamide', 'glycerin']));
    expect(items.some((i) => i.includes('%'))).toBe(false);
  });
  it('copes with a very long list', () => {
    const t = Array.from({ length: 500 }, (_, i) => `Ingredient ${i}`).join(', ');
    expect(analyseIngredients(t, p).items.length).toBe(500);
  });
});

describe('routine safety across every profile', () => {
  const types = ['oily', 'dry', 'combination', 'sensitive', 'normal', 'unsure'] as const;
  const exps = ['beginner', 'some', 'experienced'] as const;
  for (const skinType of types)
    for (const experience of exps)
      for (const pregnant of [false, true])
        it(`${skinType}/${experience}/${pregnant ? 'pregnant' : 'not pregnant'}`, () => {
          const prof: RoutineProfile = { skinType, sensitive: skinType === 'sensitive', concerns: [...CONCERNS], pregnant, experience, budget: 'low' };
          const r = buildRoutine(prof);
          const used = ids(r);
          expect(r.am.some((s) => s.kind === 'sunscreen')).toBe(true);
          if (pregnant) expect(used.filter((i) => getIngredient(i)?.pregnancy === 'avoid')).toEqual([]);
          if (experience === 'beginner') expect(used.filter((i) => getIngredient(i)?.kind === 'active').length).toBeLessThanOrEqual(1);
          for (const slot of [r.am, r.pm]) {
            const s = slot.map((x) => x.ingredient).filter(Boolean) as string[];
            for (const a of s) for (const b of getIngredient(a)?.avoidWith ?? []) expect(s).not.toContain(b);
          }
        });
});
