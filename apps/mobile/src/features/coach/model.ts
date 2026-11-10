import { isChatModel, verifyKey, type FetchFn } from '@fitmate/coach';
import { setAiKey } from './aiKey';

const fetchFn: FetchFn = (url, init) => fetch(url, init);

/** Asks Google which model to use now and saves it. */
export async function refreshModel(apiKey: string): Promise<string> {
  const model = await verifyKey(apiKey, fetchFn);
  await setAiKey({ apiKey, model });
  return model;
}

/** Re-picks the model if the saved one is a slow or specialised variant (older app versions could pick those). */
export async function usableModel(stored: { apiKey: string; model: string }): Promise<string> {
  if (isChatModel(stored.model)) return stored.model;
  try {
    return await refreshModel(stored.apiKey);
  } catch {
    return stored.model;
  }
}
