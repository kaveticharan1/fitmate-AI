import { getIngredient, type Concern, type SkinType } from './knowledge';

/**
 * A simple, safe starter routine from the skin profile. Rules, not AI, so it is
 * predictable: beginners get at most one active ingredient, actives that clash
 * are never put in the same routine, and pregnancy rules out retinoids and acids.
 */
export interface RoutineProfile {
  skinType: SkinType;
  sensitive: boolean;
  concerns: Concern[];
  pregnant: boolean;
  experience: 'beginner' | 'some' | 'experienced';
  budget: 'low' | 'medium' | 'high';
}

export type StepKind = 'cleanser' | 'serum' | 'treatment' | 'moisturiser' | 'sunscreen';

export interface RoutineStep {
  kind: StepKind;
  /** Knowledge-base ingredient id with full details (purpose, use, precautions), if any. */
  ingredient?: string;
  /** Short product description to look for. */
  lookFor: string;
  frequency: string;
}

export interface Routine {
  am: RoutineStep[];
  pm: RoutineStep[];
  /** Introduce actives one at a time, at least 2 weeks apart, after a patch test. */
  introduceOrder: string[];
  notes: string[];
  seeProfessional: boolean;
}

const has = (p: RoutineProfile, ...c: Concern[]) => c.some((x) => p.concerns.includes(x));

/** Picks the single most useful night treatment for the main concern. */
function nightActive(p: RoutineProfile, sensitive: boolean): string | null {
  if (has(p, 'acne')) {
    if (p.pregnant || sensitive) return 'azelaic_acid';
    return p.skinType === 'oily' || p.skinType === 'combination' ? 'salicylic_acid' : 'benzoyl_peroxide';
  }
  if (has(p, 'dark_spots', 'pigmentation')) return 'azelaic_acid';
  if (has(p, 'fine_lines') && !p.pregnant && !sensitive) return 'retinoid';
  if (has(p, 'dullness', 'uneven_tone') && !p.pregnant && !sensitive) return 'lactic_acid';
  if (has(p, 'excess_oil', 'pores') && !sensitive) return p.pregnant ? null : 'salicylic_acid';
  return null;
}

/** Picks an optional morning serum that doesn't clash with the night active. */
function morningSerum(p: RoutineProfile, sensitive: boolean, night: string | null): string | null {
  const candidates: string[] = [];
  if (has(p, 'dullness', 'dark_spots', 'pigmentation', 'uneven_tone', 'fine_lines') && !sensitive) candidates.push('vitamin_c');
  if (has(p, 'excess_oil', 'pores', 'redness', 'uneven_tone', 'acne')) candidates.push('niacinamide');
  if (has(p, 'dryness')) candidates.push('hyaluronic_acid');
  for (const c of candidates) {
    const ing = getIngredient(c)!;
    if (night && ing.avoidWith.includes(night)) continue;
    return c;
  }
  return null;
}

export function buildRoutine(p: RoutineProfile): Routine {
  const sensitive = p.sensitive || p.skinType === 'sensitive';
  const dry = p.skinType === 'dry' || has(p, 'dryness');
  const oily = p.skinType === 'oily';
  const night = nightActive(p, sensitive);
  let serum = morningSerum(p, sensitive, night);
  // Beginners: one active in total. Hydrating/barrier serums don't count as actives.
  const isActive = (id: string | null) => !!id && getIngredient(id)!.kind === 'active';
  if (p.experience === 'beginner' && isActive(serum) && isActive(night)) serum = null;

  const moisturiser: RoutineStep = {
    kind: 'moisturiser',
    ingredient: dry || sensitive ? 'ceramides' : undefined,
    lookFor: oily ? 'Light, oil-free gel moisturiser (“non-comedogenic”)' : dry ? 'Cream with ceramides, fragrance-free' : 'Simple fragrance-free lotion',
    frequency: 'Daily',
  };
  const am: RoutineStep[] = [
    { kind: 'cleanser', ingredient: 'gentle_cleanser', lookFor: dry || sensitive ? 'Rinse with water, or a mild creamy non-soap cleanser' : 'Mild, fragrance-free gel cleanser', frequency: 'Daily' },
    ...(serum ? [{ kind: 'serum' as const, ingredient: serum, lookFor: getIngredient(serum)!.name, frequency: getIngredient(serum)!.start }] : []),
    moisturiser,
    {
      kind: 'sunscreen',
      ingredient: sensitive ? 'zinc_oxide' : 'sunscreen',
      lookFor: sensitive ? 'Mineral (zinc oxide) sunscreen, broad spectrum, SPF 30+' : 'Broad-spectrum sunscreen, SPF 30+, a texture you like using daily',
      frequency: 'Every morning, reapply outdoors about every 2 hours',
    },
  ];
  const pm: RoutineStep[] = [
    { kind: 'cleanser', ingredient: 'gentle_cleanser', lookFor: 'The same mild cleanser (cleanse twice if you wore heavy sunscreen or make-up)', frequency: 'Daily' },
    ...(night ? [{ kind: 'treatment' as const, ingredient: night, lookFor: getIngredient(night)!.name, frequency: getIngredient(night)!.start }] : []),
    { ...moisturiser, ingredient: night && getIngredient(night)!.irritation !== 'low' ? 'ceramides' : moisturiser.ingredient },
  ];

  const introduceOrder = [serum, night].filter((x): x is string => isActive(x));
  const notes = [
    'Patch test every new product: a small amount behind the ear or on the inner arm for 2–3 days before using it on your face.',
    'Add only one new product at a time, at least 2 weeks apart, so you know what suits you.',
    'Give a treatment 6–8 weeks before judging it.',
  ];
  if (p.pregnant) notes.push('Pregnant or breastfeeding: no retinoids; check every active with your doctor or pharmacist.');
  if (p.budget === 'low') notes.push('A basic cleanser, moisturiser and sunscreen do most of the work — actives are optional.');
  // Concerns where a dermatologist's view is worth suggesting alongside home care.
  const seeProfessional = has(p, 'redness') || (has(p, 'acne') && sensitive);
  return { am, pm, introduceOrder, notes, seeProfessional };
}
