/** Nutrients per 100 g (or 100 ml for drinks, treated as grams). */
export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

/** Lowest diet that may eat this food. */
export type FoodDiet = 'vegan' | 'vegetarian' | 'egg' | 'nonveg';

export type Allergen = 'milk' | 'peanut' | 'tree_nut' | 'gluten' | 'egg' | 'fish' | 'shellfish' | 'soy' | 'sesame';

export type FoodCategory =
  | 'grains'
  | 'breakfast'
  | 'breads'
  | 'dals'
  | 'vegetables'
  | 'nonveg'
  | 'eggs'
  | 'dairy'
  | 'fruits'
  | 'snacks'
  | 'sweets'
  | 'drinks'
  | 'chutneys'
  | 'raw';

export type MeasureKey =
  | 'g'
  | 'piece'
  | 'katori'
  | 'cup'
  | 'glass'
  | 'tbsp'
  | 'tsp'
  | 'slice'
  | 'handful'
  | 'plate'
  | 'ladle';

export interface Measure {
  key: MeasureKey;
  grams: number;
}

export interface Food {
  id: string;
  name: string;
  nameTe?: string;
  /** Extra search words: Telugu in Roman letters, Hindi names, spellings. */
  aliases?: string[];
  category: FoodCategory;
  diet: FoodDiet;
  allergens?: Allergen[];
  state: 'raw' | 'cooked' | 'ready';
  per100g: Nutrients;
  measures: Measure[];
  /** Measure shown first. */
  defaultMeasure: MeasureKey;
  /** Typical cooking oil (g) already included per 100 g; enables the less/normal/more oil choice. */
  oilPer100g?: number;
  /** Raw ingredients per 100 g of this food, for grocery lists (ids of `raw` foods). */
  raw?: { id: string; g: number }[];
}
