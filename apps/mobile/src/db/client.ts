import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { Directory, Paths } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';
import { runMigrations } from './migrations';
import * as schema from './schema';

export const DB_NAME = 'fitmate.db';

export type AppDb = ExpoSQLiteDatabase<typeof schema>;

let raw: SQLite.SQLiteDatabase | null = null;
let orm: AppDb | null = null;

export class EncryptionUnavailableError extends Error {
  constructor() {
    super(
      'This build does not include SQLCipher encryption. FitMate refuses to store health data unencrypted. Use a development or release build, not Expo Go.',
    );
    this.name = 'EncryptionUnavailableError';
  }
}

/**
 * Opens (or creates) the encrypted database with a 256-bit raw key and runs migrations.
 * Refuses to continue if SQLCipher isn't compiled in, so data is never written in plain text.
 */
export function openEncryptedDatabase(keyHex: string): AppDb {
  if (!/^[0-9a-f]{64}$/.test(keyHex)) throw new Error('Invalid database key');
  closeDatabase();
  const db = SQLite.openDatabaseSync(DB_NAME);
  try {
    // Must be the first statement on the connection.
    db.execSync(`PRAGMA key = "x'${keyHex}'";`);
    const cipher = db.getFirstSync<{ cipher_version?: string }>('PRAGMA cipher_version;');
    if (!cipher?.cipher_version) throw new EncryptionUnavailableError();
    // Fails here if the key is wrong ("file is not a database").
    db.getFirstSync('SELECT count(*) AS n FROM sqlite_master;');
    db.execSync('PRAGMA foreign_keys = ON;');
    db.execSync('PRAGMA journal_mode = WAL;');
    runMigrations({
      getUserVersion: () => db.getFirstSync<{ user_version: number }>('PRAGMA user_version;')?.user_version ?? 0,
      setUserVersion: (v) => db.execSync(`PRAGMA user_version = ${Math.trunc(v)};`),
      exec: (sql) => db.execSync(sql),
      transaction: (fn) => db.withTransactionSync(fn),
    });
  } catch (e) {
    db.closeSync();
    throw e;
  }
  raw = db;
  orm = drizzle(db, { schema });
  return orm;
}

export function getDb(): AppDb {
  if (!orm) throw new Error('Database is locked');
  return orm;
}

export function getRawDb(): SQLite.SQLiteDatabase {
  if (!raw) throw new Error('Database is locked');
  return raw;
}

export const isDatabaseOpen = () => orm != null;

export function closeDatabase(): void {
  if (raw) {
    try {
      raw.closeSync();
    } catch {
      // already closed
    }
  }
  raw = null;
  orm = null;
}

/** Closes and deletes the database file, and the encrypted face photos that belong to it. */
export function deleteDatabaseFile(): void {
  closeDatabase();
  try {
    SQLite.deleteDatabaseSync(DB_NAME);
  } catch {
    // no file yet
  }
  try {
    const photos = new Directory(Paths.document, 'face-photos');
    if (photos.exists) photos.delete();
  } catch {
    // no photos
  }
}
