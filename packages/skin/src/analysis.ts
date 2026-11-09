import { INGREDIENTS, IRRITANTS, type Ingredient, type SkinType } from './knowledge';

/**
 * Reads an ingredient list (as printed on the pack) and explains it against
 * the user's skin profile and current routine. Only the list the user gives is
 * used — a product name alone is never assumed to have a particular formula.
 */
export interface ProfileForAnalysis {
  skinType: SkinType;
  sensitive: boolean;
  fragranceFree: boolean;
  pregnant: boolean;
  /** Free text the user typed, e.g. "fragrance, coconut oil". */
  allergies: string | null;
  /** Ingredient ids already in the user's routine. */
  routineIngredients: string[];
}

export interface ListAnalysis {
  /** Ingredients as read from the list, cleaned. */
  items: string[];
  actives: Ingredient[];
  irritants: { id: string; label: string; found: string }[];
  /** Words from the user's allergy list that appear in the ingredients. */
  allergyMatches: string[];
  /** Active pairs (in this product, or with the routine) that shouldn't be layered at the same time. */
  conflicts: { a: string; b: string; withRoutine: boolean }[];
  pregnancyWarnings: Ingredient[];
  /** Notes for this skin type (e.g. strong acid on sensitive skin). */
  cautions: Ingredient[];
}

/** Splits an INCI list: commas/semicolons/bullets, strips percentages, "May contain" tails and brackets' outer spaces. */
export function splitIngredients(text: string): string[] {
  const body = text
    .replace(/\r/g, '')
    .replace(/^[\s\S]*?ingredients?\s*[:：]/i, '')
    .replace(/(may contain|\+\/-)[\s\S]*$/i, '');
  return body
    .split(/[,;•·\n]+/)
    .map((s) =>
      s
        .toLowerCase()
        .replace(/\d+(\.\d+)?\s*%/g, '')
        .replace(/\s+/g, ' ')
        .replace(/^[\s.*-]+|[\s.*]+$/g, '')
        .trim(),
    )
    .filter((s) => s.length > 1 && s.length < 120);
}

const matches = (item: string, alias: string) => item === alias || item.includes(alias);

export function analyseIngredients(text: string, profile: ProfileForAnalysis): ListAnalysis {
  const items = splitIngredients(text);
  const actives: Ingredient[] = [];
  for (const ing of INGREDIENTS) {
    if (ing.kind === 'cleanser') continue;
    if (items.some((it) => ing.aliases.some((a) => matches(it, a)))) actives.push(ing);
  }
  // "alcohol" alone matches fatty alcohols like cetyl alcohol, which are fine — skip those.
  const FATTY = /(cetyl|cetearyl|stearyl|behenyl|benzyl|phenethyl|lanolin) alcohol/;
  const irritants: ListAnalysis['irritants'] = [];
  for (const irr of IRRITANTS) {
    const found = items.find((it) => irr.aliases.some((a) => (a === 'alcohol' ? it === 'alcohol' : matches(it, a))) && !FATTY.test(it));
    if (found) irritants.push({ id: irr.id, label: irr.label, found });
  }
  const allergyWords = (profile.allergies ?? '')
    .toLowerCase()
    .split(/[,;\n]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3);
  // An allergy word also covers the other names of the same thing ("fragrance" → parfum, aroma).
  const groups = [...IRRITANTS.map((i) => [i.id.replace(/_/g, ' '), i.label.toLowerCase(), ...i.aliases]), ...INGREDIENTS.map((i) => [i.id.replace(/_/g, ' '), i.name.toLowerCase(), ...i.aliases])];
  const namesFor = (w: string) => [w, ...groups.filter((g) => g.includes(w)).flat()].filter((x) => x.length >= 3);
  const allergyMatches = allergyWords.filter((w) => items.some((it) => namesFor(w).some((n) => it.includes(n))));

  const conflicts: ListAnalysis['conflicts'] = [];
  const ids = actives.map((a) => a.id);
  for (const a of actives) {
    for (const other of a.avoidWith) {
      if (ids.includes(other) && a.id < other) conflicts.push({ a: a.id, b: other, withRoutine: false });
      if (profile.routineIngredients.includes(other) && !ids.includes(other)) conflicts.push({ a: a.id, b: other, withRoutine: true });
    }
  }
  const sensitiveSkin = profile.sensitive || profile.skinType === 'sensitive';
  return {
    items,
    actives,
    irritants: sensitiveSkin || profile.fragranceFree ? irritants : irritants.filter((i) => i.id !== 'fragrance_allergens'),
    allergyMatches,
    conflicts,
    pregnancyWarnings: profile.pregnant ? actives.filter((a) => a.pregnancy !== 'ok') : [],
    cautions: actives.filter((a) => a.caution.includes(profile.skinType) || (sensitiveSkin && a.irritation === 'high')),
  };
}

/** Side-by-side summary of two ingredient lists. */
export function compareLists(a: string, b: string, profile: ProfileForAnalysis) {
  const A = analyseIngredients(a, profile);
  const B = analyseIngredients(b, profile);
  const idsA = new Set(A.actives.map((x) => x.id));
  const idsB = new Set(B.actives.map((x) => x.id));
  return {
    a: A,
    b: B,
    shared: [...idsA].filter((x) => idsB.has(x)),
    onlyA: [...idsA].filter((x) => !idsB.has(x)),
    onlyB: [...idsB].filter((x) => !idsA.has(x)),
    /** Fewer flagged items = probably gentler for this profile (a rough guide only). */
    gentler: A.irritants.length + A.allergyMatches.length * 3 + A.cautions.length < B.irritants.length + B.allergyMatches.length * 3 + B.cautions.length ? 'a' : A.irritants.length + A.allergyMatches.length * 3 + A.cautions.length > B.irritants.length + B.allergyMatches.length * 3 + B.cautions.length ? 'b' : 'same',
  };
}
