import { groqVision, type AiProvider } from './groq';
import { CoachError, generate, parseReply, type FetchFn } from './gemini';

/**
 * Food photo → estimated items, using the user's own Gemini key.
 * The AI's answer is treated as untrusted: parsed strictly, clamped to
 * believable ranges and shown to the user to correct before anything is saved.
 */
export interface PhotoItem {
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface PhotoEstimate {
  items: PhotoItem[];
  confidence: 'low' | 'medium' | 'high';
  /** Why nothing was found, or a short caution from the AI ("portion hard to judge"). */
  note: string | null;
}

export function buildPhotoPrompt(language: 'en' | 'te'): string {
  return [
    'You estimate nutrition from a food photo for a fitness app used mostly in India.',
    'Identify each distinct food or drink visible (Indian dishes by their common names, e.g. "idli", "sambar", "chicken biryani", "pesarattu").',
    'Estimate the portion in grams from plate, katori and hand sizes, then calories, protein, carbohydrates, fat and fibre for that portion.',
    'Assume typical home cooking with normal oil unless the food looks oily or fried.',
    'If the image does not show food, return an empty items list and explain in "note".',
    'Be honest about uncertainty: confidence "low" when portions or dishes are unclear.',
    language === 'te' ? 'Write the dish names in English; write "note" in simple Telugu.' : 'Write dish names and "note" in English.',
    'Reply with JSON only, exactly this shape:',
    '{"items":[{"name":string,"grams":number,"kcal":number,"protein_g":number,"carbs_g":number,"fat_g":number,"fiber_g":number}],"confidence":"low"|"medium"|"high","note":string}',
  ].join('\n');
}

export function buildPhotoRequest(prompt: string, jpegBase64: string) {
  return {
    contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/jpeg', data: jpegBase64 } }, { text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 2048, responseMimeType: 'application/json' },
  };
}

const clamp = (n: unknown, lo: number, hi: number): number | null => {
  const v = typeof n === 'string' ? Number(n) : typeof n === 'number' ? n : NaN;
  if (!Number.isFinite(v)) return null;
  return Math.min(hi, Math.max(lo, v));
};
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Strict reading of the model's JSON. Throws CoachError('bad_response') if it isn't usable. */
export function parsePhotoEstimate(text: string): PhotoEstimate {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let raw: unknown;
  try {
    raw = JSON.parse(cleaned);
  } catch {
    throw new CoachError('bad_response', 'Photo reply was not JSON');
  }
  const obj = raw as { items?: unknown; confidence?: unknown; note?: unknown };
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.items)) throw new CoachError('bad_response', 'Photo reply had no items');
  const items: PhotoItem[] = [];
  for (const it of obj.items.slice(0, 12) as Record<string, unknown>[]) {
    if (!it || typeof it !== 'object') continue;
    const name = typeof it.name === 'string' ? it.name.trim().slice(0, 80) : '';
    const grams = clamp(it.grams, 1, 2000);
    const protein = clamp(it.protein_g ?? it.protein, 0, 300);
    const carbs = clamp(it.carbs_g ?? it.carbs, 0, 600);
    const fat = clamp(it.fat_g ?? it.fat, 0, 300);
    const fiber = clamp(it.fiber_g ?? it.fiber, 0, 100) ?? 0;
    let kcal = clamp(it.kcal ?? it.calories, 0, 4000);
    if (!name || grams == null || protein == null || carbs == null || fat == null) continue;
    // If the stated calories disagree badly with the macros, trust the macros (4/4/9 kcal per gram).
    const fromMacros = protein * 4 + carbs * 4 + fat * 9;
    if (kcal == null || (fromMacros > 0 && Math.abs(kcal - fromMacros) / fromMacros > 0.35)) kcal = fromMacros;
    items.push({ name, grams: Math.round(grams), kcal: Math.round(kcal), protein: r1(protein), carbs: r1(carbs), fat: r1(fat), fiber: r1(fiber) });
  }
  const confidence = obj.confidence === 'high' || obj.confidence === 'medium' ? obj.confidence : 'low';
  const note = typeof obj.note === 'string' && obj.note.trim() ? obj.note.trim().slice(0, 300) : null;
  return { items, confidence, note };
}

/** Scales an item to a new weight (when the user corrects the portion). */
export function scaleItem(item: PhotoItem, grams: number): PhotoItem {
  const f = grams / item.grams;
  return {
    ...item,
    grams: Math.round(grams),
    kcal: Math.round(item.kcal * f),
    protein: r1(item.protein * f),
    carbs: r1(item.carbs * f),
    fat: r1(item.fat * f),
    fiber: r1(item.fiber * f),
  };
}

export async function estimateFromPhoto(opts: {
  apiKey: string;
  model: string;
  jpegBase64: string;
  language: 'en' | 'te';
  fetchFn: FetchFn;
  timeoutMs?: number;
  provider?: AiProvider;
}): Promise<PhotoEstimate> {
  if (opts.provider === 'groq') {
    const text = await groqVision({ apiKey: opts.apiKey, model: opts.model, prompt: buildPhotoPrompt(opts.language), jpegsBase64: [opts.jpegBase64], fetchFn: opts.fetchFn, json: true, timeoutMs: opts.timeoutMs, maxTokens: 2048 });
    return parsePhotoEstimate(text);
  }
  const body = buildPhotoRequest(buildPhotoPrompt(opts.language), opts.jpegBase64);
  const json = await generate(opts.fetchFn, opts.apiKey, opts.model, body, 'low', opts.timeoutMs ?? 60000);
  return parsePhotoEstimate(parseReply(json));
}
