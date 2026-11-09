import { describe, expect, it } from 'vitest';
import { analyseIngredients, buildRoutine, compareLists, getIngredient, INGREDIENTS, KNOWLEDGE_REVIEWED, splitIngredients, type ProfileForAnalysis, type RoutineProfile } from './index';

const profile: ProfileForAnalysis = { skinType: 'oily', sensitive: false, fragranceFree: true, pregnant: false, allergies: null, routineIngredients: [] };
const base: RoutineProfile = { skinType: 'normal', sensitive: false, concerns: [], pregnant: false, experience: 'beginner', budget: 'medium' };
const ids = (steps: { ingredient?: string }[]) => steps.map((s) => s.ingredient);
const actives = (r: ReturnType<typeof buildRoutine>) => [...r.am, ...r.pm].map((s) => s.ingredient).filter((i) => i && getIngredient(i)!.kind === 'active');

describe('knowledge base', () => {
  it('has complete, sourced entries and consistent links', () => {
    expect(KNOWLEDGE_REVIEWED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const i of INGREDIENTS) {
      expect(i.sources.length, i.id).toBeGreaterThan(0);
      for (const s of i.sources) expect(s.url).toMatch(/^https:\/\/(www\.)?(aad\.org|nhs\.uk)/);
      for (const other of i.avoidWith) expect(getIngredient(other), `${i.id} → ${other}`).toBeDefined();
      expect(i.what.length).toBeGreaterThan(20);
    }
    expect(getIngredient('retinoid')!.pregnancy).toBe('avoid');
  });
});

describe('ingredient lists', () => {
  it('splits a real-looking label', () => {
    expect(splitIngredients('Ingredients: Aqua, Niacinamide 5%, Glycerin; Zinc PCA • Parfum. May contain: CI 77891')).toEqual(['aqua', 'niacinamide', 'glycerin', 'zinc pca', 'parfum']);
  });

  it('finds actives, irritants, allergies and conflicts with the routine', () => {
    const r = analyseIngredients('Water, Glycolic Acid, Salicylic Acid, Alcohol Denat., Cetyl Alcohol, Parfum, Coconut Oil', {
      ...profile,
      allergies: 'coconut, lanolin',
      routineIngredients: ['retinoid'],
    });
    expect(r.actives.map((a) => a.id)).toEqual(['salicylic_acid', 'glycolic_acid']);
    expect(r.irritants.map((i) => i.id)).toEqual(['fragrance', 'drying_alcohol']);
    expect(r.allergyMatches).toEqual(['coconut']);
    expect(r.conflicts).toEqual(
      expect.arrayContaining([
        { a: 'glycolic_acid', b: 'salicylic_acid', withRoutine: false },
        { a: 'salicylic_acid', b: 'retinoid', withRoutine: true },
        { a: 'glycolic_acid', b: 'retinoid', withRoutine: true },
      ]),
    );
  });

  it('does not flag fatty alcohols as drying alcohol', () => {
    expect(analyseIngredients('Water, Cetearyl Alcohol, Stearyl Alcohol', profile).irritants).toEqual([]);
  });

  it('warns about pregnancy and skin-type cautions', () => {
    const r = analyseIngredients('Aqua, Retinol, Ascorbic Acid', { ...profile, pregnant: true, skinType: 'sensitive' });
    expect(r.pregnancyWarnings.map((a) => a.id)).toEqual(['vitamin_c', 'retinoid'].filter((id) => getIngredient(id)!.pregnancy !== 'ok'));
    expect(r.cautions.map((a) => a.id)).toEqual(expect.arrayContaining(['retinoid', 'vitamin_c']));
  });

  it('compares two products', () => {
    const c = compareLists('Water, Niacinamide, Ceramide NP', 'Water, Niacinamide, Parfum, Glycolic Acid', { ...profile, sensitive: true });
    expect(c.shared).toEqual(['niacinamide']);
    expect(c.onlyA).toEqual(['ceramides']);
    expect(c.onlyB).toEqual(['glycolic_acid']);
    expect(c.gentler).toBe('a');
  });
});

describe('routine builder', () => {
  it('always has cleanser, moisturiser and sunscreen', () => {
    const r = buildRoutine(base);
    expect(r.am.map((s) => s.kind)).toEqual(['cleanser', 'moisturiser', 'sunscreen']);
    expect(r.pm.map((s) => s.kind)).toEqual(['cleanser', 'moisturiser']);
    expect(r.notes[0]).toMatch(/Patch test/);
  });

  it('gives beginners at most one active ingredient', () => {
    const r = buildRoutine({ ...base, skinType: 'oily', concerns: ['acne', 'dullness', 'dark_spots'] });
    expect(actives(r)).toHaveLength(1);
    expect(ids(r.pm)).toContain('salicylic_acid');
  });

  it('never pairs clashing actives, even for experienced users', () => {
    const r = buildRoutine({ ...base, experience: 'experienced', concerns: ['fine_lines', 'dullness'] });
    const all = actives(r) as string[];
    for (const a of all) for (const b of all) if (a !== b) expect(getIngredient(a)!.avoidWith).not.toContain(b);
    expect(ids(r.pm)).toContain('retinoid');
  });

  it('keeps pregnancy and sensitive skin safe', () => {
    const preg = buildRoutine({ ...base, pregnant: true, concerns: ['acne', 'fine_lines'] });
    expect(actives(preg)).not.toContain('retinoid');
    expect(actives(preg)).not.toContain('salicylic_acid');
    expect(preg.notes.some((n) => /Pregnant/.test(n))).toBe(true);
    const sens = buildRoutine({ ...base, sensitive: true, concerns: ['acne', 'redness'] });
    expect(ids(sens.am)).toContain('zinc_oxide');
    expect(ids(sens.pm)).toContain('azelaic_acid');
    expect(sens.seeProfessional).toBe(true);
  });
});

describe('allergy synonyms', () => {
  const base = { skinType: 'normal' as const, sensitive: false, fragranceFree: false, pregnant: false, routineIngredients: [] };
  it('matches other names for the same ingredient', () => {
    expect(analyseIngredients('Aqua, Parfum', { ...base, allergies: 'fragrance' }).allergyMatches).toEqual(['fragrance']);
    expect(analyseIngredients('Aqua, Retinol', { ...base, allergies: 'retinoid' }).allergyMatches).toEqual(['retinoid']);
    expect(analyseIngredients('Aqua, Glycerin', { ...base, allergies: 'fragrance, nickel' }).allergyMatches).toEqual([]);
  });
});
