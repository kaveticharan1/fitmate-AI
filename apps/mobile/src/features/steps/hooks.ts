import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { FitmateSteps } from '../../../modules/fitmate-steps';
import { setStepsTask } from '../health/background';
import { stepHoursFor } from '../../db/stepsRepo';
import { hoursOf, localDay } from './ledger';
import { mergeHours } from './hourly';
import { getStepSource, hasActivityPermission, loadLedger, recordReading, requestActivityPermission, sensorAvailable, setStepSource, syncPhoneSteps, writeLedgerToDb, type StepSource } from './phoneSteps';

export const phoneKeys = {
  source: ['steps', 'source'] as const,
  permission: ['steps', 'permission'] as const,
};

export const useStepSource = () => useQuery({ queryKey: phoneKeys.source, queryFn: () => ({ source: getStepSource(), sensor: sensorAvailable() }) });
export const useActivityPermission = () => useQuery({ queryKey: phoneKeys.permission, queryFn: () => hasActivityPermission() });

export function useRequestActivityPermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const ok = await requestActivityPermission();
      if (ok) await syncPhoneSteps();
      return ok;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['steps'] }),
  });
}

export function useSetStepSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: StepSource) => {
      setStepSource(s);
      if (s === 'phone') await syncPhoneSteps();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['steps'] }),
  });
}

/** Saves the phone's count when a screen opens and whenever FitMate comes back to the front. */
export function usePhoneStepsSync() {
  const qc = useQueryClient();
  useEffect(() => {
    const run = () =>
      syncPhoneSteps().then(
        (n) => {
          if (n == null) return;
          qc.invalidateQueries({ queryKey: ['steps'] });
          // Keep counting while FitMate is closed (about every 30 minutes, when Android allows).
          setStepsTask(true).catch(() => undefined);
        },
        () => undefined,
      );
    run();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && run());
    return () => sub.remove();
  }, [qc]);
}

/**
 * Live steps while the screen is open: updates on every step from the sensor,
 * and saves to the database about every 20 seconds. Returns today's count, or
 * null when phone counting isn't active.
 */
export function useLiveSteps(active: boolean): number | null {
  const qc = useQueryClient();
  const [live, setLive] = useState<number | null>(null);
  const lastSave = useRef(0);
  useEffect(() => {
    if (!active || !FitmateSteps) return;
    let cancelled = false;
    let ledger: Awaited<ReturnType<typeof recordReading>> = null;
    const save = () => {
      if (ledger) writeLedgerToDb(ledger);
      lastSave.current = Date.now();
      qc.invalidateQueries({ queryKey: ['steps'] });
    };
    recordReading().then((l) => {
      if (cancelled || !l) return;
      ledger = l;
      setLive(l.days[localDay(Date.now())] ?? 0);
    });
    const started = FitmateSteps.startWatching();
    const sub = started
      ? FitmateSteps.addListener('onSteps', (r) => {
          recordReading(r).then((l) => {
            if (cancelled || !l) return;
            ledger = l;
            setLive(l.days[localDay(Date.now())] ?? 0);
            if (Date.now() - lastSave.current > 20000) save();
          });
        })
      : null;
    return () => {
      cancelled = true;
      sub?.remove();
      FitmateSteps?.stopWatching();
      save();
    };
  }, [active, qc]);
  return active ? live : null;
}

/** Steps in each hour of `day`. Today also uses the phone's newest counts and refreshes every 15 seconds. */
export function useStepHours(day: string) {
  const [today] = useState(() => localDay(Date.now()));
  const isToday = day === today;
  return useQuery({
    queryKey: ['steps', 'hours', day],
    queryFn: async () => {
      const saved = stepHoursFor(day);
      if (!isToday) return saved;
      const ledger = await loadLedger();
      return mergeHours(saved, hoursOf(ledger.hours, day));
    },
    refetchInterval: isToday ? 15000 : false,
  });
}
