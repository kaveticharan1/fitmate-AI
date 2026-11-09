import { integer, real, sqliteTable, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

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

export type ProfileRow = typeof profile.$inferSelect;
export type WeightLogRow = typeof weightLogs.$inferSelect;
export type BodyMeasurementRow = typeof bodyMeasurements.$inferSelect;

/** Tables included in backups, in restore order. */
export const BACKUP_TABLES = ['profile', 'consents', 'weight_logs', 'body_measurements', 'app_settings'] as const;
