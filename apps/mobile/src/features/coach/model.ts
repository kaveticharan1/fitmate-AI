import { isChatModel, listChatModels, withFallback, type FetchFn } from '@fitmate/coach';
import { setAiKey, type StoredAiKey } from './aiKey';

const fetchFn: FetchFn = (url, init) => fetch(url, init);

/** Asks Google which models to use now (main + backups) and saves them. */
export async function refreshModels(apiKey: string): Promise<string[]> {
  const [model, ...fallbacks] = await listChatModels(apiKey, fetchFn);
  await setAiKey({ apiKey, model: model!, fallbacks });
  return [model!, ...fallbacks];
}

/**
 * The models to try, best first. Older app versions saved one model (sometimes
 * a slow variant) and no backups; those are refreshed once. If Google can't be
 * reached for the list, the saved model is used alone.
 */
export async function modelChain(stored: StoredAiKey): Promise<string[]> {
  if (isChatModel(stored.model) && stored.fallbacks) return [stored.model, ...stored.fallbacks];
  try {
    return await refreshModels(stored.apiKey);
  } catch {
    return [stored.model];
  }
}

/** Runs a Gemini request with the main model, falling back to the backups when busy or slow. */
export async function withModels<T>(stored: StoredAiKey, attempt: (model: string, timeoutMs: number) => Promise<T>): Promise<T> {
  return (await withFallback(await modelChain(stored), attempt)).result;
}
