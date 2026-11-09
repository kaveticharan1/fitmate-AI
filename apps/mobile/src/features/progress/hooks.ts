import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addWater, dailyFoodTotals, logWaist, undoWater, waistHistory, waterToday, weightHistory } from '../../db/progressRepo';
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
