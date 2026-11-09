import { estimateKcal, estimateMinutes, getExercise, getWorkout, personalise, totalSets, exerciseText } from '@fitmate/workouts';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Header } from '../../components/Header';
import { Banner, Button, Card, Screen } from '../../components/ui';
import { beginWorkout } from '../../features/workouts/activeSession';
import { usePersonalisation, useWorkoutText } from '../../features/workouts/hooks';
import { space } from '../../theme/tokens';

export default function WorkoutDetail() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = usePersonalisation();
  const { workoutName, exerciseName, amount } = useWorkoutText();
  const [openStep, setOpenStep] = useState<number | null>(null);
  const base = id ? getWorkout(id) : undefined;

  if (!base || !me) {
    return (
      <Screen testID="workout-detail">
        <Header title={t('workouts.title')} />
        <AppText tone="secondary">{t('workouts.notFound')}</AppText>
      </Screen>
    );
  }

  const { workout, swapped } = personalise(base, me.p);
  const kcal = estimateKcal(workout, me.weightKg);

  const start = () => {
    beginWorkout(workout, kcal);
    router.push('/workout/session');
  };

  return (
    <Screen
      testID="workout-detail"
      footer={<Button testID="start-workout" label={t('workouts.start')} onPress={start} />}
    >
      <Header title={workoutName(workout)} />
      <AppText tone="secondary" testID="workout-meta">
        {t('workouts.meta', { minutes: estimateMinutes(workout), sets: totalSets(workout), kcal })}
      </AppText>
      {swapped.length > 0 ? <Banner tone="accent" text={t('workouts.swappedForInjury', { count: swapped.length })} /> : null}

      {workout.steps.map((s, i) => {
        const ex = getExercise(s.exerciseId)!;
        const expanded = openStep === i;
        return (
          <Card key={`${s.exerciseId}-${i}`} testID={`step-${i}`}>
            <Pressable accessibilityRole="button" onPress={() => setOpenStep(expanded ? null : i)} style={{ gap: space.xs }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
                <AppText variant="heading" style={{ flex: 1 }}>
                  {exerciseName(ex)}
                </AppText>
                <AppText tone="secondary">
                  {s.sets > 1 ? `${s.sets} × ` : ''}
                  {amount(ex.id, s.amount)}
                </AppText>
              </View>
              <AppText variant="caption" tone="accent">
                {expanded ? t('workouts.hideHow') : t('workouts.showHow')}
              </AppText>
            </Pressable>
            {expanded ? (
              <View style={{ gap: space.xs }}>
                {exerciseText(ex, i18n.language).steps.map((line, n) => (
                  <AppText key={n}>{`${n + 1}. ${line}`}</AppText>
                ))}
                <AppText tone="warning">{`⚠ ${exerciseText(ex, i18n.language).safety}`}</AppText>
              </View>
            ) : null}
          </Card>
        );
      })}
      <AppText variant="caption" tone="secondary">
        {t('workouts.kcalNote')}
      </AppText>
    </Screen>
  );
}
