import { gcm } from '@noble/ciphers/aes.js';
import { getRandomBytes, randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { addPhotoRow, deletePhotoRow, getPhoto } from '../../db/faceRepo';
import { getSetting, setSetting } from '../../db/repositories';
import { localDate } from '../../lib/time';

/**
 * Private face photos.
 * - Each image is resized to 1024 px, encrypted with AES-256-GCM and kept in the
 *   app's private storage. There are no public URLs, and nothing goes to the gallery.
 * - The photo key is random and lives inside the encrypted database, so photos
 *   can only be opened after the app is unlocked with the PIN.
 * - Photos are not part of backups and are erased with "Delete all data".
 */
const MAGIC = new Uint8Array([0x46, 0x4d, 0x50, 0x31]); // "FMP1"
const DIR_NAME = 'face-photos';

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const unhex = (h: string) => new Uint8Array(h.match(/../g)!.map((x) => parseInt(x, 16)));

function photoKey(): Uint8Array {
  let k = getSetting<string | null>('photoKey', null);
  if (!k || !/^[0-9a-f]{64}$/.test(k)) {
    k = hex(getRandomBytes(32));
    setSetting('photoKey', k);
  }
  return unhex(k);
}

export function encryptImage(jpeg: Uint8Array, key: Uint8Array, nonce: Uint8Array): Uint8Array {
  const body = gcm(key, nonce, MAGIC).encrypt(jpeg);
  const out = new Uint8Array(MAGIC.length + nonce.length + body.length);
  out.set(MAGIC, 0);
  out.set(nonce, MAGIC.length);
  out.set(body, MAGIC.length + nonce.length);
  return out;
}

export function decryptImage(file: Uint8Array, key: Uint8Array): Uint8Array {
  if (file.length < 4 + 12 + 16 || !MAGIC.every((b, i) => file[i] === b)) throw new Error('Not a FitMate photo');
  return gcm(key, file.slice(4, 16), MAGIC).decrypt(file.slice(16));
}

const b64ToBytes = (b64: string) => Uint8Array.from(globalThis.atob(b64), (c) => c.charCodeAt(0));
export function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return globalThis.btoa(s);
}

function dir(): Directory {
  const d = new Directory(Paths.document, DIR_NAME);
  if (!d.exists) d.create({ idempotent: true, intermediates: true });
  return d;
}

const removeTemp = (uri?: string) => {
  if (!uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    /* already gone */
  }
};

/** Saves a picked/taken photo privately. The temporary copies are deleted. Returns the new photo id. */
export async function savePhoto(uri: string, note: string | null, now = new Date()): Promise<string> {
  const ref = await ImageManipulator.manipulate(uri).resize({ width: 1024 }).renderAsync();
  const out = await ref.saveAsync({ compress: 0.75, format: SaveFormat.JPEG, base64: true });
  removeTemp(out.uri);
  removeTemp(uri);
  if (!out.base64) throw new Error('Could not read the photo');
  const id = randomUUID();
  const fileName = `${id}.fmp`;
  const file = new File(dir(), fileName);
  await file.write(encryptImage(b64ToBytes(out.base64), photoKey(), getRandomBytes(12)));
  addPhotoRow({ id, takenOn: localDate(now), takenAt: now.toISOString(), fileName, note });
  return id;
}

/** Decrypts a photo for display or AI analysis (Base64 JPEG, kept in memory only). */
export async function readPhotoBase64(id: string): Promise<string | null> {
  const row = getPhoto(id);
  if (!row) return null;
  const file = new File(dir(), row.fileName);
  if (!file.exists) return null;
  return bytesToB64(decryptImage(await file.bytes(), photoKey()));
}

/** Deletes the encrypted file and its record. */
export function deletePhoto(id: string): void {
  const row = getPhoto(id);
  if (row) {
    try {
      const f = new File(dir(), row.fileName);
      if (f.exists) f.delete();
    } catch {
      /* file already missing */
    }
  }
  deletePhotoRow(id);
}

/** Erases every face photo file (used by "Delete all data"). */
export function deleteAllPhotoFiles(): void {
  try {
    const d = new Directory(Paths.document, DIR_NAME);
    if (d.exists) d.delete();
  } catch {
    /* nothing to delete */
  }
}
