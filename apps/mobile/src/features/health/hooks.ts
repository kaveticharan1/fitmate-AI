import { hasBackgroundAccess, requestBackgroundAccess } from './background';
import { defaultStepGoal } from '@fitmate/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { clearManualSteps, setManualSteps, stepHistory } from '../../db/stepsRepo';
import { addDays, localDate } from '../../lib/time';
import { useProfile } from '../profile/hooks';
import {
  connectHealth,
  disconnectHealth,
  getHealthSettings,
  healthAvailability,
  setHealthSetting,
  syncHealth,
  type HealthSettings,
} from './healthConnect';

export const healthKeys = {
  background: ['health', 'background'] as const,
  steps: (days: number) => ['steps', days] as const,
  settings: ['health', 'settings'] as const,
  availability: ['health', 'availability'] as const,
};

export const useStepHistory = (days: number) =>
  useQuery({ queryKey: healthKeys.steps(days), queryFn: () => stepHistory(addDays(localDate(), -(days - 1))) });

export const useHealthSettings = () => useQuery({ queryKey: healthKeys.settings, queryFn: () => getHealthSettings() });
export const useHealthAvailability = () => useQuery({ queryKey: healthKeys.availability, queryFn: () => healthAvailability() });

function useInvalidateHealthData() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['steps'] });
    qc.invalidateQueries({ queryKey: ['health'] });
    qc.invalidateQueries({ queryKey: ['progress'] });
    qc.invalidateQueries({ queryKey: ['profile'] });
    qc.invalidateQueries({ queryKey: ['weights'] });
  };
}

export function useSyncHealth() {
  const done = useInvalidateHealthData();
  return useMutation({ mutationFn: (force: boolean) => syncHealth({ force }), onSuccess: done });
}

/** Quietly syncs when a screen opens (at most every few minutes). */
export function useAutoSync(enabled: boolean | undefined) {
  const sync = useSyncHealth();
  const { mutate } = sync;
  useEffect(() => {
    if (enabled) mutate(false);
  }, [enabled, mutate]);
  return sync;
}

export function useConnectHealth() {
  const done = useInvalidateHealthData();
  return useMutation({
    mutationFn: async () => {
      const granted = await connectHealth();
      if (granted.steps) await syncHealth({ force: true });
      return granted;
    },
    onSuccess: done,
  });
}

export function useDisconnectHealth() {
  const done = useInvalidateHealthData();
  return useMutation({ mutationFn: async () => disconnectHealth(), onSuccess: done });
}

export function useSetHealthSetting() {
  const done = useInvalidateHealthData();
  return useMutation({
    mutationFn: async (v: { key: 'healthImportWeight' | 'healthImportSleep' | 'stepGoal'; value: unknown }) => setHealthSetting(v.key, v.value),
    onSuccess: done,
  });
}

export function useManualSteps() {
  const done = useInvalidateHealthData();
  return {
    set: useMutation({ mutationFn: async (v: { day: string; steps: number }) => setManualSteps(v.day, v.steps), onSuccess: done }),
    clear: useMutation({ mutationFn: async (day: string) => clearManualSteps(day), onSuccess: done }),
  };
}

/** The user's goal, or a default from their activity level. */
export function useStepGoal(settings: HealthSettings | undefined): number {
  const { data: profile } = useProfile();
  return settings?.stepGoal ?? defaultStepGoal(profile?.activityLevel ?? 'light');
}

export const useBackgroundAccess = () => useQuery({ queryKey: healthKeys.background, queryFn: () => hasBackgroundAccess() });

export function useRequestBackgroundAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => requestBackgroundAccess(),
    onSuccess: () => qc.invalidateQueries({ queryKey: healthKeys.background }),
  });
}
