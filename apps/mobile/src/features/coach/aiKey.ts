import type { AiProvider } from '@fitmate/coach';
import * as SecureStore from 'expo-secure-store';

/**
 * The user's own AI key (Groq or Gemini) lives only in the Android Keystore-backed
 * SecureStore: never in the database, never in backups or exports, never logged.
 */
const KEY = 'fm.ai.gemini.v1';
const OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export interface StoredAiKey {
  /** Older versions only had Gemini, so a missing provider means Gemini. */
  provider?: AiProvider;
  apiKey: string;
  model: string;
  /** Backup models to try when the main one is busy or slow (best first). */
  fallbacks?: string[];
  /** Models that can read photos (Groq); Gemini uses the same chain for photos. */
  visionModels?: string[];
}

export async function getAiKey(): Promise<StoredAiKey | null> {
  const raw = await SecureStore.getItemAsync(KEY, OPTS);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<StoredAiKey>;
    if (typeof v.apiKey !== 'string' || typeof v.model !== 'string') return null;
    const list = (x: unknown) => (Array.isArray(x) ? x.filter((m): m is string => typeof m === 'string') : undefined);
    const fallbacks = list(v.fallbacks);
    const visionModels = list(v.visionModels);
    return {
      ...(v.provider === 'groq' ? { provider: 'groq' as const } : {}),
      apiKey: v.apiKey,
      model: v.model,
      ...(fallbacks ? { fallbacks } : {}),
      ...(visionModels ? { visionModels } : {}),
    };
  } catch {
    return null;
  }
}

export const setAiKey = (v: StoredAiKey) => SecureStore.setItemAsync(KEY, JSON.stringify(v), OPTS);

export const deleteAiKey = () => SecureStore.deleteItemAsync(KEY, OPTS);

export const AI_KEY_STORE_NAME = KEY;
