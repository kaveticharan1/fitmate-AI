import { planDay, planWeek, type DayPlan, type DietType, type PlannedMeal } from '@fitmate/food-data';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  addFoodEntry,
  addRecipeEntry,
  copyMeal,
  deleteEntry,
  deleteRecipe,
  favouriteIds,
  listEntries,
  listRecipes,
  logPlannedMeal,
  planChoices,
  recentFoodIds,
  saveRecipe,
  setFavourite,
  swapPlannedMeal,
  updateFoodEntry,
  type FoodEntryInput,
  type RecipeSave,
} from '../../db/foodRepo';
import type { Meal } from '../../db/schema';
import { useProfile } from '../profile/hooks';
import { targetsForProfile } from '../profile/targets';

export const foodKeys = {
  diary: (date: string) => ['diary', date] as const,
  recent: ['recentFoods'] as const,
  favourites: ['favouriteFoods'] as const,
  recipes: ['recipes'] as const,
  plan: (date: string) => ['planChoices', date] as const,
};

export const useDiary = (date: string) => useQuery({ queryKey: foodKeys.diary(date), queryFn: () => listEntries(date) });
export const useRecentFoods = () => useQuery({ queryKey: foodKeys.recent, queryFn: () => recentFoodIds() });
export const useFavourites = () => useQuery({ queryKey: foodKeys.favourites, queryFn: () => favouriteIds() });
export const useRecipes = () => useQuery({ queryKey: foodKeys.recipes, queryFn: () => listRecipes() });
export const usePlanChoices = (date: string) => useQuery({ queryKey: foodKeys.plan(date), queryFn: () => planChoices(date) });

function useInvalidateFood() {
  const qc = useQueryClient();
  return (date?: string) => {
    if (date) qc.invalidateQueries({ queryKey: foodKeys.diary(date) });
    else qc.invalidateQueries({ queryKey: ['diary'] });
    qc.invalidateQueries({ queryKey: foodKeys.recent });
  };
}

export function useAddFood() {
  const invalidate = useInvalidateFood();
  return useMutation({
    mutationFn: async (input: FoodEntryInput) => addFoodEntry(input),
    onSuccess: (_id, input) => invalidate(input.date),
  });
}

export function useUpdateFood() {
  const invalidate = useInvalidateFood();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Omit<FoodEntryInput, 'date' | 'source'> }) => updateFoodEntry(id, patch),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteEntry() {
  const invalidate = useInvalidateFood();
  return useMutation({ mutationFn: async (id: string) => deleteEntry(id), onSuccess: () => invalidate() });
}

export function useCopyMeal() {
  const invalidate = useInvalidateFood();
  return useMutation({
    mutationFn: async (v: { from: string; to: string; meal: Meal }) => copyMeal(v.from, v.to, v.meal),
    onSuccess: (_n, v) => invalidate(v.to),
  });
}

export function useToggleFavourite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { foodId: string; on: boolean }) => setFavourite(v.foodId, v.on),
    onSuccess: () => qc.invalidateQueries({ queryKey: foodKeys.favourites }),
  });
}

export function useSaveRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { input: RecipeSave; id?: string }) => saveRecipe(v.input, v.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: foodKeys.recipes }),
  });
}

export function useDeleteRecipe() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (id: string) => deleteRecipe(id), onSuccess: () => qc.invalidateQueries({ queryKey: foodKeys.recipes }) });
}

export function useAddRecipeEntry() {
  const invalidate = useInvalidateFood();
  return useMutation({
    mutationFn: async (v: Parameters<typeof addRecipeEntry>[0]) => addRecipeEntry(v),
    onSuccess: (_id, v) => invalidate(v.date),
  });
}

/** Daily targets from the profile (null until loaded). */
export function useTargets() {
  const { data: profile } = useProfile();
  return useMemo(() => (profile ? targetsForProfile(profile) : null), [profile]);
}

function plannerBase(profile: NonNullable<ReturnType<typeof useProfile>['data']>, kcal: number, protein: number) {
  return {
    targetKcal: kcal,
    targetProteinG: protein,
    dietType: profile.dietType as DietType,
    allergies: profile.allergies,
    dislikes: profile.dislikedFoods,
    cookingTime: profile.cookingTime as 'none' | 'under_15' | 'under_30' | 'over_30',
    budget: profile.budget as 'low' | 'medium' | 'high',
  };
}

/** Today's (or any day's) meal plan, including swaps. */
export function useDayPlan(date: string): { plan: DayPlan | null; choices: ReturnType<typeof usePlanChoices>['data'] } {
  const { data: profile } = useProfile();
  const targets = useTargets();
  const { data: choices } = usePlanChoices(date);
  const plan = useMemo(() => {
    if (!profile || !targets || !choices) return null;
    const swaps = Object.fromEntries(Object.entries(choices).map(([m, c]) => [m, c?.swapIndex ?? 0]));
    return planDay({ ...plannerBase(profile, targets.targetKcal, targets.proteinG), date, swaps });
  }, [profile, targets, choices, date]);
  return { plan, choices };
}

/** A week of plans for the grocery list (swaps are not applied to future days). */
export function useWeekPlan(startDate: string): DayPlan[] | null {
  const { data: profile } = useProfile();
  const targets = useTargets();
  return useMemo(
    () => (profile && targets ? planWeek({ ...plannerBase(profile, targets.targetKcal, targets.proteinG), startDate }) : null),
    [profile, targets, startDate],
  );
}

export function useSwapMeal(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (meal: Meal) => swapPlannedMeal(date, meal),
    onSuccess: () => qc.invalidateQueries({ queryKey: foodKeys.plan(date) }),
  });
}

export function useLogPlannedMeal(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (meal: PlannedMeal) => logPlannedMeal(date, meal),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: foodKeys.plan(date) });
      qc.invalidateQueries({ queryKey: foodKeys.diary(date) });
      qc.invalidateQueries({ queryKey: foodKeys.recent });
    },
  });
}
