import { gcm } from '@noble/ciphers/aes.js';
import { scrypt } from '@noble/hashes/scrypt.js';

/**
 * Encrypted backup file format (version 1):
 *
 *   "FMBK" (4 bytes) | header length (uint16 BE) | header JSON (UTF-8) | AES-256-GCM ciphertext+tag
 *
 * The header stores the scrypt parameters, salt and nonce (none of these are secret).
 * The header bytes are also passed to GCM as additional authenticated data, so any
 * tampering with them makes decryption fail.
 */

const MAGIC = new Uint8Array([0x46, 0x4d, 0x42, 0x4b]); // "FMBK"

export interface KdfParams {
  N: number;
  r: number;
  p: number;
}

/** 2^15 iterations, 8 × 32 MB memory: slow for attackers, a second or two on a phone. */
export const DEFAULT_KDF: KdfParams = { N: 2 ** 15, r: 8, p: 1 };

interface BackupHeader {
  v: 1;
  kdf: 'scrypt';
  N: number;
  r: number;
  p: number;
  salt: string;
  nonce: string;
  createdAt: string;
}

export class BackupFormatError extends Error {
  constructor(message = 'This is not a FitMate backup file') {
    super(message);
    this.name = 'BackupFormatError';
  }
}

export class BackupPasswordError extends Error {
  constructor() {
    super('Wrong backup password, or the file was changed');
    this.name = 'BackupPasswordError';
  }
}

const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64 = (bytes: Uint8Array) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};
const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

function deriveKey(password: string, salt: Uint8Array, kdf: KdfParams): Uint8Array {
  return scrypt(enc.encode(password.normalize('NFKC')), salt, { ...kdf, dkLen: 32 });
}

export function encryptBackup(
  plaintext: Uint8Array,
  password: string,
  randomBytes: (n: number) => Uint8Array,
  kdf: KdfParams = DEFAULT_KDF,
  now: Date = new Date(),
): Uint8Array {
  if (password.length < 10) throw new RangeError('Backup password must be at least 10 characters');
  const salt = randomBytes(16);
  const nonce = randomBytes(12);
  const header: BackupHeader = {
    v: 1,
    kdf: 'scrypt',
    ...kdf,
    salt: toB64(salt),
    nonce: toB64(nonce),
    createdAt: now.toISOString(),
  };
  const headerBytes = enc.encode(JSON.stringify(header));
  if (headerBytes.length > 0xffff) throw new Error('Header too large');
  const key = deriveKey(password, salt, kdf);
  const ciphertext = gcm(key, nonce, headerBytes).encrypt(plaintext);
  key.fill(0);

  const out = new Uint8Array(4 + 2 + headerBytes.length + ciphertext.length);
  out.set(MAGIC, 0);
  out[4] = (headerBytes.length >> 8) & 0xff;
  out[5] = headerBytes.length & 0xff;
  out.set(headerBytes, 6);
  out.set(ciphertext, 6 + headerBytes.length);
  return out;
}

export function readBackupHeader(file: Uint8Array): { header: BackupHeader; headerBytes: Uint8Array; body: Uint8Array } {
  if (file.length < 6 || !MAGIC.every((b, i) => file[i] === b)) throw new BackupFormatError();
  const len = (file[4]! << 8) | file[5]!;
  if (file.length < 6 + len + 16) throw new BackupFormatError('Backup file is truncated');
  const headerBytes = file.subarray(6, 6 + len);
  let header: BackupHeader;
  try {
    header = JSON.parse(dec.decode(headerBytes)) as BackupHeader;
  } catch {
    throw new BackupFormatError();
  }
  if (header.v !== 1 || header.kdf !== 'scrypt') throw new BackupFormatError('Unsupported backup version');
  // Refuse absurd KDF parameters that could freeze the phone.
  if (!(header.N >= 2 ** 10 && header.N <= 2 ** 20 && header.r >= 1 && header.r <= 16 && header.p >= 1 && header.p <= 4)) {
    throw new BackupFormatError('Unsupported backup settings');
  }
  return { header, headerBytes, body: file.subarray(6 + len) };
}

export function decryptBackup(file: Uint8Array, password: string): Uint8Array {
  const { header, headerBytes, body } = readBackupHeader(file);
  const key = deriveKey(password, fromB64(header.salt), header);
  try {
    return gcm(key, fromB64(header.nonce), headerBytes).decrypt(body);
  } catch {
    throw new BackupPasswordError();
  } finally {
    key.fill(0);
  }
}

/** Convenience wrappers for JSON payloads. */
export const encryptJsonBackup = (
  data: unknown,
  password: string,
  randomBytes: (n: number) => Uint8Array,
  kdf?: KdfParams,
) => encryptBackup(enc.encode(JSON.stringify(data)), password, randomBytes, kdf);

export const decryptJsonBackup = <T = unknown>(file: Uint8Array, password: string): T =>
  JSON.parse(dec.decode(decryptBackup(file, password))) as T;
