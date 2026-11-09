import { bytesToB64, decryptImage, encryptImage } from './photoStore';

jest.mock('expo-crypto', () => ({ getRandomBytes: (n: number) => new Uint8Array(n).fill(7), randomUUID: () => 'id' }));
jest.mock('expo-file-system', () => ({ Directory: class {}, File: class {}, Paths: { document: 'doc' } }));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg' } }));
jest.mock('../../db/faceRepo', () => ({}));
jest.mock('../../db/repositories', () => ({ getSetting: () => null, setSetting: () => undefined }));

const key = new Uint8Array(32).fill(1);
const nonce = new Uint8Array(12).fill(2);
const jpeg = new Uint8Array([0xff, 0xd8, 1, 2, 3, 4, 5, 0xff, 0xd9]);

describe('photo encryption', () => {
  it('round-trips and hides the image bytes', () => {
    const enc = encryptImage(jpeg, key, nonce);
    expect(Array.from(enc.slice(0, 4))).toEqual([0x46, 0x4d, 0x50, 0x31]);
    expect(Buffer.from(enc).includes(Buffer.from(jpeg))).toBe(false);
    expect(Array.from(decryptImage(enc, key))).toEqual(Array.from(jpeg));
  });
  it('refuses a wrong key, tampering and foreign files', () => {
    const enc = encryptImage(jpeg, key, nonce);
    expect(() => decryptImage(enc, new Uint8Array(32).fill(9))).toThrow();
    const bad = enc.slice();
    bad[bad.length - 1]! ^= 1;
    expect(() => decryptImage(bad, key)).toThrow();
    expect(() => decryptImage(jpeg, key)).toThrow(/Not a FitMate photo/);
  });
  it('encodes large images to base64 without overflowing', () => {
    const big = new Uint8Array(200_000).fill(65);
    expect(bytesToB64(big)).toBe(Buffer.from(big).toString('base64'));
  });
});
