import { getExercise, restSecondsLeft, sessionReducer, totalSets, type SessionAction, exerciseText } from '@fitmate/workouts';
import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Header } from '../../components/Header';
import { Button, Card, ProgressBar, Screen, ToggleRow } from '../../components/ui';
import { getActiveWorkout, setActiveWorkout, useActiveWorkout } from '../../features/workouts/activeSession';
import { useSaveWorkout, useSetVoiceCues, useVoiceCues, useWorkoutText } from '../../features/workouts/hooks';
import { space } from '../../theme/tokens';

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

export default function WorkoutSession() {
  useKeepAwake('workout');
  const { t, i18n } = useTranslation();
  const active = useActiveWorkout();
  const { workoutName, exerciseName, amount } = useWorkoutText();
  const { data: voiceOn = false } = useVoiceCues();
  const setVoice = useSetVoiceCues();
  const save = useSaveWorkout();
  const [now, setNow] = useState(() => Date.now());
  /** End time of a timed exercise's countdown (component state; restarts if you leave the screen). */
  const [workEndsAt, setWorkEndsAt] = useState<number | null>(null);
  const savedFor = useRef<number | null>(null);
  const spokenKey = useRef('');

  const state = active?.state;
  const step = active && state && state.phase !== 'done' ? active.workout.steps[state.stepIndex] : undefined;
  const ex = step ? getExercise(step.exerciseId) : undefined;
  const restLeft = state ? restSecondsLeft(state, now) : 0;
  const workLeft = workEndsAt == null ? null : Math.max(0, Math.ceil((workEndsAt - now) / 1000));

  const dispatch = (a: SessionAction) => {
    const cur = getActiveWorkout();
    if (!cur) return;
    setWorkEndsAt(null);
    setNow(Date.now());
    setActiveWorkout({ ...cur, state: sessionReducer(cur.workout, cur.state, a) });
  };

  // Clock tick while a countdown is running; a countdown reaching zero moves the workout on.
  const ticking = state?.phase === 'rest' || workEndsAt != null;
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => {
      const t0 = Date.now();
      setNow(t0);
      const cur = getActiveWorkout();
      if (!cur) return;
      if (cur.state.phase === 'rest' && restSecondsLeft(cur.state, t0) === 0) dispatch({ type: 'endRest' });
      else if (cur.state.phase === 'work' && workEndsAt != null && t0 >= workEndsAt) dispatch({ type: 'completeSet', now: t0 });
    }, 250);
    return () => clearInterval(id);
  }, [ticking, workEndsAt]);

  // Optional spoken cues.
  useEffect(() => {
    if (!voiceOn || !state || !active) return;
    const key = `${state.phase}-${state.stepIndex}-${state.set}`;
    if (key === spokenKey.current) return;
    spokenKey.current = key;
    let text = '';
    if (state.phase === 'done') text = t('workouts.voice.done');
    else if (state.phase === 'rest') text = t('workouts.voice.rest', { seconds: restSecondsLeft(state, Date.now()) });
    else if (step && ex) text = t('workouts.voice.next', { name: exerciseName(ex), amount: amount(ex.id, step.amount), set: state.set, sets: step.sets });
    if (text) {
      Speech.stop();
      Speech.speak(text, { language: i18n.language === 'te' ? 'te-IN' : 'en-IN' });
    }
  }, [voiceOn, state, active, step, ex, t, i18n.language, exerciseName, amount]);

  useEffect(() => () => void Speech.stop(), []);

  // Save once when the workout ends.
  useEffect(() => {
    if (!active || active.state.phase !== 'done' || savedFor.current === active.state.startedAt) return;
    savedFor.current = active.state.startedAt;
    if (active.state.completedSets === 0) return;
    const total = totalSets(active.workout);
    save.mutate({
      workoutId: active.workout.id,
      startedAt: active.state.startedAt,
      finishedAt: Date.now(),
      completedSets: active.state.completedSets,
      totalSets: total,
      estKcal: (active.estKcal * active.state.completedSets) / Math.max(1, total),
      exerciseIds: active.workout.steps.filter((_, i) => !active.state.skippedSteps.includes(i)).map((s) => s.exerciseId),
    });
  }, [active, save]);

  const close = () => {
    setActiveWorkout(null);
    if (router.canGoBack()) router.back();
  };

  if (!active || !state) {
    return (
      <Screen testID="workout-session">
        <Header title={t('workouts.title')} />
        <AppText tone="secondary">{t('workouts.noActive')}</AppText>
      </Screen>
    );
  }

  const total = totalSets(active.workout);

  if (state.phase === 'done') {
    const minutes = Math.max(1, Math.round((now - state.startedAt) / 60000));
    return (
      <Screen testID="workout-session" footer={<Button testID="close-workout" label={t('workouts.close')} onPress={close} />}>
        <Header title={workoutName(active.workout)} />
        <Card tone="accent" testID="workout-done">
          <AppText variant="title">{state.completedSets > 0 ? t('workouts.wellDone') : t('workouts.endedEarly')}</AppText>
          <AppText>{t('workouts.summary', { sets: state.completedSets, total, minutes })}</AppText>
          {state.completedSets > 0 ? (
            <AppText tone="secondary">
              {t('workouts.summaryKcal', { kcal: Math.round((active.estKcal * state.completedSets) / Math.max(1, total)) })}
            </AppText>
          ) : (
            <AppText tone="secondary">{t('workouts.notSaved')}</AppText>
          )}
        </Card>
      </Screen>
    );
  }

  const swapEasier = () => {
    if (!ex?.easier || !step) return;
    const cur = getActiveWorkout()!;
    const steps = cur.workout.steps.map((s, i) => (i === cur.state.stepIndex ? { ...s, exerciseId: ex.easier! } : s));
    setWorkEndsAt(null);
    setActiveWorkout({ ...cur, workout: { ...cur.workout, steps } });
  };

  const next = active.workout.steps[state.stepIndex + 1];

  return (
    <Screen testID="workout-session">
      <Header title={workoutName(active.workout)} />
      <ProgressBar testID="workout-progress" value={state.completedSets / Math.max(1, total)} />
      <AppText variant="caption" tone="secondary">
        {t('workouts.exerciseOf', { n: state.stepIndex + 1, total: active.workout.steps.length })}
      </AppText>

      {state.phase === 'rest' ? (
        <Card testID="rest-card" style={{ alignItems: 'center' }}>
          <AppText variant="label" tone="secondary">
            {t('workouts.rest')}
          </AppText>
          <AppText variant="display" testID="rest-timer">
            {clock(restLeft)}
          </AppText>
          {step && state.set < step.sets ? (
            <AppText tone="secondary">{t('workouts.upNextSet', { set: state.set + 1, sets: step.sets })}</AppText>
          ) : next ? (
            <AppText tone="secondary">{t('workouts.upNext', { name: exerciseName(next.exerciseId) })}</AppText>
          ) : null}
          <Button testID="skip-rest" variant="secondary" label={t('workouts.skipRest')} onPress={() => dispatch({ type: 'endRest' })} />
        </Card>
      ) : step && ex ? (
        <Card testID="work-card">
          <AppText variant="label" tone="secondary">
            {t('workouts.setOf', { set: state.set, sets: step.sets })}
          </AppText>
          <AppText variant="title" testID="current-exercise">
            {exerciseName(ex)}
          </AppText>
          <AppText variant="heading" tone="accent" testID="current-amount">
            {workLeft != null ? clock(workLeft) : amount(ex.id, step.amount)}
          </AppText>
          <View style={{ gap: space.xs }}>
            {exerciseText(ex, i18n.language).steps.map((line, n) => (
              <AppText key={n} tone="secondary">{`${n + 1}. ${line}`}</AppText>
            ))}
            <AppText tone="warning">{`⚠ ${exerciseText(ex, i18n.language).safety}`}</AppText>
          </View>
          {ex.mode === 'time' && workLeft == null ? (
            <Button testID="start-timer" label={t('workouts.startTimer')} onPress={() => {
                const t0 = Date.now();
                setNow(t0);
                setWorkEndsAt(t0 + step.amount * 1000);
              }} />
          ) : null}
          <Button
            testID="complete-set"
            variant={ex.mode === 'time' && workLeft == null ? 'secondary' : 'primary'}
            label={t('workouts.setDone')}
            onPress={() => dispatch({ type: 'completeSet', now: Date.now() })}
          />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {ex.easier ? (
              <View style={{ flex: 1 }}>
                <Button testID="easier" variant="ghost" label={t('workouts.easier')} onPress={swapEasier} />
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <Button testID="skip-exercise" variant="ghost" label={t('workouts.skipExercise')} onPress={() => dispatch({ type: 'skipStep' })} />
            </View>
          </View>
        </Card>
      ) : null}

      <ToggleRow
        testID="voice-toggle"
        label={t('workouts.voiceCues')}
        description={t('workouts.voiceCuesHint')}
        value={voiceOn}
        onChange={(v) => setVoice.mutate(v)}
      />
      <Button testID="finish-early" variant="danger" label={t('workouts.finish')} onPress={() => dispatch({ type: 'finish' })} />
      <AppText variant="caption" tone="secondary">
        {t('workouts.stopIfPain')}
      </AppText>
    </Screen>
  );
}
