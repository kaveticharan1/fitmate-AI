import { CoachError, readIngredientLabel, type FetchFn } from '@fitmate/coach';
import { buildRoutine } from '@fitmate/skin';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { hasConsent } from '../../db/repositories';
import {
  deleteSkinData,
  getSkinProfile,
  listSteps,
  routineDone,
  routineToSteps,
  saveRoutineSteps,
  saveSkinProfile,
  setRoutineDone,
  type SkinProfileInput,
  type StepInput,
} from '../../db/skinRepo';
import { addDays, localDate } from '../../lib/time';
import { getAiKey } from '../coach/aiKey';
import { preparePhoto } from '../food/photo';

const fetchFn: FetchFn = (url, init) => fetch(url, init);

export const skinKeys = {
  all: ['skin'] as const,
  profile: ['skin', 'profile'] as const,
  steps: ['skin', 'steps'] as const,
  done: ['skin', 'done'] as const,
};

export const useSkinProfile = () => useQuery({ queryKey: skinKeys.profile, queryFn: () => getSkinProfile() });
export const useRoutineSteps = () => useQuery({ queryKey: skinKeys.steps, queryFn: () => listSteps() });
/** Morning/night ticks for the last 7 days. */
export const useRoutineDone = () => useQuery({ queryKey: skinKeys.done, queryFn: () => routineDone(addDays(localDate(), -6)) });

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: skinKeys.all });
}

export function useSaveSkinProfile() {
  const done = useInvalidate();
  return useMutation({ mutationFn: async (p: SkinProfileInput) => saveSkinProfile(p), onSuccess: done });
}

export function useDeleteSkinData() {
  const done = useInvalidate();
  return useMutation({ mutationFn: async () => deleteSkinData(), onSuccess: done });
}

/** Builds a starter routine from the saved profile and saves it (replacing the current one). */
export function useGenerateRoutine() {
  const done = useInvalidate();
  return useMutation({
    mutationFn: async () => {
      const p = getSkinProfile();
      if (!p) throw new Error('no profile');
      const r = buildRoutine({ skinType: p.skinType, sensitive: p.sensitive, concerns: p.concerns, pregnant: p.pregnant, experience: p.experience, budget: p.budget });
      saveRoutineSteps(routineToSteps(r));
      return r;
    },
    onSuccess: done,
  });
}

export function useSaveSteps() {
  const done = useInvalidate();
  return useMutation({ mutationFn: async (steps: StepInput[]) => saveRoutineSteps(steps), onSuccess: done });
}

export function useTickRoutine() {
  const done = useInvalidate();
  return useMutation({ mutationFn: async (v: { slot: 'am' | 'pm'; done: boolean }) => setRoutineDone(localDate(), v.slot, v.done), onSuccess: done });
}

/** Reads the ingredient list from a label photo (needs the AI coach; the photo is not kept). */
export function useReadLabel() {
  return useMutation({
    mutationFn: async (uri: string) => {
      const stored = await getAiKey();
      if (!stored || !hasConsent('ai_coach')) throw new CoachError('invalid_key', 'AI coach is not set up');
      return readIngredientLabel({ apiKey: stored.apiKey, model: stored.model, jpegBase64: await preparePhoto(uri), fetchFn });
    },
  });
}
