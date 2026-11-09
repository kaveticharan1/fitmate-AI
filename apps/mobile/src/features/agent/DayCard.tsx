import { suggestFor } from '@fitmate/workouts';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button, Card, IconTile } from '../../components/ui';
import { localDate } from '../../lib/time';
import { space } from '../../theme/tokens';
import { useAiStatus } from '../coach/hooks';
import { openCoach } from '../coach/open';
import { useFaceToday } from '../face/hooks';
import { useDiary } from '../food/hooks';
import { useHealthSettings, useStepGoal, useStepHistory } from '../health/hooks';
import { useProfile } from '../profile/hooks';
import { targetsForProfile } from '../profile/targets';
import { useSleepHistory, useWaterToday } from '../progress/hooks';
import { usePersonalisation, useWorkoutHistory, useWorkoutText } from '../workouts/hooks';
import { dayCardFor, eveningReview, type DayFacts } from './daySummary';

/** Morning: today's plan. From 5 pm: a friendly review of the day. */
export function DayCard() {
  const { t } = useTranslation();
  const [now] = useState(() => new Date());
  const today = localDate(now);
  const mode = dayCardFor(now);
  const { data: profile } = useProfile();
  const { data: entries = [] } = useDiary(today);
  const { data: water = 0 } = useWaterToday();
  const { data: health } = useHealthSettings();
  const { data: steps = [] } = useStepHistory(1);
  const stepGoal = useStepGoal(health);
  const { data: workouts = [] } = useWorkoutHistory(0);
  const { data: sleep = [] } = useSleepHistory(1);
  const { data: ai } = useAiStatus();
  const me = usePersonalisation();
  const { workoutName } = useWorkoutText();
  const face = useFaceToday();

  if (mode === 'none' || !profile) return null;
  const targets = targetsForProfile(profile);
  const gentle = profile.hasEatingDisorderHistory;
  const sleepMin = sleep.find((s) => s.wokeOn === today)?.minutes ?? null;
  const askCoach = (prefill: string) => openCoach({ prefill });

  if (mode === 'briefing') {
    const w = me ? suggestFor(today, me.p, me.level) : null;
    return (
      <Card testID="briefing-card">
        <CardTitle icon="sunny-outline" title={t('agent.briefingTitle')} />
        {sleepMin != null ? <AppText tone="secondary">{t('agent.sleptFor', { h: Math.floor(sleepMin / 60), m: sleepMin % 60 })}</AppText> : null}
        <AppText>
          {gentle
            ? t('agent.targetsGentle', { water: (targets.waterMl / 1000).toFixed(1), steps: stepGoal.toLocaleString('en-IN') })
            : t('agent.targets', { protein: targets.proteinG, kcal: targets.targetKcal, water: (targets.waterMl / 1000).toFixed(1), steps: stepGoal.toLocaleString('en-IN') })}
        </AppText>
        {w ? <AppText>{t('agent.todayWorkout', { name: workoutName(w) })}</AppText> : null}
        {ai?.connected ? <Button testID="briefing-coach" variant="secondary" label={t('agent.planWithCoach')} onPress={() => askCoach(t('agent.planPrompt'))} /> : null}
      </Card>
    );
  }

  const facts: DayFacts = {
    kcal: Math.round(entries.reduce((s, e) => s + e.kcal, 0)),
    kcalTarget: targets.targetKcal,
    proteinG: Math.round(entries.reduce((s, e) => s + e.proteinG, 0)),
    proteinTarget: targets.proteinG,
    foodEntries: entries.length,
    waterMl: water,
    waterTarget: targets.waterMl,
    steps: steps.find((d) => d.day === today)?.steps ?? (health?.enabled ? 0 : null),
    stepGoal,
    workoutDone: workouts.some((w) => w.doneOn === today),
    sleepMin,
    faceCheckedIn: face,
    gentle,
  };
  const review = eveningReview(facts);
  return (
    <Card testID="review-card">
      <CardTitle icon="moon-outline" title={t('agent.reviewTitle')} />
      {review.wins.length ? (
        <View style={{ gap: space.xs }}>
          {review.wins.map((w) => (
            <AppText key={w}>{`✓ ${t(`agent.win.${w}`)}`}</AppText>
          ))}
        </View>
      ) : (
        <AppText tone="secondary">{t('agent.noWinsYet')}</AppText>
      )}
      {review.next.length ? (
        <View style={{ gap: space.xs }}>
          <AppText variant="label" tone="secondary">
            {t('agent.tomorrow')}
          </AppText>
          {review.next.map((n) => (
            <AppText key={n} tone="secondary">{`• ${t(`agent.next.${n}`)}`}</AppText>
          ))}
        </View>
      ) : null}
      {ai?.connected ? <Button testID="review-coach" variant="secondary" label={t('agent.reviewWithCoach')} onPress={() => askCoach(t('agent.reviewPrompt'))} /> : null}
    </Card>
  );
}

function CardTitle({ icon, title }: { icon: React.ComponentProps<typeof IconTile>['name']; title: string }) {
  const { t } = useTranslation();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <IconTile name={icon} size={40} />
      <View style={{ flex: 1 }}>
        <AppText variant="heading">{title}</AppText>
        <AppText variant="caption" tone="secondary">
          {t('agent.byCoach')}
        </AppText>
      </View>
    </View>
  );
}
