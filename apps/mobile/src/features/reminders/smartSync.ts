import type { TFunction } from 'i18next';
import i18n from '../../i18n';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { defaultStepGoal } from '@fitmate/core';
import { listEntries } from '../../db/foodRepo';
import { waterToday } from '../../db/progressRepo';
import { getProfile, getSetting } from '../../db/repositories';
import { stepHistory } from '../../db/stepsRepo';
import { workoutHistory } from '../../db/workoutRepo';
import { getCheckin } from '../../db/faceRepo';
import { routineDone } from '../../db/skinRepo';
import { localDate } from '../../lib/time';
import { useDiary } from '../food/hooks';
import { useHealthSettings, useStepGoal, useStepHistory } from '../health/hooks';
import { useProfile } from '../profile/hooks';
import { targetsForProfile } from '../profile/targets';
import { useWaterToday } from '../progress/hooks';
import { useWorkoutHistory } from '../workouts/hooks';
import { useTodayCheckin } from '../face/hooks';
import { useRoutineDone } from '../skin/hooks';
import { applySmart } from './notifications';
import { REMINDERS_KEY, withDefaults, type ReminderConfig } from './schedule';
import { buildSmartNudges, findGaps, type DayStatus, type SmartNudge } from './smart';
import { saveStepsSnapshot, setStepsTask } from '../health/background';
import { getStepSource, hasActivityPermission, sensorAvailable } from '../steps/phoneSteps';

/** Notification text for a nudge. Lock-screen visibility is PRIVATE, so this only shows once unlocked. */
export function smartText(t: TFunction, n: SmartNudge, targets: { proteinG: number; waterMl: number; steps: number; gentle: boolean }) {
  switch (n.kind) {
    case 'checkIn':
      return {
        title: t('smart.checkInTitle'),
        body: n.generic ? t('smart.generic') : (n.gaps ?? []).map((g) => t(`smart.gap.${g}`, n.params ?? {})).join(' '),
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
    case 'meal':
      return { title: t(`meals.${String(n.params?.meal ?? 'lunch')}`), body: t('smart.mealBody') };
    case 'workout':
      return { title: t('smart.workoutTitle'), body: t('smart.workoutBody') };
    case 'bedtime':
      return { title: t('smart.bedtimeTitle'), body: t('smart.bedtimeBody') };
    case 'face':
      return { title: t('smart.faceTitle'), body: t('smart.faceBody') };
    case 'skincareAm':
      return { title: t('smart.skinAmTitle'), body: t('smart.skinAmBody') };
    case 'skincarePm':
      return { title: t('smart.skinPmTitle'), body: t('smart.skinPmBody') };
    case 'water':
      return { title: 'FitMate', body: t('reminders.waterBody') };
  }
}

/** Schedules (or clears) the smart reminders for a given day's status. */
export async function syncSmartReminders(t: TFunction, status: DayStatus, targets: Parameters<typeof smartText>[2], askPermission = false) {
  const config: ReminderConfig = withDefaults(getSetting<Partial<ReminderConfig> | null>(REMINDERS_KEY, null));
  const nudges = buildSmartNudges(config.smart!, status, config.water);
  const count = await applySmart(nudges, (n) => smartText(t, n, targets), { askPermission });
  await keepStepsCheck(status, nudges);
  return count;
}

/**
 * If tonight's check-in will mention steps, lets the background step check
 * keep it accurate while FitMate is closed (steps only go up during the day,
 * so it's only needed while you're behind).
 */
async function keepStepsCheck(status: DayStatus, nudges: SmartNudge[]) {
  const checkIn = nudges.find((n) => n.id === 'smart-checkin');
  const today = localDate(status.now);
  const tonight = checkIn && 'date' in checkIn.when && localDate(checkIn.when.date) === today && !checkIn.generic ? checkIn : null;
  const behind = status.steps != null && status.steps < status.stepGoal * 0.7;
  // Phone counting needs the background check all day, to keep counting while FitMate is closed.
  const phone = getStepSource() === 'phone' && sensorAvailable() && (await hasActivityPermission());
  if (!tonight || !behind || !('date' in tonight.when)) {
    await saveStepsSnapshot(null);
    await setStepsTask(phone);
    return;
  }
  await saveStepsSnapshot({
    day: today,
    checkInAt: tonight.when.date.toISOString(),
    otherGaps: findGaps({ ...status, steps: status.stepGoal }),
    gaps: tonight.gaps ?? [],
    params: Object.fromEntries(Object.entries(tonight.params ?? {}).map(([k, v]) => [k, Number(v)])),
    stepGoal: status.stepGoal,
    lang: i18n.language === 'te' ? 'te' : 'en',
    source: phone ? 'phone' : 'health_connect',
  });
  await setStepsTask(true);
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
      mealsLogged: [...new Set(entries.map((e) => e.meal))],
      proteinG: Math.round(entries.reduce((sum, e) => sum + e.proteinG, 0)),
      proteinTarget: t.proteinG,
      waterMl: waterToday(today),
      waterTarget: t.waterMl,
      steps: stepsRow?.steps ?? (enabled ? 0 : null),
      stepGoal,
      workoutToday: workoutHistory(today).some((w) => w.doneOn === today),
      faceCheckedIn: getCheckin(today) != null,
      skincareDone: { am: routineDone(today).some((d) => d.slot === 'am'), pm: routineDone(today).some((d) => d.slot === 'pm') },
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
  const { data: faceToday } = useTodayCheckin();
  const { data: skinDone = [] } = useRoutineDone();
  const faceDone = faceToday != null;
  const amDone = skinDone.some((d) => d.day === today && d.slot === 'am');
  const pmDone = skinDone.some((d) => d.day === today && d.slot === 'pm');

  const proteinG = Math.round(entries.reduce((s, e) => s + e.proteinG, 0));
  const meals = [...new Set(entries.map((e) => e.meal))].sort().join(',');
  const stepsToday = steps.find((d) => d.day === today)?.steps ?? (health?.enabled ? 0 : null);
  const workoutToday = workouts.some((w) => w.doneOn === today);
  const ready = !!profile;

  useEffect(() => {
    if (!profile) return;
    const targets = targetsForProfile(profile);
    const status: DayStatus = {
      now: new Date(),
      foodEntries: entries.length,
      mealsLogged: meals.split(',').filter(Boolean),
      proteinG,
      proteinTarget: targets.proteinG,
      waterMl: water,
      waterTarget: targets.waterMl,
      steps: stepsToday,
      stepGoal,
      workoutToday,
      faceCheckedIn: faceDone,
      skincareDone: { am: amDone, pm: pmDone },
      gentle: profile.hasEatingDisorderHistory,
    };
    syncSmartReminders(t, status, { proteinG: targets.proteinG, waterMl: targets.waterMl, steps: stepGoal, gentle: profile.hasEatingDisorderHistory }).catch(() => {
      /* reminders are best-effort; never break the screen */
    });
    // Recalculate only when the numbers that matter change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, today, entries.length, meals, proteinG, water, stepsToday, stepGoal, workoutToday, faceDone, amDone, pmDone]);
}
