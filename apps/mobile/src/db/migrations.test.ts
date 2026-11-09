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
