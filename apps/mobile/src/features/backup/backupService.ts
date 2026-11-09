import { decryptJsonBackup, encryptJsonBackup } from '@fitmate/core';
import * as DocumentPicker from 'expo-document-picker';
import { getRandomBytes } from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getRawDb } from '../../db/client';
import { localDate } from '../../lib/time';
import { createSnapshot, restoreSnapshot, type SnapshotDb } from './snapshot';

function snapshotDb(): SnapshotDb {
  const db = getRawDb();
  return {
    all: (sql) => db.getAllSync<Record<string, unknown>>(sql),
    run: (sql, params) => {
      db.runSync(sql, params);
    },
    transaction: (fn) => db.withTransactionSync(fn),
  };
}

async function shareAndDelete(file: File, mimeType: string, title: string) {
  try {
    if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: title });
  } finally {
    // The share sheet has made its own copy; don't leave data in the cache.
    try {
      file.delete();
    } catch {
      // already gone
    }
  }
}

/** Encrypts everything with the backup password and opens the share sheet (Drive, Files, etc.). */
export async function exportEncryptedBackup(password: string, dialogTitle: string): Promise<void> {
  const snapshot = createSnapshot(snapshotDb());
  const bytes = encryptJsonBackup(snapshot, password, (n) => getRandomBytes(n));
  const file = new File(Paths.cache, `FitMate-backup-${localDate()}.fmbak`);
  if (file.exists) file.delete();
  file.create();
  await file.write(bytes);
  await shareAndDelete(file, 'application/octet-stream', dialogTitle);
}

/** A readable (NOT encrypted) copy of all data, for the right to access one's data. */
export async function exportReadableCopy(dialogTitle: string): Promise<void> {
  const snapshot = createSnapshot(snapshotDb());
  const file = new File(Paths.cache, `FitMate-data-${localDate()}.json`);
  if (file.exists) file.delete();
  file.create();
  await file.write(JSON.stringify(snapshot, null, 2));
  await shareAndDelete(file, 'application/json', dialogTitle);
}

export type PickResult = { kind: 'cancelled' } | { kind: 'picked'; bytes: Uint8Array; name: string };

export async function pickBackupFile(): Promise<PickResult> {
  const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.[0]) return { kind: 'cancelled' };
  const asset = res.assets[0];
  const file = new File(asset.uri);
  try {
    return { kind: 'picked', bytes: await file.bytes(), name: asset.name };
  } finally {
    try {
      file.delete();
    } catch {
      // ignore
    }
  }
}

/** Decrypts (throws BackupPasswordError / BackupFormatError) and replaces all data. */
export function restoreEncryptedBackup(bytes: Uint8Array, password: string): { rows: number } {
  const snapshot = decryptJsonBackup(bytes, password);
  return restoreSnapshot(snapshotDb(), snapshot);
}
