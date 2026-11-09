/**
 * @jest-environment node
 */
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS, runMigrations } from '../../db/migrations';
import { createSnapshot, restoreSnapshot, SnapshotError, type SnapshotDb } from './snapshot';

function makeDb() {
  const db = new DatabaseSync(':memory:');
  const tx = (fn: () => void) => {
    db.exec('BEGIN');
    try {
      fn();
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  };
  runMigrations({
    getUserVersion: () => (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version,
    setUserVersion: (v) => db.exec(`PRAGMA user_version = ${v}`),
    exec: (s) => db.exec(s),
    transaction: tx,
  });
  const api: SnapshotDb = {
    all: (sql) => db.prepare(sql).all() as Record<string, unknown>[],
    run: (sql, params) => {
      db.prepare(sql).run(...params);
    },
    transaction: tx,
  };
  return { db, api };
}

function seed(db: DatabaseSync) {
  db.exec(`INSERT INTO profile (id, name, date_of_birth, sex, height_cm, weight_kg, target_weight_kg, goal, activity_level,
    workout_preference, equipment, coach_personality, diet_type, allergies, disliked_foods, cooking_time, budget,
    ai_language, created_at, updated_at)
    VALUES ('me', 'చరణ్', '1996-11-09', 'male', 175, 85, 75, 'fat_loss', 'light', 'home', '["dumbbells"]', 'strict',
    'non_vegetarian', '[]', '["bitter gourd"]', 'under_30', 'medium', 'te', 't', 't')`);
  db.exec(`INSERT INTO weight_logs (id, measured_on, weight_kg, created_at, updated_at) VALUES ('w1', '2026-11-08', 85.4, 't', 't')`);
  db.exec(`INSERT INTO weight_logs (id, measured_on, weight_kg, created_at, updated_at) VALUES ('w2', '2026-11-09', 85.0, 't', 't')`);
}

describe('snapshot and restore', () => {
  it('copies every row to a fresh database, including Telugu text and JSON columns', () => {
    const a = makeDb();
    seed(a.db);
    const snap = createSnapshot(a.api, new Date('2026-11-09T10:00:00Z'));
    expect(snap.schemaVersion).toBe(MIGRATIONS.length);
    expect(snap.tables.weight_logs).toHaveLength(2);

    const b = makeDb();
    const { rows } = restoreSnapshot(b.api, JSON.parse(JSON.stringify(snap)));
    expect(rows).toBe(3);
    const p = b.db.prepare('SELECT name, equipment, weight_kg FROM profile').get() as Record<string, unknown>;
    expect(p).toEqual({ name: 'చరణ్', equipment: '["dumbbells"]', weight_kg: 85 });
  });

  it('replaces existing data instead of merging', () => {
    const a = makeDb();
    seed(a.db);
    const snap = createSnapshot(a.api);
    const b = makeDb();
    b.db.exec(`INSERT INTO weight_logs (id, measured_on, weight_kg, created_at, updated_at) VALUES ('old', '2020-01-01', 99, 't', 't')`);
    restoreSnapshot(b.api, snap);
    const ids = (b.db.prepare('SELECT id FROM weight_logs ORDER BY id').all() as { id: string }[]).map((r) => r.id);
    expect(ids).toEqual(['w1', 'w2']);
  });

  it('ignores unknown columns and refuses unsafe identifiers', () => {
    const b = makeDb();
    const snap = {
      app: 'fitmate-ai',
      schemaVersion: 1,
      exportedAt: 'x',
      tables: {
        weight_logs: [
          { id: 'w9', measured_on: '2026-01-01', weight_kg: 70, created_at: 't', updated_at: 't', hacked: 1, 'x"); DROP TABLE profile; --': 1 },
        ],
      },
    };
    restoreSnapshot(b.api, snap);
    expect(b.db.prepare('SELECT count(*) AS n FROM weight_logs').get()).toEqual({ n: 1 });
    expect(b.db.prepare("SELECT name FROM sqlite_master WHERE name = 'profile'").get()).toBeDefined();
  });

  it('leaves data untouched when a backup is invalid', () => {
    const a = makeDb();
    seed(a.db);
    const bad = { app: 'fitmate-ai', schemaVersion: 1, exportedAt: 'x', tables: { weight_logs: [{ id: 'z', measured_on: 'd', weight_kg: 1, created_at: 't', updated_at: 't' }] } };
    expect(() => restoreSnapshot(a.api, bad)).toThrow(); // CHECK constraint: weight 1 kg
    expect(a.db.prepare('SELECT count(*) AS n FROM weight_logs').get()).toEqual({ n: 2 });
    expect(a.db.prepare('SELECT count(*) AS n FROM profile').get()).toEqual({ n: 1 });
  });

  it('rejects other files and newer versions', () => {
    const b = makeDb();
    expect(() => restoreSnapshot(b.api, { hello: 'world' })).toThrow(SnapshotError);
    expect(() => restoreSnapshot(b.api, { app: 'fitmate-ai', schemaVersion: 999, tables: {} })).toThrow(/newer/);
  });
});
