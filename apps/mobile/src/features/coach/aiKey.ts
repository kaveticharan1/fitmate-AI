import * as SecureStore from 'expo-secure-store';

/**
 * The user's own Gemini API key lives only in the Android Keystore-backed
 * SecureStore: never in the database, never in backups or exports, never logged.
 */
const KEY = 'fm.ai.gemini.v1';
const OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export interface StoredAiKey {
  apiKey: string;
  model: string;
}

export async function getAiKey(): Promise<StoredAiKey | null> {
  const raw = await SecureStore.getItemAsync(KEY, OPTS);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<StoredAiKey>;
    return typeof v.apiKey === 'string' && typeof v.model === 'string' ? { apiKey: v.apiKey, model: v.model } : null;
  } catch {
    return null;
  }
}

export const setAiKey = (v: StoredAiKey) => SecureStore.setItemAsync(KEY, JSON.stringify(v), OPTS);

export const deleteAiKey = () => SecureStore.deleteItemAsync(KEY, OPTS);

export const AI_KEY_STORE_NAME = KEY;
