import { CoachError, isChatModel, listChatModels, listGroqModels, providerForKey, withFallback, type AiProvider, type FetchFn } from '@fitmate/coach';
import { setAiKey, type StoredAiKey } from './aiKey';

const fetchFn: FetchFn = (url, init) => fetch(url, init);

export type ModelUse = 'chat' | 'vision';

export const providerOf = (stored: StoredAiKey): AiProvider => stored.provider ?? 'gemini';

/** Asks the provider which models to use now (main + backups, and photo models for Groq) and saves them. */
export async function refreshModels(apiKey: string, provider: AiProvider = providerForKey(apiKey) ?? 'gemini'): Promise<string[]> {
  if (provider === 'groq') {
    const { chat, vision } = await listGroqModels(apiKey, fetchFn);
    const [model, ...fallbacks] = chat;
    await setAiKey({ provider: 'groq', apiKey, model: model!, fallbacks, visionModels: vision });
    return chat;
  }
  const [model, ...fallbacks] = await listChatModels(apiKey, fetchFn);
  await setAiKey({ apiKey, model: model!, fallbacks });
  return [model!, ...fallbacks];
}

/**
 * The models to try, best first. Keys saved by older versions (one model, no
 * backups) are refreshed once. If the provider can't be reached for the list,
 * the saved model is used alone.
 */
export async function modelChain(stored: StoredAiKey, use: ModelUse = 'chat'): Promise<string[]> {
  if (providerOf(stored) === 'groq') {
    if (use === 'vision') {
      let vision = stored.visionModels;
      if (!vision) {
        try {
          await refreshModels(stored.apiKey, 'groq');
          vision = (await listGroqModels(stored.apiKey, fetchFn)).vision;
        } catch {
          vision = [];
        }
      }
      if (!vision.length) throw new CoachError('no_model', 'No photo-reading model is available on Groq right now.');
      return vision;
    }
    if (stored.fallbacks) return [stored.model, ...stored.fallbacks];
    try {
      return await refreshModels(stored.apiKey, 'groq');
    } catch {
      return [stored.model];
    }
  }
  if (isChatModel(stored.model) && stored.fallbacks) return [stored.model, ...stored.fallbacks];
  try {
    return await refreshModels(stored.apiKey, 'gemini');
  } catch {
    return [stored.model];
  }
}

/** Runs a request with the main model, falling back to the backups when busy or slow. */
export async function withModels<T>(stored: StoredAiKey, attempt: (model: string, timeoutMs: number) => Promise<T>, use: ModelUse = 'chat'): Promise<T> {
  return (await withFallback(await modelChain(stored, use), attempt)).result;
}
