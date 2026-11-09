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

const tables = [schema.profile, schema.consents, schema.weightLogs, schema.bodyMeasurements, schema.appSettings];

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
