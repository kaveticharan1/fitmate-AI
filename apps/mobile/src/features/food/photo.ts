import { usableModel } from '../coach/model';
import { CoachError, estimateFromPhoto, type FetchFn, type PhotoEstimate } from '@fitmate/coach';
import { useMutation } from '@tanstack/react-query';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { getProfile, hasConsent } from '../../db/repositories';
import { getAiKey } from '../coach/aiKey';

const fetchFn: FetchFn = (url, init) => fetch(url, init);

const removeFile = (uri: string | undefined) => {
  if (!uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    /* already gone */
  }
};

/**
 * Shrinks the photo to 1024 px wide JPEG (about 100–200 KB) so it uploads fast,
 * returns it as Base64 and deletes the temporary files: photos are never kept.
 */
export async function preparePhoto(uri: string): Promise<string> {
  const ref = await ImageManipulator.manipulate(uri).resize({ width: 1024 }).renderAsync();
  const out = await ref.saveAsync({ compress: 0.6, format: SaveFormat.JPEG, base64: true });
  removeFile(out.uri);
  removeFile(uri);
  if (!out.base64) throw new CoachError('bad_response', 'Could not read the photo');
  return out.base64;
}

/** Sends the photo to Gemini with the user's key (AI coach must be on). */
export async function analyzePhoto(uri: string): Promise<PhotoEstimate> {
  const stored = await getAiKey();
  if (!stored || !hasConsent('ai_coach')) throw new CoachError('invalid_key', 'AI coach is not set up');
  const jpegBase64 = await preparePhoto(uri);
  const language = getProfile()?.aiLanguage === 'te' ? 'te' : 'en';
  return estimateFromPhoto({ apiKey: stored.apiKey, model: await usableModel(stored), jpegBase64, language, fetchFn });
}

export const useAnalyzePhoto = () => useMutation({ mutationFn: (uri: string) => analyzePhoto(uri) });
