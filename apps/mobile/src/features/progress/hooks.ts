import { addHabit, deleteHabit, listHabits, logSleep, setHabitDone, sleepHistory } from '../../db/habitsRepo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addWater, dailyFoodTotals, dailyWater, logWaist, undoWater, waistHistory, waterToday, weightHistory } from '../../db/progressRepo';
import { addDays, localDate } from '../../lib/time';

export const progressKeys = {
  weights: (days: number) => ['progress', 'weights', days] as const,
  waist: (days: number) => ['progress', 'waist', days] as const,
  food: ['progress', 'food'] as const,
  water: (day: string) => ['water', day] as const,
};

export const useWeightHistory = (days: number) =>
  useQuery({ queryKey: progressKeys.weights(days), queryFn: () => weightHistory(addDays(localDate(), -days)) });

export const useWaistHistory = (days: number) =>
  useQuery({ queryKey: progressKeys.waist(days), queryFn: () => waistHistory(addDays(localDate(), -days)) });

/** Food totals for the last 7 days (today included). */
export const useWeekFood = () => useQuery({ queryKey: progressKeys.food, queryFn: () => dailyFoodTotals(addDays(localDate(), -6)) });

export const useWaterToday = () => useQuery({ queryKey: progressKeys.water(localDate()), queryFn: () => waterToday() });

export function useWaterActions() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ['water'] });
  return {
    add: useMutation({ mutationFn: async (ml: number) => addWater(ml), onSuccess: done }),
    undo: useMutation({ mutationFn: async () => undoWater(), onSuccess: done }),
  };
}

export function useLogWaist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cm: number) => logWaist(cm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['progress'] });
      qc.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

// ── Sleep and habits (Phase 5 part 2) ──────────────────────────────────────

export const useSleepHistory = (days: number) =>
  useQuery({ queryKey: ['progress', 'sleep', days], queryFn: () => sleepHistory(addDays(localDate(), -days)) });

export function useLogSleep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { bed: string; wake: string }) => logSleep(v.bed, v.wake),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['progress'] }),
  });
}

/** Habits with the days they were done in the last 60 days (enough for streaks and monthly reports). */
export const useHabits = () => useQuery({ queryKey: ['progress', 'habits'], queryFn: () => listHabits(addDays(localDate(), -60)) });

export function useHabitActions() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ['progress', 'habits'] });
  return {
    add: useMutation({ mutationFn: async (name: string) => addHabit(name), onSuccess: done }),
    remove: useMutation({ mutationFn: async (id: string) => deleteHabit(id), onSuccess: done }),
    toggle: useMutation({ mutationFn: async (v: { id: string; done: boolean }) => setHabitDone(v.id, v.done), onSuccess: done }),
  };
}

export const useWaterHistory = (days: number) =>
  useQuery({ queryKey: ['progress', 'water', days], queryFn: () => dailyWater(addDays(localDate(), -days + 1)) });

export const useFoodHistory = (days: number) =>
  useQuery({ queryKey: ['progress', 'foodHistory', days], queryFn: () => dailyFoodTotals(addDays(localDate(), -days + 1)) });
