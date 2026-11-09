import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCheckin, listPhotos, saveCheckin, updatePhoto, type CheckinInput } from '../../db/faceRepo';
import { localDate } from '../../lib/time';
import { deletePhoto, readPhotoBase64, savePhoto } from './photoStore';
import { analyzePhotos, faceInsights, giveFaceAiConsent, hasFaceAiConsent, withdrawFaceAiConsent } from './service';

export const faceKeys = {
  all: ['face'] as const,
  checkin: (day: string) => ['face', 'checkin', day] as const,
  insights: ['face', 'insights'] as const,
  photos: ['face', 'photos'] as const,
  image: (id: string) => ['face', 'image', id] as const,
  consent: ['face', 'consent'] as const,
};

export const useTodayCheckin = () => useQuery({ queryKey: faceKeys.checkin(localDate()), queryFn: () => getCheckin(localDate()) });
export const useFaceInsights = () => useQuery({ queryKey: faceKeys.insights, queryFn: () => faceInsights() });
export const usePhotos = () => useQuery({ queryKey: faceKeys.photos, queryFn: () => listPhotos() });
export const useFaceConsent = () => useQuery({ queryKey: faceKeys.consent, queryFn: () => hasFaceAiConsent() });

/** Decrypted image as a data URI, held only in memory while on screen. */
export const usePhotoImage = (id: string | null) =>
  useQuery({
    queryKey: faceKeys.image(id ?? ''),
    queryFn: async () => {
      const b64 = id ? await readPhotoBase64(id) : null;
      return b64 ? `data:image/jpeg;base64,${b64}` : null;
    },
    enabled: !!id,
    gcTime: 30_000,
  });

/** True/false once face wellness is in use (a check-in was ever made), else null. Used by the day card. */
export function useFaceToday(): boolean | null {
  const { data } = useFaceInsights();
  if (!data || data.checkins.length === 0) return null;
  return !!data.today;
}

function useInvalidateFace() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: faceKeys.all });
}

export function useSaveCheckin() {
  const done = useInvalidateFace();
  return useMutation({ mutationFn: async (c: CheckinInput) => saveCheckin(c), onSuccess: done });
}

export function usePhotoActions() {
  const done = useInvalidateFace();
  return {
    save: useMutation({ mutationFn: (v: { uri: string; note: string | null }) => savePhoto(v.uri, v.note), onSuccess: done }),
    remove: useMutation({ mutationFn: async (id: string) => deletePhoto(id), onSuccess: done }),
    note: useMutation({ mutationFn: async (v: { id: string; note: string }) => updatePhoto(v.id, { note: v.note.trim().slice(0, 300) || null }), onSuccess: done }),
    verdict: useMutation({ mutationFn: async (v: { id: string; verdict: 'agree' | 'disagree' }) => updatePhoto(v.id, { userVerdict: v.verdict }), onSuccess: done }),
    analyze: useMutation({ mutationFn: (ids: string[]) => analyzePhotos(ids), onSuccess: done }),
  };
}

export function useFaceConsentActions() {
  const done = useInvalidateFace();
  return {
    give: useMutation({ mutationFn: async () => giveFaceAiConsent(), onSuccess: done }),
    withdraw: useMutation({ mutationFn: async () => withdrawFaceAiConsent(), onSuccess: done }),
  };
}
