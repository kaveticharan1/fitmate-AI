import { getRandomBytes } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import {
  AUTO_WIPE_AFTER,
  generateDbKey,
  lockoutDelayMs,
  unwrapDbKey,
  wrapDbKey,
  type WrappedKey,
} from './keyWrap';

const K = {
  wrapped: 'fm.vault.wrapped.v1',
  bio: 'fm.vault.bio.v1',
  failures: 'fm.vault.failures.v1',
  prefs: 'fm.security.prefs.v1',
} as const;

const DEVICE_ONLY: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export interface SecurityPrefs {
  biometricEnabled: boolean;
  /** Lock after the app has been in the background this long. 0 = immediately. */
  autoLockSeconds: number;
  /** Blocks screenshots and screen recording; also hides the app in recent apps. */
  blockScreenshots: boolean;
  /** Erase all data after AUTO_WIPE_AFTER wrong PINs in a row. */
  autoWipe: boolean;
}

export const DEFAULT_PREFS: SecurityPrefs = {
  biometricEnabled: false,
  autoLockSeconds: 60,
  blockScreenshots: true,
  autoWipe: false,
};

interface Failures {
  count: number;
  lockedUntil: number;
}

const randomBytes = (n: number) => getRandomBytes(n);

async function readJson<T>(key: string): Promise<T | null> {
  const raw = await SecureStore.getItemAsync(key, DEVICE_ONLY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

const writeJson = (key: string, value: unknown) =>
  SecureStore.setItemAsync(key, JSON.stringify(value), DEVICE_ONLY);

export async function isVaultCreated(): Promise<boolean> {
  return (await SecureStore.getItemAsync(K.wrapped, DEVICE_ONLY)) != null;
}

/** First run: makes a new database key protected by the PIN. Returns the key for opening the database. */
export async function createVault(pin: string): Promise<string> {
  const dbKey = generateDbKey(randomBytes);
  await writeJson(K.wrapped, wrapDbKey(dbKey, pin, randomBytes));
  await writeJson(K.failures, { count: 0, lockedUntil: 0 } satisfies Failures);
  return dbKey;
}

export type PinResult =
  | { ok: true; dbKey: string }
  | { ok: false; reason: 'wrong'; failures: number; retryAfterMs: number; wipeIn: number | null }
  | { ok: false; reason: 'locked'; retryAfterMs: number }
  | { ok: false; reason: 'wiped' }
  | { ok: false; reason: 'missing' };

export async function unlockWithPin(pin: string, now = Date.now()): Promise<PinResult> {
  const wrapped = await readJson<WrappedKey>(K.wrapped);
  if (!wrapped) return { ok: false, reason: 'missing' };
  const failures = (await readJson<Failures>(K.failures)) ?? { count: 0, lockedUntil: 0 };
  if (failures.lockedUntil > now) {
    return { ok: false, reason: 'locked', retryAfterMs: failures.lockedUntil - now };
  }

  const dbKey = unwrapDbKey(wrapped, pin);
  if (dbKey) {
    await writeJson(K.failures, { count: 0, lockedUntil: 0 } satisfies Failures);
    return { ok: true, dbKey };
  }

  const count = failures.count + 1;
  const prefs = await getSecurityPrefs();
  if (prefs.autoWipe && count >= AUTO_WIPE_AFTER) {
    return { ok: false, reason: 'wiped' };
  }
  const delay = lockoutDelayMs(count);
  await writeJson(K.failures, { count, lockedUntil: delay ? now + delay : 0 } satisfies Failures);
  return {
    ok: false,
    reason: 'wrong',
    failures: count,
    retryAfterMs: delay,
    wipeIn: prefs.autoWipe ? AUTO_WIPE_AFTER - count : null,
  };
}

export async function changePin(currentPin: string, newPin: string): Promise<boolean> {
  const wrapped = await readJson<WrappedKey>(K.wrapped);
  if (!wrapped) return false;
  const dbKey = unwrapDbKey(wrapped, currentPin);
  if (!dbKey) return false;
  await writeJson(K.wrapped, wrapDbKey(dbKey, newPin, randomBytes));
  return true;
}

/**
 * Stores a second copy of the database key that Android only releases after a
 * fingerprint/face check (Keystore key bound to biometric authentication).
 */
export async function enableBiometricUnlock(dbKey: string, prompt: string): Promise<void> {
  await SecureStore.setItemAsync(K.bio, dbKey, {
    ...DEVICE_ONLY,
    requireAuthentication: true,
    authenticationPrompt: prompt,
  });
  await setSecurityPrefs({ biometricEnabled: true });
}

export async function disableBiometricUnlock(): Promise<void> {
  await SecureStore.deleteItemAsync(K.bio, { ...DEVICE_ONLY, requireAuthentication: true });
  await setSecurityPrefs({ biometricEnabled: false });
}

/**
 * Shows the system fingerprint/face prompt. Returns the key, or null if the
 * person cancelled or the biometric key was invalidated (e.g. a new fingerprint
 * was added) — in that case they use the PIN and can re-enable biometrics.
 */
export async function unlockWithBiometric(prompt: string): Promise<string | null> {
  try {
    const key = await SecureStore.getItemAsync(K.bio, {
      ...DEVICE_ONLY,
      requireAuthentication: true,
      authenticationPrompt: prompt,
    });
    if (key && /^[0-9a-f]{64}$/.test(key)) {
      await writeJson(K.failures, { count: 0, lockedUntil: 0 } satisfies Failures);
      return key;
    }
    return null;
  } catch {
    return null;
  }
}

export async function getSecurityPrefs(): Promise<SecurityPrefs> {
  return { ...DEFAULT_PREFS, ...((await readJson<Partial<SecurityPrefs>>(K.prefs)) ?? {}) };
}

export async function setSecurityPrefs(patch: Partial<SecurityPrefs>): Promise<SecurityPrefs> {
  const next = { ...(await getSecurityPrefs()), ...patch };
  await writeJson(K.prefs, next);
  return next;
}

/** Removes every key. Without them the encrypted database can never be opened again. */
export async function destroyVault(): Promise<void> {
  await Promise.allSettled([
    SecureStore.deleteItemAsync(K.wrapped, DEVICE_ONLY),
    SecureStore.deleteItemAsync(K.bio, { ...DEVICE_ONLY, requireAuthentication: true }),
    SecureStore.deleteItemAsync(K.failures, DEVICE_ONLY),
    SecureStore.deleteItemAsync(K.prefs, DEVICE_ONLY),
  ]);
}
