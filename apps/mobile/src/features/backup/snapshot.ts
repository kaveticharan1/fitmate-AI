import { MIGRATIONS } from '../../db/migrations';
import { BACKUP_TABLES } from '../../db/schema';

/** Minimal database surface used by snapshot/restore, so it can be tested with any SQLite driver. */
export interface SnapshotDb {
  all(sql: string): Record<string, unknown>[];
  run(sql: string, params: (string | number | null)[]): void;
  transaction(fn: () => void): void;
}

export interface Snapshot {
  app: 'fitmate-ai';
  schemaVersion: number;
  exportedAt: string;
  tables: Record<string, Record<string, unknown>[]>;
}

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

export function createSnapshot(db: SnapshotDb, now: Date = new Date()): Snapshot {
  const tables: Snapshot['tables'] = {};
  for (const t of BACKUP_TABLES) tables[t] = db.all(`SELECT * FROM "${t}"`);
  return { app: 'fitmate-ai', schemaVersion: MIGRATIONS.length, exportedAt: now.toISOString(), tables };
}

const IDENT = /^[a-z_][a-z0-9_]*$/;

/**
 * Replaces all data with the snapshot's, inside one transaction (all or nothing).
 * Only known tables and columns that exist in this app version are written.
 */
export function restoreSnapshot(db: SnapshotDb, snapshot: unknown): { rows: number } {
  const s = snapshot as Partial<Snapshot> | null;
  if (!s || s.app !== 'fitmate-ai' || typeof s.tables !== 'object' || s.tables == null) {
    throw new SnapshotError('Not a FitMate backup');
  }
  if (typeof s.schemaVersion !== 'number' || s.schemaVersion > MIGRATIONS.length) {
    throw new SnapshotError('This backup was made by a newer version of FitMate. Update the app first.');
  }
  let rows = 0;
  db.transaction(() => {
    for (const t of [...BACKUP_TABLES].reverse()) db.run(`DELETE FROM "${t}"`, []);
    for (const t of BACKUP_TABLES) {
      const list = s.tables![t] ?? [];
      if (!Array.isArray(list)) throw new SnapshotError(`Invalid data for ${t}`);
      const known = new Set(db.all(`PRAGMA table_info("${t}")`).map((c) => String(c.name)));
      for (const row of list) {
        if (typeof row !== 'object' || row == null) throw new SnapshotError(`Invalid row in ${t}`);
        const cols = Object.keys(row).filter((c) => IDENT.test(c) && known.has(c));
        if (cols.length === 0) continue;
        const values = cols.map((c) => {
          const v = (row as Record<string, unknown>)[c];
          if (v === null || typeof v === 'string' || typeof v === 'number') return v;
          if (typeof v === 'boolean') return v ? 1 : 0;
          return JSON.stringify(v);
        });
        db.run(
          `INSERT INTO "${t}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
          values,
        );
        rows += 1;
      }
    }
  });
  return { rows };
}
