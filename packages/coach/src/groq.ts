import { CoachError, type FetchFn } from './gemini';
import type { ChatTurn } from './prompt';

/**
 * Groq (OpenAI-compatible API). Free plan, per model: 30 requests/min,
 * 1,000/day, 8,000 tokens/min, 200,000 tokens/day — so prompts stay compact.
 *
 * Chat: openai/gpt-oss-120b (best free quality, ~500 tok/s) with low reasoning
 * effort for speed, then gpt-oss-20b (~1,000 tok/s), then Qwen 3.8 27B.
 * Photos: qwen/qwen3.8-27b, Groq's only free vision model (a preview model).
 */
export const GROQ_BASE = 'https://api.groq.com/openai/v1';

export type AiProvider = 'gemini' | 'groq';

/** Gemini keys start with "AIza", Groq keys with "gsk_". */
export function providerForKey(key: string): AiProvider | null {
  const k = key.trim();
  if (/^gsk_[A-Za-z0-9]{20,}$/.test(k)) return 'groq';
  if (/^AIza[0-9A-Za-z_-]{30,}$/.test(k)) return 'gemini';
  return null;
}

/** Preferred chat models, best first. Only those the key can see are used. */
export const GROQ_CHAT_PREFERENCE = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b', 'qwen/qwen3.6-27b'];
/** Vision-capable models, best first. */
export const GROQ_VISION_PREFERENCE = ['qwen/qwen3.8-27b', 'qwen/qwen3.6-27b', 'meta-llama/llama-4-maverick-17b-128e-instruct', 'meta-llama/llama-4-scout-17b-16e-instruct'];

interface GroqError {
  error?: { message?: string; type?: string; code?: string };
}

function errorFrom(status: number, body: GroqError): CoachError {
  const msg = body.error?.message ?? `HTTP ${status}`;
  const code = body.error?.code ?? '';
  if (status === 429 || code === 'rate_limit_exceeded') return new CoachError('quota', msg);
  if (status === 401 || status === 403 || code === 'invalid_api_key') return new CoachError('invalid_key', msg);
  if (status >= 500) return new CoachError('unavailable', msg);
  if (status === 404 || code === 'model_not_found' || code === 'model_decommissioned') return new CoachError('bad_response', `model not found: ${msg}`);
  return new CoachError('bad_response', msg);
}

export async function groqCall(fetchFn: FetchFn, path: string, apiKey: string, body: unknown | undefined, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Awaited<ReturnType<FetchFn>>;
  try {
    res = await fetchFn(`${GROQ_BASE}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
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
  if (!res.ok) throw errorFrom(res.status, json as GroqError);
  return json;
}

/** Keeps reasoning short (fast replies) and out of the answer text. */
export function groqReasoning(model: string): Record<string, unknown> {
  if (/gpt-oss/i.test(model)) return { reasoning_effort: 'low', include_reasoning: false };
  if (/qwen3/i.test(model)) return { reasoning_effort: 'none', reasoning_format: 'hidden' };
  return {};
}

interface ChatResponse {
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
}

export function parseGroqReply(json: unknown): string {
  const choice = (json as ChatResponse).choices?.[0];
  const text = (choice?.message?.content ?? '')
    // Some models wrap private reasoning in <think> tags; never show it.
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();
  if (!text) throw new CoachError('bad_response', choice?.finish_reason === 'content_filter' ? 'blocked' : 'Empty reply');
  return text;
}

/** Sends a chat request; if the model rejects the reasoning settings, sends it again without them. */
async function completion(fetchFn: FetchFn, apiKey: string, body: Record<string, unknown>, extra: Record<string, unknown>, timeoutMs: number) {
  try {
    return await groqCall(fetchFn, '/chat/completions', apiKey, { ...body, ...extra }, timeoutMs);
  } catch (e) {
    if (Object.keys(extra).length && e instanceof CoachError && e.kind === 'bad_response' && /reason/i.test(e.message)) {
      return groqCall(fetchFn, '/chat/completions', apiKey, body, timeoutMs);
    }
    throw e;
  }
}

export async function groqChat(opts: {
  apiKey: string;
  model: string;
  system: string;
  turns: ChatTurn[];
  fetchFn: FetchFn;
  timeoutMs?: number;
  maxTokens?: number;
}): Promise<string> {
  const body = {
    model: opts.model,
    messages: [{ role: 'system', content: opts.system }, ...opts.turns.map((t) => ({ role: t.role === 'user' ? 'user' : 'assistant', content: t.text }))],
    temperature: 0.6,
    max_completion_tokens: opts.maxTokens ?? 1024,
  };
  const json = await completion(opts.fetchFn, opts.apiKey, body, groqReasoning(opts.model), opts.timeoutMs ?? 30000);
  return parseGroqReply(json);
}

/** One prompt with 1–3 JPEG photos; returns the model's text (JSON when asked). */
export async function groqVision(opts: {
  apiKey: string;
  model: string;
  prompt: string;
  jpegsBase64: string[];
  fetchFn: FetchFn;
  json?: boolean;
  timeoutMs?: number;
  maxTokens?: number;
}): Promise<string> {
  if (opts.jpegsBase64.length < 1 || opts.jpegsBase64.length > 3) throw new CoachError('bad_response', 'One to three photos');
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: [
      {
        role: 'user',
        content: [
          ...opts.jpegsBase64.map((data) => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${data}` } })),
          { type: 'text', text: opts.prompt },
        ],
      },
    ],
    temperature: 0.2,
    max_completion_tokens: opts.maxTokens ?? 1500,
    ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
  };
  const json = await completion(opts.fetchFn, opts.apiKey, body, groqReasoning(opts.model), opts.timeoutMs ?? 45000);
  return parseGroqReply(json);
}

/** The models this key can use: a chat chain (best first) and the vision model, if any. */
export async function listGroqModels(apiKey: string, fetchFn: FetchFn, timeoutMs = 15000): Promise<{ chat: string[]; vision: string[] }> {
  const json = (await groqCall(fetchFn, '/models', apiKey, undefined, timeoutMs)) as { data?: { id: string; active?: boolean }[] };
  const ids = new Set((json.data ?? []).filter((m) => m.active !== false).map((m) => m.id));
  const chat = GROQ_CHAT_PREFERENCE.filter((m) => ids.has(m));
  const vision = GROQ_VISION_PREFERENCE.filter((m) => ids.has(m));
  if (chat.length === 0) {
    // Groq renames models often: fall back to any general chat model it lists.
    const any = [...ids].filter((id) => !/whisper|tts|orpheus|guard|safeguard|compound|allam/i.test(id)).sort();
    chat.push(...any.slice(0, 2));
  }
  if (chat.length === 0) throw new CoachError('no_model', 'No suitable Groq model is available for this key.');
  return { chat, vision };
}
