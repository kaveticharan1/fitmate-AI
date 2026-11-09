import type { ChatTurn } from './prompt';

/**
 * A minimal client for Google's Gemini API (generativelanguage.googleapis.com, v1beta).
 * The key belongs to the user and goes in the x-goog-api-key header, never in the URL.
 */
export const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export type FetchFn = (url: string, init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export type CoachErrorKind = 'invalid_key' | 'quota' | 'blocked' | 'unavailable' | 'network' | 'timeout' | 'bad_response' | 'no_model';

export class CoachError extends Error {
  constructor(
    readonly kind: CoachErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'CoachError';
  }
}

interface ApiError {
  error?: { code?: number; message?: string; status?: string };
}

function errorFrom(status: number, body: ApiError): CoachError {
  const s = body.error?.status ?? '';
  const msg = body.error?.message ?? `HTTP ${status}`;
  if (status === 429 || s === 'RESOURCE_EXHAUSTED') return new CoachError('quota', msg);
  if (status === 401 || status === 403 || s === 'PERMISSION_DENIED' || s === 'UNAUTHENTICATED' || /api key/i.test(msg))
    return new CoachError('invalid_key', msg);
  if (status >= 500) return new CoachError('unavailable', msg);
  return new CoachError('bad_response', msg);
}

async function call(fetchFn: FetchFn, url: string, apiKey: string, body: unknown | undefined, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Awaited<ReturnType<FetchFn>>;
  try {
    res = await fetchFn(url, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    if (controller.signal.aborted) throw new CoachError('timeout', 'The AI took too long to answer.');
    throw new CoachError('network', e instanceof Error ? e.message : 'Network error');
  } finally {
    clearTimeout(timer);
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    json = {};
  }
  if (!res.ok) throw errorFrom(res.status, json as ApiError);
  return json;
}

// ── Models ──────────────────────────────────────────────────────────────────

interface ModelInfo {
  name: string;
  supportedGenerationMethods?: string[];
}

const EXCLUDE = /(image|tts|audio|live|embedding|aqa|vision|robotics|computer|native|veo|imagen|lyria)/i;

/** Score a model id: prefer stable Flash (not Lite) with the highest version. */
function score(id: string): number {
  const version = Number(/gemini-(\d+(?:\.\d+)?)/.exec(id)?.[1] ?? 0);
  const preview = /(preview|exp|experimental)/i.test(id) ? 1 : 0;
  const lite = /lite/i.test(id) ? 1 : 0;
  const latestAlias = /latest/i.test(id) ? 1 : 0;
  // Stable > preview, Flash > Flash-Lite, then newest version.
  return (1 - preview) * 1000 + (1 - lite) * 100 + version * 10 - latestAlias;
}

/** Picks the best free-tier-friendly chat model from a ListModels response. */
export function pickModel(models: ModelInfo[]): string | null {
  const ids = models
    .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((id) => /^gemini-/.test(id) && /flash/i.test(id) && !EXCLUDE.test(id));
  if (ids.length === 0) return null;
  return ids.sort((a, b) => score(b) - score(a))[0]!;
}

/** Checks the key and returns the model to use. Throws CoachError('invalid_key') for a bad key. */
export async function verifyKey(apiKey: string, fetchFn: FetchFn, timeoutMs = 15000): Promise<string> {
  const json = (await call(fetchFn, `${GEMINI_BASE}/models?pageSize=200`, apiKey, undefined, timeoutMs)) as { models?: ModelInfo[] };
  const model = pickModel(json.models ?? []);
  if (!model) throw new CoachError('no_model', 'No suitable Gemini model is available for this key.');
  return model;
}

// ── Chat ────────────────────────────────────────────────────────────────────

export function buildRequest(system: string, turns: ChatTurn[]) {
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents: turns.map((t) => ({ role: t.role === 'user' ? 'user' : 'model', parts: [{ text: t.text }] })),
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
  };
}

interface GenerateResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

export function parseReply(json: unknown): string {
  const r = json as GenerateResponse;
  if (r.promptFeedback?.blockReason) throw new CoachError('blocked', r.promptFeedback.blockReason);
  const cand = r.candidates?.[0];
  const text = (cand?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('')
    .trim();
  if (!text) {
    if (cand?.finishReason === 'SAFETY' || cand?.finishReason === 'PROHIBITED_CONTENT') throw new CoachError('blocked', cand.finishReason);
    throw new CoachError('bad_response', `Empty reply (${cand?.finishReason ?? 'no candidates'})`);
  }
  return text;
}

export async function generateReply(opts: {
  apiKey: string;
  model: string;
  system: string;
  turns: ChatTurn[];
  fetchFn: FetchFn;
  timeoutMs?: number;
}): Promise<string> {
  const url = `${GEMINI_BASE}/models/${encodeURIComponent(opts.model)}:generateContent`;
  const json = await call(opts.fetchFn, url, opts.apiKey, buildRequest(opts.system, opts.turns), opts.timeoutMs ?? 45000);
  return parseReply(json);
}

/** Light clean-up of a pasted key; the real check is verifyKey(). */
export function cleanKey(key: string): string {
  return key.replace(/\s+/g, '');
}
