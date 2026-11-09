import { getExercise, type Exercise, type Personalisation, type Workout } from '@fitmate/workouts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getSetting, setSetting } from '../../db/repositories';
import { saveWorkoutSession, workoutHistory, type FinishedWorkout } from '../../db/workoutRepo';
import { addDays, localDate } from '../../lib/time';
import { useProfile } from '../profile/hooks';

export const workoutKeys = {
  history: (days: number) => ['workouts', 'history', days] as const,
  voice: ['workouts', 'voice'] as const,
};

export const useWorkoutHistory = (days: number) =>
  useQuery({ queryKey: workoutKeys.history(days), queryFn: () => workoutHistory(addDays(localDate(), -days)) });

export function useSaveWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (w: FinishedWorkout) => saveWorkoutSession(w),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workouts'] }),
  });
}

export const useVoiceCues = () => useQuery({ queryKey: workoutKeys.voice, queryFn: () => getSetting<boolean>('workoutVoice', false) });

export function useSetVoiceCues() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (on: boolean) => setSetting('workoutVoice', on),
    onSuccess: () => qc.invalidateQueries({ queryKey: workoutKeys.voice }),
  });
}

export function levelFromActivity(activity: string | undefined): 1 | 2 | 3 {
  if (activity === 'very_active') return 3;
  if (activity === 'moderate') return 2;
  return 1;
}

/** What the workout logic needs to know about the user. */
export function usePersonalisation(): { p: Personalisation; level: 1 | 2 | 3; weightKg: number } | null {
  const { data: profile } = useProfile();
  if (!profile) return null;
  return {
    p: { equipment: profile.equipment ?? [], workoutPreference: profile.workoutPreference as Personalisation['workoutPreference'], injuries: profile.injuries ?? null },
    level: levelFromActivity(profile.activityLevel),
    weightKg: profile.weightKg,
  };
}

/** Names in the app language. */
export function useWorkoutText() {
  const { t, i18n } = useTranslation();
  const te = i18n.language === 'te';
  const workoutName = (w: Workout) => (te ? w.nameTe : w.name);
  const exerciseName = (e: Exercise | string) => {
    const ex = typeof e === 'string' ? getExercise(e) : e;
    return ex ? (te ? ex.nameTe : ex.name) : String(e);
  };
  const amount = (exerciseId: string, value: number) => {
    const ex = getExercise(exerciseId);
    if (ex?.mode !== 'time') return t('workouts.reps', { count: value });
    return value >= 120 && value % 60 === 0 ? t('workouts.minutes', { count: value / 60 }) : t('workouts.seconds', { count: value });
  };
  return { workoutName, exerciseName, amount };
}
