import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppText } from '../components/AppText';
import { Header } from '../components/Header';
import { Mascot } from '../components/Mascot';
import { Button, Card, Chip, ProgressBar, Screen } from '../components/ui';
import { getSetting } from '../db/repositories';
import { buildTimeline, type TimelineStep } from '../features/agent/timeline';
import { useAiStatus, useCoachMessages } from '../features/coach/hooks';
import { openCoach } from '../features/coach/open';
import { useActionSummary } from '../features/coach/useActionSummary';
import { useFaceInsights, useFaceToday } from '../features/face/hooks';
import { useDiary } from '../features/food/hooks';
import { useHealthSettings, useStepGoal, useStepHistory } from '../features/health/hooks';
import { useProfile } from '../features/profile/hooks';
import { targetsForProfile } from '../features/profile/targets';
import { useWaterToday } from '../features/progress/hooks';
import { REMINDERS_KEY, withDefaults, type ReminderConfig } from '../features/reminders/schedule';
import { DEFAULT_SMART } from '../features/reminders/smart';
import { useWorkoutHistory } from '../features/workouts/hooks';
import { localDate } from '../lib/time';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';

const ICON: Record<TimelineStep['kind'], React.ComponentProps<typeof Ionicons>['name']> = {
  face: 'happy-outline',
  breakfast: 'cafe-outline',
  lunch: 'restaurant-outline',
  snack: 'nutrition-outline',
  workout: 'barbell-outline',
  dinner: 'restaurant-outline',
  bed: 'moon-outline',
  ai: 'sparkles',
};

/** Today's adaptive plan: a timeline that updates as you log and as the coach adjusts it. */
export default function TodayPlan() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const today = localDate();
  const { data: profile } = useProfile();
  const { data: entries = [] } = useDiary(today);
  const { data: water = 0 } = useWaterToday();
  const { data: health } = useHealthSettings();
  const { data: steps = [] } = useStepHistory(1);
  const stepGoal = useStepGoal(health);
  const { data: workouts = [] } = useWorkoutHistory(0);
  const face = useFaceToday();
  const { data: insights } = useFaceInsights();
  const { data: messages = [] } = useCoachMessages();
  const { data: ai } = useAiStatus();
  const summary = useActionSummary();

  const smart = useMemo(() => withDefaults(getSetting<Partial<ReminderConfig> | null>(REMINDERS_KEY, null)).smart ?? DEFAULT_SMART, []);
  const now = new Date();
  const logged = new Set(entries.map((e) => e.meal));
  const adjustments = messages
    .filter((m) => m.role === 'coach' && localDate(new Date(m.createdAt)) === today)
    .flatMap((m) => m.actions.filter((a) => a.status === 'done').map((a) => ({ at: new Date(m.createdAt), lines: summary(a.action).slice(0, 1) })));
  const meals = { ...DEFAULT_SMART.mealTimes, ...(smart.mealTimes ?? {}) };
  const steps0 = buildTimeline({
    now,
    times: {
      face: smart.faceTime ?? DEFAULT_SMART.faceTime!,
      breakfast: meals.breakfast,
      lunch: meals.lunch,
      snack: '17:00',
      workout: smart.workoutTime ?? DEFAULT_SMART.workoutTime!,
      dinner: meals.dinner,
      bed: smart.bedtimeTime ?? DEFAULT_SMART.bedtimeTime!,
    },
    done: {
      face: !!face,
      breakfast: logged.has('breakfast'),
      lunch: logged.has('lunch'),
      snack: logged.has('snack'),
      dinner: logged.has('dinner'),
      workout: workouts.some((w) => w.doneOn === today),
    },
    withFace: !!face || (insights?.checkins.length ?? 0) > 0 || !!smart.faceCheckIn,
    adjustments,
  });
  if (!profile) return null;
  const targets = targetsForProfile(profile);
  const stepsToday = steps.find((d) => d.day === today)?.steps ?? 0;
  const doneCount = steps0.filter((s) => s.kind !== 'ai' && s.kind !== 'bed' && s.status === 'done').length;
  const total = steps0.filter((s) => s.kind !== 'ai' && s.kind !== 'bed').length;

  return (
    <Screen testID="today-plan">
      <Header title={t('today.title')} />
      <Card tone="accent" testID="today-hero">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Mascot size={84} mood={doneCount === total ? 'cheer' : 'happy'} />
          <View style={{ flex: 1, gap: space.xs }}>
            <AppText variant="heading">{t('today.heroTitle')}</AppText>
            <AppText variant="label" tone="secondary" testID="today-progress">
              {t('today.progress', { done: doneCount, total })}
            </AppText>
            <ProgressBar value={total ? doneCount / total : 0} />
          </View>
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Card style={{ flex: 1, gap: space.xs }} testID="today-water">
          <AppText variant="caption" tone="secondary">
            {t('home.water')}
          </AppText>
          <AppText weight="bold">{t('water.glasses', { count: Math.round(water / 250), target: Math.round(targets.waterMl / 250) })}</AppText>
          <ProgressBar value={water / targets.waterMl} color={colors.info} />
        </Card>
        {health?.enabled || stepsToday > 0 ? (
          <Card style={{ flex: 1, gap: space.xs }} testID="today-steps">
            <AppText variant="caption" tone="secondary">
              {t('home.steps')}
            </AppText>
            <AppText weight="bold">{t('home.stepsOf', { steps: stepsToday.toLocaleString('en-IN'), goal: stepGoal.toLocaleString('en-IN') })}</AppText>
            <ProgressBar value={stepsToday / stepGoal} color={colors.success} />
          </Card>
        ) : null}
      </View>

      <View testID="timeline">
        {steps0.map((s, i) => (
          <TimelineRow key={s.key} step={s} last={i === steps0.length - 1} />
        ))}
      </View>

      {ai?.connected ? (
        <Button testID="today-adjust" label={t('today.adjust')} onPress={() => openCoach({ prefill: t('today.adjustPrompt') })} />
      ) : null}
      <AppText variant="caption" tone="muted">
        {t('today.note')}
      </AppText>
    </Screen>
  );
}

function TimelineRow({ step, last }: { step: TimelineStep; last: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const isAi = step.kind === 'ai';
  const nodeColor = step.status === 'done' ? (isAi ? colors.accent : colors.success) : step.status === 'next' ? colors.accent : colors.border;
  const chip =
    step.status === 'done'
      ? { label: t('today.status.done'), tone: 'success' as const }
      : step.status === 'next'
        ? { label: t('today.status.next'), tone: 'accent' as const }
        : step.status === 'open'
          ? { label: t('today.status.open'), tone: 'warning' as const }
          : null;
  const open = () => {
    if (step.kind === 'face') router.push('/wellness/checkin');
    else if (step.kind === 'workout') router.navigate('/workout');
    else if (['breakfast', 'lunch', 'snack', 'dinner'].includes(step.kind)) router.push({ pathname: '/food/add', params: { meal: step.kind, date: localDate() } });
  };
  const tappable = !isAi && step.kind !== 'bed' && step.status !== 'done';
  return (
    <View style={{ flexDirection: 'row', gap: space.md }} testID={`step-${step.key}`}>
      <View style={{ width: 48, alignItems: 'flex-end', paddingTop: space.md }}>
        <AppText variant="caption" tone={step.status === 'next' ? 'accent' : 'muted'} weight={step.status === 'next' ? 'bold' : undefined}>
          {step.time}
        </AppText>
      </View>
      <View style={{ alignItems: 'center', width: 20 }}>
        <View
          style={{
            marginTop: space.md,
            width: 16,
            height: 16,
            borderRadius: 8,
            borderWidth: 2,
            borderColor: nodeColor,
            backgroundColor: step.status === 'done' || step.status === 'next' ? nodeColor : 'transparent',
            ...(step.status === 'next' ? { shadowColor: colors.accent, shadowOpacity: 0.8, shadowRadius: 8, elevation: 6 } : null),
          }}
        />
        {!last ? <View style={{ flex: 1, width: 2, backgroundColor: colors.border, marginTop: 2 }} /> : null}
      </View>
      <View style={{ flex: 1, paddingBottom: space.md }}>
        <Card
          tone={isAi ? 'accent' : 'default'}
          style={{ padding: space.md, gap: space.xs, ...(step.status === 'next' ? { borderColor: colors.accent } : null) }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            {isAi ? <Mascot size={28} mood="thinking" /> : <Ionicons name={ICON[step.kind]} size={20} color={step.status === 'done' ? colors.success : colors.accent} />}
            <AppText weight="bold" style={{ flex: 1 }}>
              {isAi ? t('today.aiAdjusted') : t(`today.kind.${step.kind}`)}
            </AppText>
            {chip ? <Chip label={chip.label} tone={chip.tone} /> : null}
          </View>
          {isAi ? (
            (step.lines ?? []).map((l, i) => (
              <AppText key={i} variant="label" tone="secondary">
                {l}
              </AppText>
            ))
          ) : step.status === 'open' || step.status === 'next' ? (
            <AppText variant="label" tone="secondary">
              {t(`today.hint.${step.kind}`)}
            </AppText>
          ) : null}
          {tappable ? (
            <AppText variant="label" tone="accent" onPress={open} accessibilityRole="button" testID={`step-${step.key}-open`}>
              {step.kind === 'face' ? t('today.checkIn') : step.kind === 'workout' ? t('today.startWorkout') : t('today.logMeal')}
            </AppText>
          ) : null}
        </Card>
      </View>
    </View>
  );
}
