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
  // v6 — Phase 4: finished workouts
  `
  CREATE TABLE workout_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    workout_id TEXT NOT NULL,
    done_on TEXT NOT NULL,
    started_at TEXT NOT NULL,
    duration_s INTEGER NOT NULL CHECK (duration_s >= 0),
    completed_sets INTEGER NOT NULL CHECK (completed_sets >= 0),
    total_sets INTEGER NOT NULL CHECK (total_sets >= 0),
    est_kcal INTEGER NOT NULL CHECK (est_kcal >= 0),
    exercises TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE INDEX workout_sessions_done_on_idx ON workout_sessions (done_on);
  `,
  // v7 — Phase 3: AI coach chat and memory
  `
  CREATE TABLE coach_messages (
    id TEXT PRIMARY KEY NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user','coach')),
    text TEXT NOT NULL,
    flags TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE INDEX coach_messages_created_idx ON coach_messages (created_at);
  CREATE TABLE coach_memory (
    id TEXT PRIMARY KEY NOT NULL,
    text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 200),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  `,
  // v8 — Phase 6: daily steps (from Health Connect or typed in)
  `
  CREATE TABLE step_days (
    day TEXT PRIMARY KEY NOT NULL,
    steps INTEGER NOT NULL CHECK (steps BETWEEN 0 AND 200000),
    source TEXT NOT NULL CHECK (source IN ('health_connect','manual')),
    flags TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  `,
  // v9 — Phase 7: packaged foods (barcode) and food-photo entries.
  // SQLite can't change a CHECK constraint, so food_log_entries is rebuilt with its data copied over.
  `
  CREATE TABLE custom_foods (
    id TEXT PRIMARY KEY NOT NULL,
    barcode TEXT UNIQUE,
    name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
    brand TEXT,
    kcal_100g REAL NOT NULL CHECK (kcal_100g BETWEEN 0 AND 900),
    protein_100g REAL NOT NULL CHECK (protein_100g BETWEEN 0 AND 100),
    carbs_100g REAL NOT NULL CHECK (carbs_100g BETWEEN 0 AND 100),
    fat_100g REAL NOT NULL CHECK (fat_100g BETWEEN 0 AND 100),
    fiber_100g REAL NOT NULL DEFAULT 0 CHECK (fiber_100g BETWEEN 0 AND 100),
    serving_g REAL CHECK (serving_g IS NULL OR serving_g BETWEEN 1 AND 2000),
    source TEXT NOT NULL CHECK (source IN ('barcode','label')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE TABLE food_log_entries_v9 (
    id TEXT PRIMARY KEY NOT NULL,
    logged_on TEXT NOT NULL,
    meal TEXT NOT NULL CHECK (meal IN ('breakfast','lunch','snack','dinner')),
    food_id TEXT,
    recipe_id TEXT,
    custom_food_id TEXT,
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
    source TEXT NOT NULL CHECK (source IN ('manual','plan','repeat','recipe','barcode','photo')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    CHECK (food_id IS NOT NULL OR recipe_id IS NOT NULL OR custom_food_id IS NOT NULL OR source = 'photo')
  );
  INSERT INTO food_log_entries_v9 (id, logged_on, meal, food_id, recipe_id, custom_food_id, name, quantity_g, measure_key, measure_count,
    oil_level, kcal, protein_g, carbs_g, fat_g, fiber_g, source, created_at, updated_at, deleted_at)
  SELECT id, logged_on, meal, food_id, recipe_id, NULL, name, quantity_g, measure_key, measure_count,
    oil_level, kcal, protein_g, carbs_g, fat_g, fiber_g, source, created_at, updated_at, deleted_at FROM food_log_entries;
  DROP TABLE food_log_entries;
  ALTER TABLE food_log_entries_v9 RENAME TO food_log_entries;
  CREATE INDEX food_log_entries_logged_on_idx ON food_log_entries (logged_on);
  `,
  // v10 — central agent: actions the coach proposes (JSON list, user confirms each)
  `
  ALTER TABLE coach_messages ADD COLUMN actions TEXT NOT NULL DEFAULT '[]';
  `,
  // v11 — Face & Skin Wellness: daily puffiness check-ins, private face photos, skin profile, skincare routine
  `
  CREATE TABLE face_checkins (
    day TEXT PRIMARY KEY NOT NULL,
    puffiness INTEGER NOT NULL CHECK (puffiness BETWEEN 0 AND 3),
    areas TEXT NOT NULL DEFAULT '[]',
    time_of_day TEXT CHECK (time_of_day IS NULL OR time_of_day IN ('morning','afternoon','evening','all_day')),
    symptoms TEXT NOT NULL DEFAULT '[]',
    stress INTEGER CHECK (stress IS NULL OR stress BETWEEN 0 AND 2),
    salty_yesterday INTEGER CHECK (salty_yesterday IS NULL OR salty_yesterday IN (0,1)),
    alcohol_yesterday INTEGER CHECK (alcohol_yesterday IS NULL OR alcohol_yesterday IN (0,1)),
    note TEXT CHECK (note IS NULL OR length(note) <= 300),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE face_photos (
    id TEXT PRIMARY KEY NOT NULL,
    taken_on TEXT NOT NULL,
    taken_at TEXT NOT NULL,
    file_name TEXT NOT NULL,
    note TEXT CHECK (note IS NULL OR length(note) <= 300),
    ai_quality TEXT,
    ai_observation TEXT,
    ai_compared_with TEXT,
    user_verdict TEXT CHECK (user_verdict IS NULL OR user_verdict IN ('agree','disagree')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE INDEX face_photos_taken_on_idx ON face_photos (taken_on);
  CREATE TABLE skin_profile (
    id TEXT PRIMARY KEY NOT NULL CHECK (id = 'me'),
    skin_type TEXT NOT NULL CHECK (skin_type IN ('oily','dry','combination','sensitive','normal','unsure')),
    sensitive INTEGER NOT NULL DEFAULT 0,
    concerns TEXT NOT NULL DEFAULT '[]',
    allergies TEXT,
    products TEXT,
    budget TEXT NOT NULL DEFAULT 'medium' CHECK (budget IN ('low','medium','high')),
    fragrance_free INTEGER NOT NULL DEFAULT 1,
    experience TEXT NOT NULL DEFAULT 'beginner' CHECK (experience IN ('beginner','some','experienced')),
    pregnant INTEGER NOT NULL DEFAULT 0,
    goals TEXT,
    share_with_coach INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE skincare_steps (
    id TEXT PRIMARY KEY NOT NULL,
    slot TEXT NOT NULL CHECK (slot IN ('am','pm')),
    position INTEGER NOT NULL,
    step TEXT NOT NULL,
    product TEXT,
    ingredient TEXT,
    frequency TEXT NOT NULL DEFAULT 'daily',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE skincare_done (
    day TEXT NOT NULL,
    slot TEXT NOT NULL CHECK (slot IN ('am','pm')),
    created_at TEXT NOT NULL,
    PRIMARY KEY (day, slot)
  );
  `,
  // v12 — FitMate's own step counter: step days can now come from this phone's sensor.
  // SQLite can't change a CHECK constraint, so step_days is rebuilt with its data copied over.
  `
  CREATE TABLE step_days_new (
    day TEXT PRIMARY KEY NOT NULL,
    steps INTEGER NOT NULL CHECK (steps BETWEEN 0 AND 200000),
    source TEXT NOT NULL CHECK (source IN ('health_connect','manual','phone')),
    flags TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  INSERT INTO step_days_new (day, steps, source, flags, created_at, updated_at)
    SELECT day, steps, source, flags, created_at, updated_at FROM step_days;
  DROP TABLE step_days;
  ALTER TABLE step_days_new RENAME TO step_days;
  `,
  // v13 — Hourly step log from FitMate's own counter (hour = 'YYYY-MM-DDTHH', local time).
  `
  CREATE TABLE step_hours (
    hour TEXT PRIMARY KEY NOT NULL CHECK (length(hour) = 13),
    day TEXT NOT NULL,
    steps INTEGER NOT NULL CHECK (steps BETWEEN 0 AND 50000),
    updated_at TEXT NOT NULL
  );
  CREATE INDEX step_hours_day_idx ON step_hours(day);
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
