import { FitmateShare, type AppInfo } from '../../../modules/fitmate-share';

const REPO = 'kaveticharan1/fitmate-AI';
/** Written by CI next to every release: { version, versionCode, apk, bytes }. */
export const LATEST_JSON_URL = `https://github.com/${REPO}/releases/latest/download/latest.json`;
export const LATEST_API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
export const LATEST_APK_URL = `https://github.com/${REPO}/releases/latest/download/FitMate.apk`;

export interface LatestRelease {
  version: string;
  /** Null when only the tag was available (older releases). */
  versionCode: number | null;
  apkUrl: string;
  bytes: number | null;
}

type Fetch = typeof fetch;

async function getJson(url: string, fetchFn: Fetch, timeoutMs: number): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

/** Reads the newest published release. Throws when offline or GitHub can't be reached. */
export async function fetchLatest(fetchFn: Fetch = fetch, timeoutMs = 15000): Promise<LatestRelease> {
  try {
    const j = (await getJson(LATEST_JSON_URL, fetchFn, timeoutMs)) as Record<string, unknown>;
    if (typeof j.version === 'string' && typeof j.apk === 'string' && j.apk.startsWith('https://github.com/')) {
      return { version: j.version, versionCode: num(j.versionCode), apkUrl: j.apk, bytes: num(j.bytes) };
    }
  } catch {
    // Older releases have no latest.json; fall back to the release tag below.
  }
  const r = (await getJson(LATEST_API_URL, fetchFn, timeoutMs)) as { tag_name?: string; assets?: { name: string; size: number }[] };
  const m = /^v(\d+\.\d+\.\d+)/.exec(r.tag_name ?? '');
  if (!m?.[1]) throw new Error('No release found');
  const asset = r.assets?.find((a) => a.name === 'FitMate.apk');
  return { version: m[1], versionCode: null, apkUrl: LATEST_APK_URL, bytes: num(asset?.size) };
}

/** -1, 0 or 1 for dotted versions like 1.10.0 vs 1.9.2. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

export function isNewer(latest: LatestRelease, current: Pick<AppInfo, 'versionCode' | 'versionName'>): boolean {
  if (latest.versionCode != null) return latest.versionCode > current.versionCode;
  return compareVersions(latest.version, current.versionName) > 0;
}

export const canSelfUpdate = (): boolean => !!FitmateShare;

export function installedApp(): AppInfo | null {
  try {
    return FitmateShare?.appInfo() ?? null;
  } catch {
    return null;
  }
}

export type UpdateErrorKey = 'offline' | 'permission' | 'signature' | 'badFile' | 'notNewer' | 'generic';

/** Maps native error codes to a message key. */
export function updateErrorKey(e: unknown): UpdateErrorKey {
  const code = (e as { code?: string } | null)?.code;
  switch (code) {
    case 'DOWNLOAD_FAILED':
      return 'offline';
    case 'NEEDS_PERMISSION':
      return 'permission';
    case 'SIGNATURE_MISMATCH':
      return 'signature';
    case 'BAD_FILE':
    case 'WRONG_APP':
      return 'badFile';
    case 'NOT_NEWER':
      return 'notNewer';
    default:
      return 'generic';
  }
}

export const toMb = (bytes: number | null | undefined): number | null => (bytes && bytes > 0 ? Math.max(1, Math.round(bytes / (1024 * 1024))) : null);
