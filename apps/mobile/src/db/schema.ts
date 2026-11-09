import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Every synced table carries a UUID primary key and created/updated/deleted
 * timestamps (ISO-8601, UTC) so cloud sync can be added later without changes.
 * Booleans are stored as 0/1 integers; lists as JSON text.
 */
const syncColumns = {
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
};

export const profile = sqliteTable('profile', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  dateOfBirth: text('date_of_birth').notNull(),
  sex: text('sex', { enum: ['male', 'female', 'unspecified'] }).notNull(),
  heightCm: real('height_cm').notNull(),
  weightKg: real('weight_kg').notNull(),
  targetWeightKg: real('target_weight_kg'),
  waistCm: real('waist_cm'),
  hipCm: real('hip_cm'),
  goal: text('goal').notNull(),
  activityLevel: text('activity_level').notNull(),
  occupation: text('occupation'),
  sleepHours: real('sleep_hours'),
  workoutPreference: text('workout_preference').notNull(),
  equipment: text('equipment', { mode: 'json' }).$type<string[]>().notNull(),
  coachPersonality: text('coach_personality').notNull(),
  dietType: text('diet_type').notNull(),
  allergies: text('allergies', { mode: 'json' }).$type<string[]>().notNull(),
  dislikedFoods: text('disliked_foods', { mode: 'json' }).$type<string[]>().notNull(),
  cookingTime: text('cooking_time').notNull(),
  budget: text('budget').notNull(),
  isPregnantOrBreastfeeding: integer('is_pregnant_or_breastfeeding', { mode: 'boolean' }).notNull(),
  hasEatingDisorderHistory: integer('has_eating_disorder_history', { mode: 'boolean' }).notNull(),
  hasMedicalCondition: integer('has_medical_condition', { mode: 'boolean' }).notNull(),
  healthNotes: text('health_notes'),
  injuries: text('injuries'),
  aiLanguage: text('ai_language').notNull(),
  ...syncColumns,
});

export const consents = sqliteTable('consents', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  noticeVersion: text('notice_version').notNull(),
  grantedAt: text('granted_at').notNull(),
  withdrawnAt: text('withdrawn_at'),
  ...syncColumns,
});

export const weightLogs = sqliteTable(
  'weight_logs',
  {
    id: text('id').primaryKey(),
    measuredOn: text('measured_on').notNull(),
    weightKg: real('weight_kg').notNull(),
    note: text('note'),
    ...syncColumns,
  },
  (t) => [index('weight_logs_measured_on_idx').on(t.measuredOn)],
);

export const bodyMeasurements = sqliteTable(
  'body_measurements',
  {
    id: text('id').primaryKey(),
    measuredOn: text('measured_on').notNull(),
    waistCm: real('waist_cm'),
    hipCm: real('hip_cm'),
    ...syncColumns,
  },
  (t) => [index('body_measurements_measured_on_idx').on(t.measuredOn)],
);

export const appSettings = sqliteTable(
  'app_settings',
  {
    key: text('key').primaryKey(),
    value: text('value', { mode: 'json' }).notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [uniqueIndex('app_settings_key_idx').on(t.key)],
);

export const MEALS = ['breakfast', 'lunch', 'snack', 'dinner'] as const;
export type Meal = (typeof MEALS)[number];

/** One food (or recipe share) eaten. Nutrition is stored as eaten, so later database updates never rewrite history. */
export const foodLogEntries = sqliteTable(
  'food_log_entries',
  {
    id: text('id').primaryKey(),
    loggedOn: text('logged_on').notNull(),
    meal: text('meal', { enum: MEALS }).notNull(),
    foodId: text('food_id'),
    recipeId: text('recipe_id'),
    name: text('name').notNull(),
    quantityG: real('quantity_g').notNull(),
    measureKey: text('measure_key').notNull(),
    measureCount: real('measure_count').notNull(),
    oilLevel: text('oil_level', { enum: ['less', 'normal', 'more'] }).notNull(),
    kcal: real('kcal').notNull(),
    proteinG: real('protein_g').notNull(),
    carbsG: real('carbs_g').notNull(),
    fatG: real('fat_g').notNull(),
    fiberG: real('fiber_g').notNull(),
    source: text('source', { enum: ['manual', 'plan', 'repeat', 'recipe'] }).notNull(),
    ...syncColumns,
  },
  (t) => [index('food_log_entries_logged_on_idx').on(t.loggedOn)],
);

export const favouriteFoods = sqliteTable('favourite_foods', {
  foodId: text('food_id').primaryKey(),
  createdAt: text('created_at').notNull(),
});

export const recipes = sqliteTable('recipes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  servings: real('servings').notNull(),
  totalCookedG: real('total_cooked_g'),
  ...syncColumns,
});

export const recipeIngredients = sqliteTable(
  'recipe_ingredients',
  {
    id: text('id').primaryKey(),
    recipeId: text('recipe_id').notNull(),
    foodId: text('food_id').notNull(),
    grams: real('grams').notNull(),
    ...syncColumns,
  },
  (t) => [index('recipe_ingredients_recipe_idx').on(t.recipeId)],
);

/** Swaps and "eaten" marks for the generated meal plan (the plan itself is recalculated). */
export const mealPlanChoices = sqliteTable(
  'meal_plan_choices',
  {
    planDate: text('plan_date').notNull(),
    meal: text('meal', { enum: MEALS }).notNull(),
    swapIndex: integer('swap_index').notNull(),
    eatenAt: text('eaten_at'),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.planDate, t.meal] })],
);

export type FoodLogEntryRow = typeof foodLogEntries.$inferSelect;
export type RecipeRow = typeof recipes.$inferSelect;
export type RecipeIngredientRow = typeof recipeIngredients.$inferSelect;

export type ProfileRow = typeof profile.$inferSelect;
export type WeightLogRow = typeof weightLogs.$inferSelect;
export type BodyMeasurementRow = typeof bodyMeasurements.$inferSelect;

/** Tables included in backups, in restore order. */
export const BACKUP_TABLES = [
  'profile',
  'consents',
  'weight_logs',
  'body_measurements',
  'app_settings',
  'food_log_entries',
  'favourite_foods',
  'recipes',
  'recipe_ingredients',
  'meal_plan_choices',
] as const;
