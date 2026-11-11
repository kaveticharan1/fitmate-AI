import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { FitmateShare } from '../../../modules/fitmate-share';
import { fetchLatest, installedApp, isNewer, updateErrorKey, type LatestRelease, type UpdateErrorKey } from './updates';

export interface UpdateCheck {
  latest: LatestRelease;
  current: { versionCode: number; versionName: string };
  available: boolean;
}

/** Looks for a newer FitMate at most every 6 hours (only where in-app updates work). */
export function useUpdateCheck(enabled = true) {
  return useQuery({
    queryKey: ['app-update'],
    enabled: enabled && !!FitmateShare,
    staleTime: 6 * 60 * 60 * 1000,
    retry: 1,
    queryFn: async (): Promise<UpdateCheck | null> => {
      const current = installedApp();
      if (!current) return null;
      const latest = await fetchLatest();
      return { latest, current, available: isNewer(latest, current) };
    },
  });
}

export type UpdatePhase = 'idle' | 'permission' | 'downloading' | 'installing' | 'opened' | 'error';

/**
 * One tap: (ask once for "Install unknown apps") → download with progress →
 * verify → Android's "Update" screen. The app's data is kept by Android.
 */
export function useUpdater(latest: LatestRelease | undefined) {
  const [phase, setPhase] = useState<UpdatePhase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<UpdateErrorKey | null>(null);
  const waitingForPermission = useRef(false);
  const running = useRef(false);

  useEffect(() => {
    const sub = FitmateShare?.addListener('onUpdateProgress', (p) => {
      if (p.total > 0) setProgress(Math.min(1, p.received / p.total));
    });
    return () => sub?.remove();
  }, []);

  const start = useCallback(async () => {
    const native = FitmateShare;
    if (!native || !latest || running.current) return;
    running.current = true;
    setError(null);
    try {
      if (!native.canInstall()) {
        waitingForPermission.current = true;
        setPhase('permission');
        native.openInstallSettings();
        return;
      }
      const cached = native.downloadedUpdate();
      const cachedOk = cached && (latest.versionCode == null || cached.versionCode >= latest.versionCode);
      if (!cachedOk) {
        setPhase('downloading');
        setProgress(0);
        await native.downloadUpdate(latest.apkUrl);
      }
      setPhase('installing');
      await native.installUpdate();
      setPhase('opened');
    } catch (e) {
      setError(updateErrorKey(e));
      setPhase('error');
    } finally {
      running.current = false;
    }
  }, [latest]);

  // Back from Settings: carry on by itself once the switch is on.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active' || !waitingForPermission.current) return;
      waitingForPermission.current = false;
      if (FitmateShare?.canInstall()) void start();
      else {
        setError('permission');
        setPhase('error');
      }
    });
    return () => sub.remove();
  }, [start]);

  return { phase, progress, error, start };
}
