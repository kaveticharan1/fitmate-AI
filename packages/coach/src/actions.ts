/**
 * Coach actions: the AI may PROPOSE a small set of app actions by adding an
 * [[action: {...}]] tag to its reply. The app validates every field, shows a
 * confirmation card, and only performs the action after the user taps Confirm.
 * The AI never runs code, SQL or arbitrary requests.
 */
export type Meal = 'breakfast' | 'lunch' | 'snack' | 'dinner';

export type CoachAction =
  | { type: 'log_food'; meal: Meal; items: { name: string; count?: number; unit?: string; grams?: number }[] }
  | { type: 'log_water'; ml: number }
  | { type: 'log_weight'; kg: number }
  | { type: 'log_sleep'; bed: string; wake: string }
  | { type: 'set_reminder'; label: string; time: string };

export type ActionStatus = 'proposed' | 'done' | 'dismissed' | 'failed';
export interface StoredAction {
  action: CoachAction;
  status: ActionStatus;
}

const MEALS: Meal[] = ['breakfast', 'lunch', 'snack', 'dinner'];
const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/;

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const hhmm = (v: unknown): string | null => {
  const s = str(v, 5);
  const m = s ? TIME.exec(s) : null;
  return m ? `${m[1]!.padStart(2, '0')}:${m[2]}` : null;
};

/** Strict check of one proposed action. Anything outside safe ranges is rejected. */
export function validateAction(raw: unknown): CoachAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  switch (a.type) {
    case 'log_food': {
      const meal = MEALS.includes(a.meal as Meal) ? (a.meal as Meal) : null;
      if (!meal || !Array.isArray(a.items)) return null;
      const items = (a.items as Record<string, unknown>[])
        .slice(0, 10)
        .map((it) => {
          const name = str(it?.name, 60);
          if (!name) return null;
          const count = num(it.count);
          const grams = num(it.grams);
          const unit = str(it.unit, 20)?.toLowerCase() ?? undefined;
          return {
            name,
            ...(count != null && count >= 0.25 && count <= 20 ? { count } : {}),
            ...(grams != null && grams >= 1 && grams <= 2000 ? { grams } : {}),
            ...(unit ? { unit } : {}),
          };
        })
        .filter((x): x is NonNullable<typeof x> => x != null);
      return items.length ? { type: 'log_food', meal, items } : null;
    }
    case 'log_water': {
      const ml = num(a.ml);
      return ml != null && ml >= 50 && ml <= 2000 ? { type: 'log_water', ml: Math.round(ml) } : null;
    }
    case 'log_weight': {
      const kg = num(a.kg);
      return kg != null && kg >= 25 && kg <= 350 ? { type: 'log_weight', kg: Math.round(kg * 10) / 10 } : null;
    }
    case 'log_sleep': {
      const bed = hhmm(a.bed);
      const wake = hhmm(a.wake);
      return bed && wake && bed !== wake ? { type: 'log_sleep', bed, wake } : null;
    }
    case 'set_reminder': {
      const label = str(a.label, 60);
      const time = hhmm(a.time);
      return label && time ? { type: 'set_reminder', label, time } : null;
    }
    default:
      return null;
  }
}

const ACTION_TAG = /\[\[action:\s*(\{[\s\S]*?\})\s*\]\]/g;

/** Removes action tags from a reply and returns the valid actions (at most 3). */
export function extractActions(reply: string): { text: string; actions: CoachAction[] } {
  const actions: CoachAction[] = [];
  const text = reply
    .replace(ACTION_TAG, (_, json: string) => {
      try {
        const a = validateAction(JSON.parse(json));
        if (a && actions.length < 3) actions.push(a);
      } catch {
        /* malformed: ignored */
      }
      return '';
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { text, actions };
}

/** Instructions added to the coach's system prompt when actions are allowed. */
export const ACTIONS_PROMPT = [
  'App actions: when the user asks you to log or set something, or clearly reports what they just ate, drank, weighed or slept, you may propose ONE action by adding this line at the very end of your reply:',
  '[[action: {...json...}]]',
  'Allowed JSON (exactly these shapes):',
  '{"type":"log_food","meal":"breakfast|lunch|snack|dinner","items":[{"name":"dosa","count":2,"unit":"piece"},{"name":"sambar","count":1,"unit":"katori"}]}  (units: piece, katori, cup, glass, tbsp, tsp, slice, plate, ladle, g; use "grams" instead of count for weights)',
  '{"type":"log_water","ml":500}',
  '{"type":"log_weight","kg":84.6}',
  '{"type":"log_sleep","bed":"23:15","wake":"06:30"}',
  '{"type":"set_reminder","label":"Evening walk","time":"18:30"}',
  'The user must confirm in the app, so say "I can log this for you — tap Confirm below", never claim it is already done. Do not propose actions the user did not ask for or report. Never invent amounts: ask if unclear.',
].join('\n');
