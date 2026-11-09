import { randomBytes as nodeRandomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  BackupFormatError,
  BackupPasswordError,
  decryptJsonBackup,
  encryptJsonBackup,
  readBackupHeader,
} from './backupCrypto';

const rnd = (n: number) => new Uint8Array(nodeRandomBytes(n));
// Low cost in tests only; the app uses DEFAULT_KDF.
const FAST = { N: 2 ** 10, r: 8, p: 1 };
const PASSWORD = 'correct horse battery';
const data = { profile: { name: 'చరణ్', weightKg: 85 }, weights: [{ kg: 85.2, date: '2026-11-09' }] };

describe('encrypted backups', () => {
  it('round-trips data, including Telugu text', () => {
    const file = encryptJsonBackup(data, PASSWORD, rnd, FAST);
    expect(decryptJsonBackup(file, PASSWORD)).toEqual(data);
  });

  it('does not contain the plaintext', () => {
    const file = encryptJsonBackup(data, PASSWORD, rnd, FAST);
    const asText = new TextDecoder().decode(file);
    expect(asText).not.toContain('weightKg');
    expect(asText).not.toContain('85.2');
  });

  it('uses a fresh salt and nonce every time', () => {
    const a = readBackupHeader(encryptJsonBackup(data, PASSWORD, rnd, FAST)).header;
    const b = readBackupHeader(encryptJsonBackup(data, PASSWORD, rnd, FAST)).header;
    expect(a.salt).not.toBe(b.salt);
    expect(a.nonce).not.toBe(b.nonce);
  });

  it('rejects the wrong password', () => {
    const file = encryptJsonBackup(data, PASSWORD, rnd, FAST);
    expect(() => decryptJsonBackup(file, 'wrong password!!')).toThrow(BackupPasswordError);
  });

  it('detects a changed byte in the data or the header', () => {
    const file = encryptJsonBackup(data, PASSWORD, rnd, FAST);
    const body = file.slice();
    body[body.length - 1]! ^= 1;
    expect(() => decryptJsonBackup(body, PASSWORD)).toThrow(BackupPasswordError);

    const header = file.slice();
    const { headerBytes } = readBackupHeader(header);
    const idx = 6 + new TextDecoder().decode(headerBytes).indexOf('createdAt') + 12;
    header[idx] = header[idx] === 0x31 ? 0x32 : 0x31;
    expect(() => decryptJsonBackup(header, PASSWORD)).toThrow(BackupPasswordError);
  });

  it('rejects files that are not backups', () => {
    expect(() => decryptJsonBackup(new TextEncoder().encode('hello world, not a backup'), PASSWORD)).toThrow(
      BackupFormatError,
    );
    expect(() => decryptJsonBackup(new Uint8Array([0x46, 0x4d, 0x42, 0x4b, 0, 1]), PASSWORD)).toThrow(
      BackupFormatError,
    );
  });

  it('refuses short passwords when creating a backup', () => {
    expect(() => encryptJsonBackup(data, 'short', rnd, FAST)).toThrow(RangeError);
  });
});
