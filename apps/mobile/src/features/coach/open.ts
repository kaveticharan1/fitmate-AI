import { router } from 'expo-router';

/**
 * Opens the Coach tab. `n` makes every call distinct, so a prefill or
 * "start listening" request is applied even if the tab is already open.
 */
export function openCoach(opts: { prefill?: string; listen?: boolean } = {}) {
  const params: Record<string, string> = { n: String(Date.now()) };
  if (opts.prefill) params.prefill = opts.prefill;
  if (opts.listen) params.listen = '1';
  router.push({ pathname: '/coach', params });
}

/** Meal that fits the time of day, for quick photo logging. */
export function mealForTime(now: Date = new Date()): 'breakfast' | 'lunch' | 'snack' | 'dinner' {
  const h = now.getHours();
  return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 19 ? 'snack' : 'dinner';
}
