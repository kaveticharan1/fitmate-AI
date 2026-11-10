import { useQueryClient } from '@tanstack/react-query';
import * as ScreenCapture from 'expo-screen-capture';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { closeDatabase, deleteDatabaseFile, EncryptionUnavailableError, openEncryptedDatabase } from '../db/client';
import { getProfile } from '../db/repositories';
import { leaveGroupQuietly } from '../features/buddies/service';
import { clearLedger } from '../features/steps/phoneSteps';
import {
  createVault,
  destroyVault,
  getSecurityPrefs,
  isVaultCreated,
  setSecurityPrefs,
  unlockWithBiometric,
  unlockWithPin,
  type PinResult,
  type SecurityPrefs,
  DEFAULT_PREFS,
} from './vault';

export type SessionStatus = 'loading' | 'needs-setup' | 'locked' | 'unlocked' | 'wiped' | 'error';

interface SessionValue {
  status: SessionStatus;
  errorKind: 'encryption' | 'generic' | null;
  hasProfile: boolean;
  prefs: SecurityPrefs;
  /** Consent given on the welcome screen, saved once the database exists. */
  pendingConsent: boolean;
  setPendingConsent: (v: boolean) => void;
  /** Creates the vault and database; `beforeReady` runs (e.g. saving consent) before screens switch. */
  setup: (pin: string, beforeReady?: (dbKey: string) => Promise<void>) => Promise<void>;
  unlockPin: (pin: string) => Promise<PinResult>;
  unlockBiometric: (prompt: string) => Promise<boolean>;
  lock: () => void;
  wipeEverything: () => Promise<void>;
  refreshProfile: () => void;
  updatePrefs: (patch: Partial<SecurityPrefs>) => Promise<void>;
  acknowledgeWipe: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [errorKind, setErrorKind] = useState<SessionValue['errorKind']>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [prefs, setPrefs] = useState<SecurityPrefs>(DEFAULT_PREFS);
  const [pendingConsent, setPendingConsent] = useState(false);
  const backgroundedAt = useRef<number | null>(null);
  const prefsRef = useRef(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  useEffect(() => {
    (async () => {
      try {
        setPrefs(await getSecurityPrefs());
        setStatus((await isVaultCreated()) ? 'locked' : 'needs-setup');
      } catch {
        setErrorKind('generic');
        setStatus('error');
      }
    })();
  }, []);

  // Screenshot / screen-recording protection (also hides the app preview in recents on Android).
  useEffect(() => {
    const key = 'fitmate';
    const apply = prefs.blockScreenshots
      ? ScreenCapture.preventScreenCaptureAsync(key)
      : ScreenCapture.allowScreenCaptureAsync(key);
    apply.catch(() => {});
  }, [prefs.blockScreenshots]);

  const openWithKey = useCallback(async (dbKey: string, beforeReady?: (dbKey: string) => Promise<void>) => {
    try {
      openEncryptedDatabase(dbKey);
      // Runs while the current screen is still mounted (status flips only afterwards).
      await beforeReady?.(dbKey);
      setPrefs(await getSecurityPrefs());
    } catch (e) {
      setErrorKind(e instanceof EncryptionUnavailableError ? 'encryption' : 'generic');
      setStatus('error');
      throw e;
    }
    setHasProfile(getProfile() != null);
    setStatus('unlocked');
  }, []);

  const lock = useCallback(() => {
    closeDatabase();
    // Drop every cached query so no health data stays in memory.
    queryClient.clear();
    setStatus((s) => (s === 'unlocked' ? 'locked' : s));
  }, [queryClient]);

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next === 'background') {
        backgroundedAt.current = Date.now();
        if (prefsRef.current.autoLockSeconds === 0) lock();
      } else if (next === 'active' && backgroundedAt.current != null) {
        const away = (Date.now() - backgroundedAt.current) / 1000;
        backgroundedAt.current = null;
        if (away >= prefsRef.current.autoLockSeconds) lock();
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [lock]);

  const wipeEverything = useCallback(async () => {
    // Removes you from any buddy group on the server first (best effort, never blocks the wipe).
    await leaveGroupQuietly();
    await clearLedger();
    deleteDatabaseFile();
    await destroyVault();
    queryClient.clear();
    setPrefs(DEFAULT_PREFS);
    setHasProfile(false);
    setPendingConsent(false);
  }, [queryClient]);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      errorKind,
      hasProfile,
      prefs,
      pendingConsent,
      setPendingConsent,
      setup: async (pin, beforeReady) => {
        // A fresh vault always starts with an empty database.
        deleteDatabaseFile();
        const dbKey = await createVault(pin);
        await openWithKey(dbKey, beforeReady);
      },
      unlockPin: async (pin) => {
        const result = await unlockWithPin(pin);
        if (result.ok) await openWithKey(result.dbKey);
        if (!result.ok && result.reason === 'wiped') {
          await wipeEverything();
          setStatus('wiped');
        }
        return result;
      },
      unlockBiometric: async (prompt) => {
        const key = await unlockWithBiometric(prompt);
        if (!key) return false;
        await openWithKey(key);
        return true;
      },
      lock,
      wipeEverything: async () => {
        await wipeEverything();
        setStatus('needs-setup');
      },
      refreshProfile: () => setHasProfile(getProfile() != null),
      updatePrefs: async (patch) => setPrefs(await setSecurityPrefs(patch)),
      acknowledgeWipe: () => setStatus('needs-setup'),
    }),
    [status, errorKind, hasProfile, prefs, pendingConsent, openWithKey, lock, wipeEverything],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(SessionContext);
  if (!v) throw new Error('useSession must be used inside SessionProvider');
  return v;
}
