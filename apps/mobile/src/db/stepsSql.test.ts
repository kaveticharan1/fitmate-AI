/**
 * @jest-environment node
 *
 * Runs the SQL that Drizzle generates for the steps repository on Node's SQLite,
 * to prove synced steps never overwrite a day the user typed in.
 */
import { ne } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from './migrations';
import { sleepLogs, stepDays } from './schema';

const builder = drizzle(async () => ({ rows: [] }));

function freshDb() {
  const db = new DatabaseSync(':memory:');
  for (const m of MIGRATIONS) db.exec(m);
  return db;
}

const syncUpsert = (day: string, steps: number) =>
  builder
    .insert(stepDays)
    .values({ day, steps, source: 'health_connect', flags: '[]', createdAt: 'x', updatedAt: 'x' })
    .onConflictDoUpdate({ target: stepDays.day, set: { steps, flags: '[]', updatedAt: 'y' }, setWhere: ne(stepDays.source, 'manual') })
    .toSQL();

describe('steps SQL', () => {
  it('updates synced days but keeps typed-in days', () => {
    const db = freshDb();
    db.exec(`INSERT INTO step_days VALUES ('2026-11-09', 7000, 'manual', '[]', 'a', 'a')`);
    db.exec(`INSERT INTO step_days VALUES ('2026-11-08', 100, 'health_connect', '[]', 'a', 'a')`);
    for (const [day, steps] of [['2026-11-09', 5000], ['2026-11-08', 9000], ['2026-11-07', 4000]] as const) {
      const q = syncUpsert(day, steps);
      db.prepare(q.sql).run(...(q.params as never[]));
    }
    const rows = db.prepare('SELECT day, steps, source FROM step_days ORDER BY day').all();
    expect(rows).toEqual([
      { day: '2026-11-07', steps: 4000, source: 'health_connect' },
      { day: '2026-11-08', steps: 9000, source: 'health_connect' },
      { day: '2026-11-09', steps: 7000, source: 'manual' },
    ]);
  });

  it('adds imported sleep only for mornings with nothing logged', () => {
    const db = freshDb();
    db.exec(`INSERT INTO sleep_logs VALUES ('a', '2026-11-09', '22:30', '06:00', 450, 'x', 'x', NULL)`);
    for (const [id, woke] of [['b', '2026-11-09'], ['c', '2026-11-08']] as const) {
      const q = builder.insert(sleepLogs).values({ id, wokeOn: woke, bedTime: '23:00', wakeTime: '06:00', minutes: 420, createdAt: 'x', updatedAt: 'x' }).onConflictDoNothing({ target: sleepLogs.wokeOn }).toSQL();
      db.prepare(q.sql).run(...(q.params as never[]));
    }
    expect(db.prepare('SELECT id, woke_on FROM sleep_logs ORDER BY woke_on').all()).toEqual([
      { id: 'c', woke_on: '2026-11-08' },
      { id: 'a', woke_on: '2026-11-09' },
    ]);
  });

  it('rejects impossible step counts', () => {
    const db = freshDb();
    expect(() => db.exec(`INSERT INTO step_days VALUES ('2026-11-09', -5, 'manual', '[]', 'a', 'a')`)).toThrow();
    expect(() => db.exec(`INSERT INTO step_days VALUES ('2026-11-09', 10, 'fitbit', '[]', 'a', 'a')`)).toThrow();
  });
});
