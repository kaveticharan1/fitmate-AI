import { CoachError, generate, parseReply, type FetchFn } from './gemini';

/**
 * Reads the ingredient list printed on a product label photo. The model only
 * transcribes text that is visible — it must not guess a formula from the brand
 * or product name. The app then analyses the list on the phone.
 */
export const LABEL_PROMPT = [
  'Transcribe the INGREDIENTS list printed on this product label, exactly as written, separated by commas.',
  'Only copy text you can actually read. Do not add, guess or complete ingredients from the brand or product name.',
  'If no ingredient list is visible or it is unreadable, set "found" to false.',
  'Reply with JSON only: {"found":boolean,"ingredients":string,"product_name":string|null}',
].join('\n');

export interface LabelReading {
  found: boolean;
  ingredients: string;
  productName: string | null;
}

export function parseLabelReading(text: string): LabelReading {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(cleaned);
  } catch {
    throw new CoachError('bad_response', 'Label reply was not JSON');
  }
  const ingredients = typeof raw.ingredients === 'string' ? raw.ingredients.trim().slice(0, 4000) : '';
  const found = raw.found === true && ingredients.split(',').length >= 2;
  return { found, ingredients: found ? ingredients : '', productName: typeof raw.product_name === 'string' && raw.product_name.trim() ? raw.product_name.trim().slice(0, 120) : null };
}

export async function readIngredientLabel(opts: { apiKey: string; model: string; jpegBase64: string; fetchFn: FetchFn; timeoutMs?: number }): Promise<LabelReading> {
  const body = {
    contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/jpeg', data: opts.jpegBase64 } }, { text: LABEL_PROMPT }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 2048, responseMimeType: 'application/json' },
  };
  return parseLabelReading(parseReply(await generate(opts.fetchFn, opts.apiKey, opts.model, body, 'low', opts.timeoutMs ?? 60000)));
}
