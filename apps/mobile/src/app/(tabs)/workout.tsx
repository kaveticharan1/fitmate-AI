import { canDo, estimateMinutes, personalise, suggestFor, WORKOUTS, type Workout } from '@fitmate/workouts';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button, Card, ChoiceGroup, ListGroup, ListRow, Screen } from '../../components/ui';
import { useActiveWorkout } from '../../features/workouts/activeSession';
import { usePersonalisation, useWorkoutHistory, useWorkoutText } from '../../features/workouts/hooks';
import { addDays, localDate } from '../../lib/time';
import { space } from '../../theme/tokens';

type Filter = 'all' | Workout['kind'];
const FILTERS: Filter[] = ['all', 'home', 'gym', 'walking', 'stretch'];

export default function WorkoutTab() {
  const { t } = useTranslation();
  const me = usePersonalisation();
  const { workoutName } = useWorkoutText();
  const active = useActiveWorkout();
  const { data: history = [] } = useWorkoutHistory(30);
  const [filter, setFilter] = useState<Filter>('all');
  const today = localDate();

  if (!me) return <Screen testID="workout">{null}</Screen>;

  const suggestion = suggestFor(today, me.p, me.level);
  const available = WORKOUTS.filter((w) => canDo(w, me.p) && (filter === 'all' || w.kind === filter));
  const weekStart = addDays(today, -6);
  const thisWeek = history.filter((h) => h.doneOn >= weekStart);
  const weekMinutes = Math.round(thisWeek.reduce((n, h) => n + h.durationS, 0) / 60);
  const doneToday = history.some((h) => h.doneOn === today);
  const open = (id: string) => router.push({ pathname: '/workout/detail', params: { id } });

  return (
    <Screen testID="workout">
      <View style={{ gap: space.xs, paddingTop: space.sm }}>
        <AppText variant="title">{t('workouts.title')}</AppText>
        <AppText variant="caption" tone="secondary">
          {t('workouts.safetyNote')}
        </AppText>
      </View>

      {active && active.state.phase !== 'done' ? (
        <Card tone="accent" testID="resume-card">
          <AppText variant="heading">{t('workouts.inProgress', { name: workoutName(active.workout) })}</AppText>
          <Button testID="resume-workout" label={t('workouts.resume')} onPress={() => router.push('/workout/session')} />
        </Card>
      ) : null}

      {suggestion ? (
        <Card testID="today-workout">
          <AppText variant="label" tone="secondary">
            {doneToday ? t('workouts.doneToday') : t('workouts.today')}
          </AppText>
          <AppText variant="heading">{workoutName(suggestion)}</AppText>
          <AppText tone="secondary">
            {t('workouts.minutesAbout', { count: estimateMinutes(personalise(suggestion, me.p).workout) })}
          </AppText>
          <Button testID="open-today" label={t('workouts.view')} onPress={() => open(suggestion.id)} />
        </Card>
      ) : null}

      <Card testID="week-summary">
        <AppText variant="heading">{t('workouts.thisWeek')}</AppText>
        <AppText testID="week-count">{t('workouts.weekCount', { count: thisWeek.length, minutes: weekMinutes })}</AppText>
        <AppText variant="caption" tone="secondary">
          {t('workouts.weekGoal')}
        </AppText>
      </Card>

      <View style={{ gap: space.sm }}>
        <AppText variant="heading">{t('workouts.all')}</AppText>
        <ChoiceGroup
          testID="workout-filter"
          options={FILTERS.map((f) => ({ value: f, label: t(`workouts.kind.${f}`) }))}
          value={filter}
          onChange={setFilter}
        />
        <ListGroup>
          {available.map((w) => (
            <ListRow
              key={w.id}
              testID={`workout-${w.id}`}
              label={workoutName(w)}
              value={t('workouts.minutesShort', { count: estimateMinutes(personalise(w, me.p).workout) })}
              onPress={() => open(w.id)}
            />
          ))}
        </ListGroup>
        {available.length === 0 ? <AppText tone="secondary">{t('workouts.noneForFilter')}</AppText> : null}
      </View>

      <View style={{ gap: space.sm }}>
        <AppText variant="heading">{t('workouts.history')}</AppText>
        {history.length === 0 ? (
          <AppText tone="secondary">{t('workouts.noHistory')}</AppText>
        ) : (
          <ListGroup>
            {history.slice(0, 10).map((h) => {
              const w = WORKOUTS.find((x) => x.id === h.workoutId);
              return (
                <ListRow
                  key={h.id}
                  testID={`history-${h.id}`}
                  label={`${h.doneOn.slice(8)}/${h.doneOn.slice(5, 7)} · ${w ? workoutName(w) : h.workoutId}`}
                  value={t('workouts.historyValue', { minutes: Math.max(1, Math.round(h.durationS / 60)), kcal: h.estKcal })}
                  onPress={() => (w ? open(w.id) : undefined)}
                />
              );
            })}
          </ListGroup>
        )}
      </View>
    </Screen>
  );
}
