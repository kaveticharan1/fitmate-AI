import type { Allergen, Food } from './types';

/** Words people type for each allergen (English, Hindi, Roman-letter Telugu). */
const KEYWORDS: Record<Allergen, string[]> = {
  milk: ['milk', 'dairy', 'lactose', 'paalu', 'palu', 'doodh', 'curd', 'paneer', 'ghee', 'butter', 'cheese'],
  peanut: ['peanut', 'groundnut', 'palli', 'verusanaga', 'moongphali'],
  tree_nut: ['nut', 'nuts', 'almond', 'badam', 'cashew', 'kaju', 'jeedipappu', 'walnut', 'pista', 'coconut'],
  gluten: ['gluten', 'wheat', 'atta', 'maida', 'godhuma', 'rava', 'sooji', 'semolina'],
  egg: ['egg', 'eggs', 'guddu', 'anda'],
  fish: ['fish', 'chepa', 'machli'],
  shellfish: ['shellfish', 'prawn', 'prawns', 'shrimp', 'royyalu', 'crab', 'peetha'],
  soy: ['soy', 'soya', 'tofu'],
  sesame: ['sesame', 'til', 'nuvvulu'],
};

/** Turns free-text allergies ("peanuts, milk") into allergen tags. */
export function allergensFromText(entries: string[]): Set<Allergen> {
  const found = new Set<Allergen>();
  for (const raw of entries) {
    const words = raw.toLowerCase().split(/[^a-zఀ-౿]+/).filter(Boolean);
    for (const [allergen, keys] of Object.entries(KEYWORDS) as [Allergen, string[]][]) {
      if (words.some((w) => keys.some((k) => w === k || w.startsWith(k)))) found.add(allergen);
    }
  }
  return found;
}

/** True when a food matches something the person dislikes (by name, Telugu name or alias). */
export function isDisliked(food: Food, dislikes: string[]): boolean {
  if (dislikes.length === 0) return false;
  const terms = [food.name, food.nameTe ?? '', ...(food.aliases ?? [])].map((t) => t.toLowerCase());
  return dislikes
    .map((d) => d.toLowerCase().trim())
    .filter((d) => d.length >= 3)
    .some((d) => terms.some((t) => t.includes(d)));
}

export function hasAllergen(food: Food, allergens: Set<Allergen>): boolean {
  return (food.allergens ?? []).some((a) => allergens.has(a));
}
