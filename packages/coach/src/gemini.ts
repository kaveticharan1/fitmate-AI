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

export async function call(fetchFn: FetchFn, url: string, apiKey: string, body: unknown | undefined, timeoutMs: number): Promise<unknown> {
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

// ── Thinking ────────────────────────────────────────────────────────────────

export type ThinkLevel = 'minimal' | 'low';

/**
 * Newer Gemini models "think" before answering, which by default can take
 * longer than a phone app should wait. Gemini 3+ takes a thinking level;
 * Gemini 2.5 takes a token budget (0 turns it off on Flash).
 */
export function thinkingConfig(model: string, level: ThinkLevel): Record<string, unknown> | undefined {
  const version = Number(/gemini-(\d+(?:\.\d+)?)/.exec(model)?.[1] ?? 0);
  if (version >= 3) return { thinkingLevel: level };
  if (version >= 2.5) return { thinkingBudget: /pro/i.test(model) ? 128 : level === 'minimal' ? 0 : 512 };
  return undefined;
}

/**
 * Sends a generateContent request with a light thinking setting. If the model
 * rejects that setting (older or unusual model), sends it again without.
 */
export async function generate(
  fetchFn: FetchFn,
  apiKey: string,
  model: string,
  body: { generationConfig?: Record<string, unknown> } & Record<string, unknown>,
  level: ThinkLevel,
  timeoutMs: number,
): Promise<unknown> {
  const url = `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`;
  const thinking = thinkingConfig(model, level);
  if (!thinking) return call(fetchFn, url, apiKey, body, timeoutMs);
  try {
    return await call(fetchFn, url, apiKey, { ...body, generationConfig: { ...body.generationConfig, thinkingConfig: thinking } }, timeoutMs);
  } catch (e) {
    if (e instanceof CoachError && e.kind === 'bad_response' && /think/i.test(e.message)) return call(fetchFn, url, apiKey, body, timeoutMs);
    throw e;
  }
}

// ── Models ──────────────────────────────────────────────────────────────────

interface ModelInfo {
  name: string;
  supportedGenerationMethods?: string[];
}

// Specialised or slow variants that aren't meant for quick chat.
const EXCLUDE = /(image|tts|audio|live|embedding|aqa|vision|robotics|computer|native|veo|imagen|lyria|think|deep|research|agent|gemma|nano|banana)/i;

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

/**
 * The models to try, best first: the newest stable Flash, then the best
 * Flash-Lite (fast, separate free quota), then an older Flash as a last resort.
 */
export function pickModels(models: ModelInfo[]): string[] {
  const ids = models
    .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((id) => /^gemini-/.test(id) && /flash/i.test(id) && !EXCLUDE.test(id))
    .sort((a, b) => score(b) - score(a));
  const version = (id: string) => /gemini-(\d+(?:\.\d+)?)/.exec(id)?.[1];
  const main = ids.find((id) => !/lite/i.test(id)) ?? ids[0];
  if (!main) return [];
  const lite = ids.find((id) => /lite/i.test(id) && id !== main);
  const older = ids.find((id) => !/lite/i.test(id) && version(id) !== version(main));
  return [main, lite, older].filter((x, i, a): x is string => !!x && a.indexOf(x) === i);
}

/** Fetches the model list for this key and returns the models to try, best first. */
export async function listChatModels(apiKey: string, fetchFn: FetchFn, timeoutMs = 15000): Promise<string[]> {
  const json = (await call(fetchFn, `${GEMINI_BASE}/models?pageSize=200`, apiKey, undefined, timeoutMs)) as { models?: ModelInfo[] };
  const chain = pickModels(json.models ?? []);
  if (chain.length === 0) throw new CoachError('no_model', 'No suitable Gemini model is available for this key.');
  return chain;
}

/** Errors worth trying again with another model: busy, slow, out of that model's quota, or retired. */
export function isRetriable(e: unknown): boolean {
  if (!(e instanceof CoachError)) return false;
  if (e.kind === 'unavailable' || e.kind === 'timeout' || e.kind === 'quota') return true;
  return e.kind === 'bad_response' && /not found|not supported|deprecated|overloaded/i.test(e.message);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs `attempt` with each model in turn until one answers. A "busy" reply gets
 * one quick retry on the same model first. Other errors (bad key, blocked,
 * no internet) stop straight away.
 */
export async function withFallback<T>(
  models: string[],
  attempt: (model: string, timeoutMs: number) => Promise<T>,
  opts: { firstTimeoutMs?: number; nextTimeoutMs?: number; retryDelayMs?: number } = {},
): Promise<{ result: T; model: string }> {
  const { firstTimeoutMs = 35000, nextTimeoutMs = 30000, retryDelayMs = 1500 } = opts;
  let last: unknown = new CoachError('no_model', 'No model to try');
  for (const [i, model] of models.entries()) {
    const timeout = i === 0 ? firstTimeoutMs : nextTimeoutMs;
    try {
      return { result: await attempt(model, timeout), model };
    } catch (e) {
      last = e;
      if (!isRetriable(e)) throw e;
      if (e instanceof CoachError && e.kind === 'unavailable') {
        await sleep(retryDelayMs);
        try {
          return { result: await attempt(model, timeout), model };
        } catch (e2) {
          last = e2;
          if (!isRetriable(e2)) throw e2;
        }
      }
    }
  }
  throw last;
}

/** True if this model id is one FitMate would pick for chat (fast, general Flash). */
export function isChatModel(id: string): boolean {
  return pickModel([{ name: id, supportedGenerationMethods: ['generateContent'] }]) === id;
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
  // Chat: minimal thinking keeps replies quick; the coach's job is guidance, not puzzles.
  const json = await generate(opts.fetchFn, opts.apiKey, opts.model, buildRequest(opts.system, opts.turns), 'minimal', opts.timeoutMs ?? 60000);
  return parseReply(json);
}

/** Light clean-up of a pasted key; the real check is verifyKey(). */
export function cleanKey(key: string): string {
  return key.replace(/\s+/g, '');
}
