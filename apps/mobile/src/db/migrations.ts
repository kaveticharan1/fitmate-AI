/**
 * Ordered schema migrations. Each entry moves the database from version i to i + 1
 * (tracked with PRAGMA user_version). Never edit a shipped migration — add a new one.
 * Keep these in sync with ./schema.ts; the migration test checks they match.
 */
export const MIGRATIONS: readonly string[] = [
  // v1 — Phase 1: profile, consents, weight and measurements, settings
  `
  CREATE TABLE profile (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    date_of_birth TEXT NOT NULL,
    sex TEXT NOT NULL CHECK (sex IN ('male','female','unspecified')),
    height_cm REAL NOT NULL CHECK (height_cm BETWEEN 100 AND 250),
    weight_kg REAL NOT NULL CHECK (weight_kg BETWEEN 25 AND 350),
    target_weight_kg REAL CHECK (target_weight_kg IS NULL OR target_weight_kg BETWEEN 25 AND 350),
    waist_cm REAL,
    hip_cm REAL,
    goal TEXT NOT NULL,
    activity_level TEXT NOT NULL,
    occupation TEXT,
    sleep_hours REAL,
    workout_preference TEXT NOT NULL,
    equipment TEXT NOT NULL DEFAULT '[]',
    coach_personality TEXT NOT NULL,
    diet_type TEXT NOT NULL,
    allergies TEXT NOT NULL DEFAULT '[]',
    disliked_foods TEXT NOT NULL DEFAULT '[]',
    cooking_time TEXT NOT NULL,
    budget TEXT NOT NULL,
    is_pregnant_or_breastfeeding INTEGER NOT NULL DEFAULT 0,
    has_eating_disorder_history INTEGER NOT NULL DEFAULT 0,
    has_medical_condition INTEGER NOT NULL DEFAULT 0,
    health_notes TEXT,
    injuries TEXT,
    ai_language TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE TABLE consents (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL,
    notice_version TEXT NOT NULL,
    granted_at TEXT NOT NULL,
    withdrawn_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE TABLE weight_logs (
    id TEXT PRIMARY KEY NOT NULL,
    measured_on TEXT NOT NULL,
    weight_kg REAL NOT NULL CHECK (weight_kg BETWEEN 25 AND 350),
    note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE INDEX weight_logs_measured_on_idx ON weight_logs (measured_on);
  CREATE TABLE body_measurements (
    id TEXT PRIMARY KEY NOT NULL,
    measured_on TEXT NOT NULL,
    waist_cm REAL,
    hip_cm REAL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE INDEX body_measurements_measured_on_idx ON body_measurements (measured_on);
  CREATE TABLE app_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX app_settings_key_idx ON app_settings (key);
  `,
  // v2 — Phase 2: food diary, favourites, family recipes, meal-plan choices
  `
  CREATE TABLE food_log_entries (
    id TEXT PRIMARY KEY NOT NULL,
    logged_on TEXT NOT NULL,
    meal TEXT NOT NULL CHECK (meal IN ('breakfast','lunch','snack','dinner')),
    food_id TEXT,
    recipe_id TEXT,
    name TEXT NOT NULL,
    quantity_g REAL NOT NULL CHECK (quantity_g > 0 AND quantity_g <= 5000),
    measure_key TEXT NOT NULL,
    measure_count REAL NOT NULL,
    oil_level TEXT NOT NULL DEFAULT 'normal' CHECK (oil_level IN ('less','normal','more')),
    kcal REAL NOT NULL CHECK (kcal >= 0),
    protein_g REAL NOT NULL,
    carbs_g REAL NOT NULL,
    fat_g REAL NOT NULL,
    fiber_g REAL NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('manual','plan','repeat','recipe')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    CHECK (food_id IS NOT NULL OR recipe_id IS NOT NULL)
  );
  CREATE INDEX food_log_entries_logged_on_idx ON food_log_entries (logged_on);
  CREATE TABLE favourite_foods (
    food_id TEXT PRIMARY KEY NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE recipes (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    servings REAL NOT NULL CHECK (servings > 0),
    total_cooked_g REAL CHECK (total_cooked_g IS NULL OR total_cooked_g > 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE TABLE recipe_ingredients (
    id TEXT PRIMARY KEY NOT NULL,
    recipe_id TEXT NOT NULL REFERENCES recipes (id) ON DELETE CASCADE,
    food_id TEXT NOT NULL,
    grams REAL NOT NULL CHECK (grams > 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE INDEX recipe_ingredients_recipe_idx ON recipe_ingredients (recipe_id);
  CREATE TABLE meal_plan_choices (
    plan_date TEXT NOT NULL,
    meal TEXT NOT NULL CHECK (meal IN ('breakfast','lunch','snack','dinner')),
    swap_index INTEGER NOT NULL DEFAULT 0,
    eaten_at TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (plan_date, meal)
  );
  `,
  // v3 — Phase 5: water intake
  `
  CREATE TABLE water_logs (
    id TEXT PRIMARY KEY NOT NULL,
    logged_on TEXT NOT NULL,
    ml REAL NOT NULL CHECK (ml > 0 AND ml <= 3000),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE INDEX water_logs_logged_on_idx ON water_logs (logged_on);
  `,
  // v4 — Phase 5 part 2: sleep and habits
  `
  CREATE TABLE sleep_logs (
    id TEXT PRIMARY KEY NOT NULL,
    woke_on TEXT NOT NULL,
    bed_time TEXT NOT NULL,
    wake_time TEXT NOT NULL,
    minutes INTEGER NOT NULL CHECK (minutes > 0 AND minutes < 1440),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE UNIQUE INDEX sleep_logs_woke_on_idx ON sleep_logs (woke_on);
  CREATE TABLE habit_definitions (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE TABLE habit_logs (
    id TEXT PRIMARY KEY NOT NULL,
    habit_id TEXT NOT NULL REFERENCES habit_definitions (id) ON DELETE CASCADE,
    done_on TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX habit_logs_habit_day_idx ON habit_logs (habit_id, done_on);
  `,
  // v5 — optional chest and arm measurements
  `
  ALTER TABLE body_measurements ADD COLUMN chest_cm REAL CHECK (chest_cm IS NULL OR chest_cm BETWEEN 40 AND 250);
  ALTER TABLE body_measurements ADD COLUMN arm_cm REAL CHECK (arm_cm IS NULL OR arm_cm BETWEEN 10 AND 80);
  `,
];

export interface MigratableDb {
  getUserVersion(): number;
  setUserVersion(v: number): void;
  exec(sql: string): void;
  transaction(fn: () => void): void;
}

/** Applies every pending migration inside one transaction each. Returns the new version. */
export function runMigrations(db: MigratableDb, migrations: readonly string[] = MIGRATIONS): number {
  let version = db.getUserVersion();
  if (version > migrations.length) {
    throw new Error(
      `Database version ${version} is newer than this app (${migrations.length}). Update the app before opening this data.`,
    );
  }
  while (version < migrations.length) {
    const sql = migrations[version]!;
    const next = version + 1;
    db.transaction(() => {
      db.exec(sql);
      db.setUserVersion(next);
    });
    version = next;
  }
  return version;
}
