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
