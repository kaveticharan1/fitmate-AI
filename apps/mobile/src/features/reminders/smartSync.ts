import type { TFunction } from 'i18next';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { defaultStepGoal } from '@fitmate/core';
import { listEntries } from '../../db/foodRepo';
import { waterToday } from '../../db/progressRepo';
import { getProfile, getSetting } from '../../db/repositories';
import { stepHistory } from '../../db/stepsRepo';
import { workoutHistory } from '../../db/workoutRepo';
import { localDate } from '../../lib/time';
import { useDiary } from '../food/hooks';
import { useHealthSettings, useStepGoal, useStepHistory } from '../health/hooks';
import { useProfile } from '../profile/hooks';
import { targetsForProfile } from '../profile/targets';
import { useWaterToday } from '../progress/hooks';
import { useWorkoutHistory } from '../workouts/hooks';
import { applySmart } from './notifications';
import { REMINDERS_KEY, withDefaults, type ReminderConfig } from './schedule';
import { buildSmartNudges, type DayStatus, type SmartNudge } from './smart';

/** Notification text for a nudge. Lock-screen visibility is PRIVATE, so this only shows once unlocked. */
export function smartText(t: TFunction, n: SmartNudge, targets: { proteinG: number; waterMl: number; steps: number; gentle: boolean }) {
  switch (n.kind) {
    case 'checkIn':
      return {
        title: t('smart.checkInTitle'),
        body: n.generic ? t('smart.generic') : n.gaps.map((g) => t(`smart.gap.${g}`, n.params)).join(' '),
      };
    case 'logNudge':
      return { title: 'FitMate', body: t('smart.logNudge') };
    case 'morning':
      return {
        title: t('smart.morningTitle'),
        body: targets.gentle
          ? t('smart.morningGentle', { water: (targets.waterMl / 1000).toFixed(1), steps: targets.steps.toLocaleString('en-IN') })
          : t('smart.morning', { protein: targets.proteinG, water: (targets.waterMl / 1000).toFixed(1), steps: targets.steps.toLocaleString('en-IN') }),
      };
    case 'weighIn':
      return { title: t('smart.weighInTitle'), body: t('smart.weighIn') };
  }
}

/** Schedules (or clears) the smart reminders for a given day's status. */
export async function syncSmartReminders(t: TFunction, status: DayStatus, targets: Parameters<typeof smartText>[2], askPermission = false) {
  const config: ReminderConfig = withDefaults(getSetting<Partial<ReminderConfig> | null>(REMINDERS_KEY, null));
  const nudges = buildSmartNudges(config.smart!, status);
  return applySmart(nudges, (n) => smartText(t, n, targets), { askPermission });
}

/** Today's status read straight from the database (for the settings screen's Save). */
export function currentDayStatus(now: Date = new Date()): { status: DayStatus; targets: Parameters<typeof smartText>[2] } | null {
  const profile = getProfile();
  if (!profile) return null;
  const today = localDate(now);
  const t = targetsForProfile(profile, now);
  const entries = listEntries(today);
  const enabled = getSetting<boolean>('healthEnabled', false);
  const stepGoal = getSetting<number | null>('stepGoal', null) ?? defaultStepGoal(profile.activityLevel);
  const stepsRow = stepHistory(today).find((d) => d.day === today);
  return {
    status: {
      now,
      foodEntries: entries.length,
      proteinG: Math.round(entries.reduce((sum, e) => sum + e.proteinG, 0)),
      proteinTarget: t.proteinG,
      waterMl: waterToday(today),
      waterTarget: t.waterMl,
      steps: stepsRow?.steps ?? (enabled ? 0 : null),
      stepGoal,
      workoutToday: workoutHistory(today).some((w) => w.doneOn === today),
      gentle: profile.hasEatingDisorderHistory,
    },
    targets: { proteinG: t.proteinG, waterMl: t.waterMl, steps: stepGoal, gentle: profile.hasEatingDisorderHistory },
  };
}

/**
 * Keeps today's smart reminders up to date: runs when Home opens and whenever
 * food, water, steps or workouts change. Never asks for permission by itself.
 */
export function useSmartReminderSync() {
  const { t } = useTranslation();
  const today = localDate();
  const { data: profile } = useProfile();
  const { data: entries = [] } = useDiary(today);
  const { data: water = 0 } = useWaterToday();
  const { data: health } = useHealthSettings();
  const { data: steps = [] } = useStepHistory(1);
  const { data: workouts = [] } = useWorkoutHistory(0);
  const stepGoal = useStepGoal(health);

  const proteinG = Math.round(entries.reduce((s, e) => s + e.proteinG, 0));
  const stepsToday = steps.find((d) => d.day === today)?.steps ?? (health?.enabled ? 0 : null);
  const workoutToday = workouts.some((w) => w.doneOn === today);
  const ready = !!profile;

  useEffect(() => {
    if (!profile) return;
    const targets = targetsForProfile(profile);
    const status: DayStatus = {
      now: new Date(),
      foodEntries: entries.length,
      proteinG,
      proteinTarget: targets.proteinG,
      waterMl: water,
      waterTarget: targets.waterMl,
      steps: stepsToday,
      stepGoal,
      workoutToday,
      gentle: profile.hasEatingDisorderHistory,
    };
    syncSmartReminders(t, status, { proteinG: targets.proteinG, waterMl: targets.waterMl, steps: stepGoal, gentle: profile.hasEatingDisorderHistory }).catch(() => {
      /* reminders are best-effort; never break the screen */
    });
    // Recalculate only when the numbers that matter change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, today, entries.length, proteinG, water, stepsToday, stepGoal, workoutToday]);
}
