import type { Profile } from '@fitmate/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getProfile, logWeight, recentWeights, saveProfile } from '../../db/repositories';

export const keys = {
  profile: ['profile'] as const,
  weights: ['weights'] as const,
};

export const useProfile = () => useQuery({ queryKey: keys.profile, queryFn: () => getProfile() });

export const useRecentWeights = () => useQuery({ queryKey: keys.weights, queryFn: () => recentWeights(30) });

export function useSaveProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Profile) => saveProfile(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.profile });
      qc.invalidateQueries({ queryKey: keys.weights });
      qc.invalidateQueries({ queryKey: ['progress'] });
    },
  });
}

export function useLogWeight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (kg: number) => logWeight(kg),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.profile });
      qc.invalidateQueries({ queryKey: keys.weights });
      qc.invalidateQueries({ queryKey: ['progress'] });
    },
  });
}
