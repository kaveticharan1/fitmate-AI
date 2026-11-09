import { gcm } from '@noble/ciphers/aes.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { scrypt } from '@noble/hashes/scrypt.js';

/**
 * The database is encrypted with a random 256-bit key. That key is never stored
 * in plain form: it is "wrapped" (encrypted with AES-256-GCM) under a key derived
 * from the user's PIN with scrypt. A wrong PIN fails GCM authentication, so no
 * separate PIN hash is stored. The wrapped blob itself sits in SecureStore, which
 * Android protects with a Keystore key — two layers.
 */

export interface PinKdf {
  N: number;
  r: number;
  p: number;
}

/** 16 MB of memory per guess: noticeably slow for brute force, under a second or two on a phone. */
export const PIN_KDF: PinKdf = { N: 2 ** 14, r: 8, p: 1 };

export interface WrappedKey {
  v: 1;
  salt: string;
  nonce: string;
  wrapped: string;
  N: number;
  r: number;
  p: number;
}

const enc = new TextEncoder();
const AAD = enc.encode('fitmate-db-key-v1');

function pinKey(pin: string, salt: Uint8Array, kdf: PinKdf): Uint8Array {
  return scrypt(enc.encode(pin), salt, { ...kdf, dkLen: 32 });
}

export function generateDbKey(randomBytes: (n: number) => Uint8Array): string {
  return bytesToHex(randomBytes(32));
}

export function wrapDbKey(
  dbKeyHex: string,
  pin: string,
  randomBytes: (n: number) => Uint8Array,
  kdf: PinKdf = PIN_KDF,
): WrappedKey {
  if (!/^[0-9a-f]{64}$/.test(dbKeyHex)) throw new Error('Invalid database key');
  const salt = randomBytes(16);
  const nonce = randomBytes(12);
  const k = pinKey(pin, salt, kdf);
  const wrapped = gcm(k, nonce, AAD).encrypt(hexToBytes(dbKeyHex));
  k.fill(0);
  return { v: 1, salt: bytesToHex(salt), nonce: bytesToHex(nonce), wrapped: bytesToHex(wrapped), ...kdf };
}

/** Returns the database key, or null when the PIN is wrong. */
export function unwrapDbKey(w: WrappedKey, pin: string): string | null {
  const k = pinKey(pin, hexToBytes(w.salt), { N: w.N, r: w.r, p: w.p });
  try {
    return bytesToHex(gcm(k, hexToBytes(w.nonce), AAD).decrypt(hexToBytes(w.wrapped)));
  } catch {
    return null;
  } finally {
    k.fill(0);
  }
}

/**
 * Waiting time after a wrong PIN, by number of consecutive failures.
 * 1–4 failures: none; then 30 s, 1 min, 5 min, 15 min, and 30 min from the 9th.
 */
export function lockoutDelayMs(failures: number): number {
  if (failures < 5) return 0;
  const schedule = [30_000, 60_000, 300_000, 900_000];
  return schedule[failures - 5] ?? 1_800_000;
}

/** Number of wrong PINs after which data is erased, when auto-wipe is on. */
export const AUTO_WIPE_AFTER = 10;
