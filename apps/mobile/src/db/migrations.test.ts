/**
 * @jest-environment node
 *
 * Runs the real migration SQL on Node's built-in SQLite and checks it matches
 * the Drizzle schema the app queries with.
 */
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS, runMigrations, type MigratableDb } from './migrations';
import * as schema from './schema';

function adapter(db: DatabaseSync): MigratableDb {
  return {
    getUserVersion: () => (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version,
    setUserVersion: (v) => db.exec(`PRAGMA user_version = ${v}`),
    exec: (sql) => db.exec(sql),
    transaction: (fn) => {
      db.exec('BEGIN');
      try {
        fn();
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

const tables = [
  schema.profile,
  schema.consents,
  schema.weightLogs,
  schema.bodyMeasurements,
  schema.appSettings,
  schema.foodLogEntries,
  schema.favouriteFoods,
  schema.recipes,
  schema.recipeIngredients,
  schema.mealPlanChoices,
  schema.waterLogs,
  schema.sleepLogs,
  schema.habitDefinitions,
  schema.habitLogs,
  schema.workoutSessions,
  schema.coachMessages,
  schema.coachMemory,
  schema.stepDays,
  schema.customFoods,
  schema.faceCheckins,
  schema.facePhotos,
  schema.skinProfile,
  schema.skincareSteps,
  schema.skincareDone,
];

describe('migrations', () => {
  it('migrate an empty database to the latest version', () => {
    const db = new DatabaseSync(':memory:');
    expect(runMigrations(adapter(db))).toBe(MIGRATIONS.length);
    // Running again is a no-op.
    expect(runMigrations(adapter(db))).toBe(MIGRATIONS.length);
  });

  it('create exactly the columns the Drizzle schema uses', () => {
    const db = new DatabaseSync(':memory:');
    runMigrations(adapter(db));
    for (const table of tables) {
      const cfg = getTableConfig(table);
      const actual = (db.prepare(`PRAGMA table_info("${cfg.name}")`).all() as { name: string; notnull: number }[])
        .map((c) => `${c.name}:${c.notnull}`)
        .sort();
      const expected = cfg.columns.map((c) => `${c.name}:${c.notNull ? 1 : 0}`).sort();
      expect({ table: cfg.name, columns: actual }).toEqual({ table: cfg.name, columns: expected });
    }
  });

  it('enforce value ranges at the database level', () => {
    const db = new DatabaseSync(':memory:');
    runMigrations(adapter(db));
    const insert = (kg: number) =>
      db
        .prepare(
          "INSERT INTO weight_logs (id, measured_on, weight_kg, created_at, updated_at) VALUES (?, '2026-11-09', ?, 'x', 'x')",
        )
        .run(`id-${kg}`, kg);
    expect(() => insert(80)).not.toThrow();
    expect(() => insert(5)).toThrow();
  });

  it('upgrade a version-1 database without losing data', () => {
    const db = new DatabaseSync(':memory:');
    runMigrations(adapter(db), MIGRATIONS.slice(0, 1));
    db.exec("INSERT INTO weight_logs (id, measured_on, weight_kg, created_at, updated_at) VALUES ('w', '2026-11-09', 85, 't', 't')");
    expect(runMigrations(adapter(db))).toBe(MIGRATIONS.length);
    expect(db.prepare('SELECT count(*) AS n FROM weight_logs').get()).toEqual({ n: 1 });
  });

  it('cascade-delete recipe ingredients and reject entries without a food or recipe', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    runMigrations(adapter(db));
    db.exec("INSERT INTO recipes (id, name, servings, created_at, updated_at) VALUES ('r', 'Pappu', 4, 't', 't')");
    db.exec("INSERT INTO recipe_ingredients (id, recipe_id, food_id, grams, created_at, updated_at) VALUES ('i', 'r', 'toor_dal_raw', 200, 't', 't')");
    db.exec("DELETE FROM recipes WHERE id = 'r'");
    expect(db.prepare('SELECT count(*) AS n FROM recipe_ingredients').get()).toEqual({ n: 0 });
    expect(() =>
      db.exec(`INSERT INTO food_log_entries (id, logged_on, meal, name, quantity_g, measure_key, measure_count, kcal, protein_g, carbs_g, fat_g, fiber_g, source, created_at, updated_at)
        VALUES ('e', '2026-11-09', 'lunch', 'x', 100, 'g', 100, 1, 1, 1, 1, 1, 'manual', 't', 't')`),
    ).toThrow();
  });

  it('rebuild the food diary in v9 without losing entries, and allow photo entries', () => {
    const db = new DatabaseSync(':memory:');
    runMigrations(adapter(db), MIGRATIONS.slice(0, 8));
    db.exec(`INSERT INTO food_log_entries (id, logged_on, meal, food_id, name, quantity_g, measure_key, measure_count, oil_level, kcal, protein_g, carbs_g, fat_g, fiber_g, source, created_at, updated_at)
      VALUES ('e1', '2026-11-09', 'lunch', 'idli', 'Idli', 120, 'piece', 3, 'normal', 175, 5.5, 36, 0.6, 1.8, 'manual', 't', 't')`);
    expect(runMigrations(adapter(db))).toBe(MIGRATIONS.length);
    expect(db.prepare('SELECT id, food_id, custom_food_id, kcal FROM food_log_entries').all()).toEqual([{ id: 'e1', food_id: 'idli', custom_food_id: null, kcal: 175 }]);
    expect(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name = 'food_log_entries_logged_on_idx'").get()).toEqual({ n: 1 });
    const insert = (id: string, source: string) =>
      db.exec(`INSERT INTO food_log_entries (id, logged_on, meal, name, quantity_g, measure_key, measure_count, kcal, protein_g, carbs_g, fat_g, fiber_g, source, created_at, updated_at)
        VALUES ('${id}', '2026-11-09', 'dinner', 'Plate', 350, 'g', 350, 520, 18, 70, 16, 6, '${source}', 't', 't')`);
    expect(() => insert('p', 'photo')).not.toThrow();
    expect(() => insert('m', 'manual')).toThrow();
    expect(() => db.exec("INSERT INTO custom_foods (id, name, kcal_100g, protein_100g, carbs_100g, fat_100g, source, created_at, updated_at) VALUES ('c', 'Bad', 1200, 1, 1, 1, 'label', 't', 't')")).toThrow();
  });

  it('rebuild step days in v12 without losing history, and allow phone-counted days', () => {
    const db = new DatabaseSync(':memory:');
    runMigrations(adapter(db), MIGRATIONS.slice(0, 11));
    db.exec(`INSERT INTO step_days (day, steps, source, flags, created_at, updated_at) VALUES ('2026-11-09', 7200, 'health_connect', '[]', 't', 't'), ('2026-11-10', 5000, 'manual', '[]', 't', 't')`);
    expect(runMigrations(adapter(db))).toBe(MIGRATIONS.length);
    expect(db.prepare('SELECT day, steps, source FROM step_days ORDER BY day').all()).toEqual([
      { day: '2026-11-09', steps: 7200, source: 'health_connect' },
      { day: '2026-11-10', steps: 5000, source: 'manual' },
    ]);
    expect(() => db.exec(`INSERT INTO step_days (day, steps, source, created_at, updated_at) VALUES ('2026-11-11', 3000, 'phone', 't', 't')`)).not.toThrow();
    expect(() => db.exec(`INSERT INTO step_days (day, steps, source, created_at, updated_at) VALUES ('2026-11-12', 3000, 'watch', 't', 't')`)).toThrow();
    expect(() => db.exec(`INSERT INTO step_days (day, steps, source, created_at, updated_at) VALUES ('2026-11-13', 300000, 'phone', 't', 't')`)).toThrow();
  });

  it('refuse to open data from a newer app version', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(`PRAGMA user_version = ${MIGRATIONS.length + 1}`);
    expect(() => runMigrations(adapter(db))).toThrow(/newer/);
  });

  it('roll back a failing migration completely', () => {
    const db = new DatabaseSync(':memory:');
    const bad = ['CREATE TABLE a (id TEXT); CREATE TABLE a (id TEXT);'];
    expect(() => runMigrations(adapter(db), bad)).toThrow();
    expect(adapter(db).getUserVersion()).toBe(0);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'a'").get()).toBeUndefined();
  });
});
