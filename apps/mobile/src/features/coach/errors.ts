import { CoachError } from '@fitmate/coach';

export const AI_STUDIO_KEYS_URL = 'https://aistudio.google.com/apikey';
export const GROQ_KEYS_URL = 'https://console.groq.com/keys';

/** i18n key for an error from the coach client. */
export function coachErrorKey(e: unknown): string {
  return e instanceof CoachError ? `coach.errors.${e.kind}` : 'coach.errors.network';
}
