/**
 * Buddy mode server: a free Supabase project (Mumbai). The publishable key is
 * meant to ship inside apps; it can only call the six buddy functions, and
 * each of those checks the member's private secret first.
 */
export const BUDDY_URL = 'https://xhfnsvtzwikdmjzgduvb.supabase.co';
export const BUDDY_KEY = 'sb_publishable_Z4luAEIqheWK7FmRP9j3Ag_KIhL4REd';

export type BuddyErrorKind = 'network' | 'timeout' | 'no_group' | 'group_full' | 'not_member' | 'bad_name' | 'too_many' | 'server';

export class BuddyError extends Error {
  constructor(
    readonly kind: BuddyErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'BuddyError';
  }
}

export type BuddyFetch = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

const KNOWN: BuddyErrorKind[] = ['no_group', 'group_full', 'not_member', 'bad_name', 'too_many'];

export async function rpc<T>(fn: string, args: Record<string, unknown>, fetchFn: BuddyFetch = (u, i) => fetch(u, i), timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Awaited<ReturnType<BuddyFetch>>;
  try {
    res = await fetchFn(`${BUDDY_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: BUDDY_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: controller.signal,
    });
  } catch (e) {
    if (controller.signal.aborted) throw new BuddyError('timeout', 'Buddy server took too long');
    throw new BuddyError('network', e instanceof Error ? e.message : 'Network error');
  } finally {
    clearTimeout(timer);
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const msg = String((body as { message?: string } | null)?.message ?? `HTTP ${res.status}`);
    const kind = KNOWN.find((k) => msg.includes(k)) ?? 'server';
    throw new BuddyError(kind, msg);
  }
  return body as T;
}
