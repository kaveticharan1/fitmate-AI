import { suggestFor } from '@fitmate/workouts';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { SummaryRow, type ChipTone } from '../../components/ui';
import { localDate } from '../../lib/time';
import { space } from '../../theme/tokens';
import { useFaceToday } from '../face/hooks';
import { useDiary } from '../food/hooks';
import { useHealthSettings, useStepGoal, useStepHistory } from '../health/hooks';
import { useProfile } from '../profile/hooks';
import { targetsForProfile } from '../profile/targets';
import { useWaterToday } from '../progress/hooks';
import { usePersonalisation, useWorkoutHistory, useWorkoutText } from '../workouts/hooks';

export type Progress = 'done' | 'progress' | 'todo' | 'over';
const TONE: Record<Progress, ChipTone> = { done: 'accent', progress: 'neutral', todo: 'neutral', over: 'warning' };

/** Calories: on target within ±10%, "over" above that. */
export function kcalProgress(kcal: number, target: number): Progress {
  if (kcal <= 0) return 'todo';
  if (kcal > target * 1.1) return 'over';
  return kcal >= target * 0.9 ? 'done' : 'progress';
}

/** done at ≥ 100%, in progress above 0, otherwise to do. */
export function progressOf(value: number, target: number): Progress {
  if (target > 0 && value >= target) return 'done';
  return value > 0 ? 'progress' : 'todo';
}

/** Home: today at a glance — each row opens the place to act on it. */
export function DailySummary() {
  const { t } = useTranslation();
  const today = localDate();
  const { data: profile } = useProfile();
  const { data: entries = [] } = useDiary(today);
  const { data: water = 0 } = useWaterToday();
  const { data: health } = useHealthSettings();
  const { data: steps = [] } = useStepHistory(1);
  const stepGoal = useStepGoal(health);
  const { data: workouts = [] } = useWorkoutHistory(0);
  const me = usePersonalisation();
  const { workoutName } = useWorkoutText();
  const face = useFaceToday();
  if (!profile) return null;

  const targets = targetsForProfile(profile);
  const gentle = profile.hasEatingDisorderHistory;
  const kcal = Math.round(entries.reduce((s, e) => s + e.kcal, 0));
  const protein = Math.round(entries.reduce((s, e) => s + e.proteinG, 0));
  const meals = new Set(entries.map((e) => e.meal)).size;
  const chip = (p: Progress) => ({ label: t(`home.status.${p}`), tone: TONE[p] });
  const stepsToday = steps.find((d) => d.day === today)?.steps ?? 0;
  const workoutDone = workouts.some((w) => w.doneOn === today);
  const plan = me ? suggestFor(today, me.p, me.level) : null;
  const glasses = Math.round(water / 250);

  return (
    <View style={{ gap: space.sm }} testID="daily-summary">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <AppText variant="heading">{t('home.summaryTitle')}</AppText>
        <Pressable testID="summary-all" accessibilityRole="button" hitSlop={12} onPress={() => router.navigate('/progress')}>
          <AppText variant="label" tone="accent">
            {t('home.viewAll')}
          </AppText>
        </Pressable>
      </View>
      <SummaryRow
        testID="sum-food"
        icon="restaurant-outline"
        title={t('home.food')}
        subtitle={gentle ? t('home.mealsLogged', { count: meals }) : t('home.kcalOf', { kcal: kcal.toLocaleString('en-IN'), target: targets.targetKcal.toLocaleString('en-IN') })}
        chip={chip(gentle ? (entries.length ? 'done' : 'todo') : kcalProgress(kcal, targets.targetKcal))}
        onPress={() => router.navigate('/food')}
      />
      {!gentle ? (
        <SummaryRow
          testID="sum-protein"
          tone="warning"
          icon="egg-outline"
          title={t('home.protein')}
          subtitle={t('home.gramsOf', { g: protein, target: targets.proteinG })}
          chip={chip(progressOf(protein, targets.proteinG))}
          onPress={() => router.navigate('/food')}
        />
      ) : null}
      <SummaryRow
        testID="sum-water"
          tone="info"
        icon="water-outline"
        title={t('home.water')}
        subtitle={t('water.glasses', { count: glasses, target: Math.round(targets.waterMl / 250) })}
        chip={chip(progressOf(water, targets.waterMl))}
      />
      <SummaryRow
        testID="sum-workout"
        icon="barbell-outline"
        title={t('home.workout')}
        subtitle={workoutDone ? t('home.workoutDone') : plan ? workoutName(plan) : t('home.workoutRest')}
        chip={chip(workoutDone ? 'done' : 'todo')}
        onPress={() => router.navigate('/workout')}
      />
      {health?.enabled || stepsToday > 0 ? (
        <SummaryRow
          testID="sum-steps"
          tone="success"
          icon="walk-outline"
          title={t('home.steps')}
          subtitle={t('home.stepsOf', { steps: stepsToday.toLocaleString('en-IN'), goal: stepGoal.toLocaleString('en-IN') })}
          chip={chip(progressOf(stepsToday, stepGoal))}
        />
      ) : null}
      <SummaryRow
        testID="sum-face"
          tone="info"
        icon="happy-outline"
        title={t('home.face')}
        subtitle={face ? t('home.faceDone') : t('home.faceTodo')}
        chip={chip(face ? 'done' : 'todo')}
        onPress={() => router.push(face ? '/wellness' : '/wellness/checkin')}
      />
    </View>
  );
}
