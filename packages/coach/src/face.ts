import { call, CoachError, GEMINI_BASE, parseReply, type FetchFn } from './gemini';

/**
 * Face photo observations: appearance only, cautious wording, never a diagnosis.
 * The model first judges whether the photo is usable; unusable photos get a
 * "please retake" instead of observations. Any sentence that strays into
 * medical, fat or fluid claims is removed before the user sees it.
 */
export const QUALITY_ISSUES = ['too_dark', 'too_bright', 'blurry', 'face_not_visible', 'angle', 'filter', 'multiple_faces', 'not_a_face'] as const;
export type QualityIssue = (typeof QUALITY_ISSUES)[number];

export interface FaceAnalysis {
  usable: boolean;
  issues: QualityIssue[];
  observations: string[];
  comparison: string | null;
  /** True if the two photos' conditions differ enough to make comparison unreliable. */
  conditionsDiffer: boolean;
}

export function buildFacePrompt(language: 'en' | 'te', comparing: boolean): string {
  return [
    'You look at a face photo inside a wellness app. Describe visible appearance only — you are not a doctor.',
    'Step 1: judge whether the photo is usable: enough light, in focus, one face clearly visible and facing the camera, no beauty filter.',
    'If it is not usable, set "usable": false, list the issues and leave observations empty.',
    'Step 2 (only if usable): give at most 3 short, cautious observations about visible under-eye fullness, cheek or general facial fullness and skin appearance, using words like "appears" or "looks".',
    comparing
      ? 'You get two photos: the FIRST is older, the SECOND is newer. Compare visible fullness cautiously in "comparison", and set "conditions_differ" to true if lighting, angle, distance or expression differ noticeably.'
      : 'There is one photo; set "comparison" to null.',
    'Never: diagnose any condition, mention allergies, kidney, thyroid or other illnesses, estimate fat, body fat, water retention or fluid amounts, or claim weight or fat loss. Always remind that lighting, angle and expression affect appearance.',
    language === 'te' ? 'Write observations and comparison in simple Telugu.' : 'Write observations and comparison in plain English.',
    'Reply with JSON only:',
    `{"usable":boolean,"issues":[${QUALITY_ISSUES.map((i) => `"${i}"`).join('|')}],"observations":[string],"comparison":string|null,"conditions_differ":boolean}`,
  ].join('\n');
}

export function buildFaceRequest(prompt: string, jpegsBase64: string[]) {
  return {
    contents: [{ role: 'user', parts: [...jpegsBase64.map((data) => ({ inlineData: { mimeType: 'image/jpeg', data } })), { text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 1024, responseMimeType: 'application/json' },
  };
}

/** Claims the app must never show, in English and Telugu. */
const BANNED = /(diagnos|disease|syndrome|kidney|thyroid|allerg|edema|oedema|water retention|fluid|body ?fat|fat loss|lost fat|facial fat|visceral|infection|cancer|మూత్రపిండ|థైరాయిడ్|అలర్జీ|కొవ్వు)/i;

const clean = (s: unknown, max = 240): string | null => {
  if (typeof s !== 'string') return null;
  const t = s.trim().slice(0, max);
  return t && !BANNED.test(t) ? t : null;
};

export function parseFaceAnalysis(text: string): FaceAnalysis {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(cleaned);
  } catch {
    throw new CoachError('bad_response', 'Face reply was not JSON');
  }
  if (!raw || typeof raw !== 'object' || typeof raw.usable !== 'boolean') throw new CoachError('bad_response', 'Face reply missing "usable"');
  const issues = (Array.isArray(raw.issues) ? raw.issues : []).filter((i): i is QualityIssue => (QUALITY_ISSUES as readonly string[]).includes(i as string));
  if (!raw.usable) return { usable: false, issues: issues.length ? issues : ['face_not_visible'], observations: [], comparison: null, conditionsDiffer: false };
  const observations = (Array.isArray(raw.observations) ? raw.observations : []).map((o) => clean(o)).filter((o): o is string => !!o).slice(0, 3);
  return {
    usable: true,
    issues,
    observations,
    comparison: clean(raw.comparison, 400),
    conditionsDiffer: raw.conditions_differ === true,
  };
}

export async function analyzeFace(opts: {
  apiKey: string;
  model: string;
  /** One photo, or [older, newer] to compare. */
  jpegsBase64: string[];
  language: 'en' | 'te';
  fetchFn: FetchFn;
  timeoutMs?: number;
}): Promise<FaceAnalysis> {
  if (opts.jpegsBase64.length < 1 || opts.jpegsBase64.length > 2) throw new CoachError('bad_response', 'One or two photos');
  const url = `${GEMINI_BASE}/models/${encodeURIComponent(opts.model)}:generateContent`;
  const body = buildFaceRequest(buildFacePrompt(opts.language, opts.jpegsBase64.length === 2), opts.jpegsBase64);
  const json = await call(opts.fetchFn, url, opts.apiKey, body, opts.timeoutMs ?? 60000);
  return parseFaceAnalysis(parseReply(json));
}
