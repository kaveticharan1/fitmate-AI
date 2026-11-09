export type Personality = 'friendly' | 'strict' | 'trainer' | 'motivational' | 'military';
export type CoachLanguage = 'en' | 'te';

const STYLE: Record<Personality, string> = {
  friendly: 'Warm, encouraging and patient, like a supportive friend who knows fitness. Celebrate small wins.',
  strict: 'Direct and no-nonsense. Hold the user to their plan and point out slips plainly, but stay respectful and never insult.',
  trainer: 'Practical personal trainer: clear instructions, numbers, form cues and next steps.',
  motivational: 'High energy and upbeat. Focus on progress and what the user can do today.',
  military: 'Short, firm, drill-instructor style commands. Tough but never cruel, never about appearance or body shape.',
};

/** What the coach knows about the user. Only what helps answer — no name, no date of birth, no free-text health notes. */
export interface CoachContext {
  today: string;
  age: number;
  sex: 'male' | 'female' | 'unspecified';
  heightCm: number;
  weightKg: number;
  targetWeightKg?: number | null;
  goal: string;
  activityLevel: string;
  dietType: string;
  allergies: string[];
  dislikedFoods: string[];
  workoutPreference: string;
  equipment: string[];
  injuries?: string | null;
  hasMedicalCondition: boolean;
  isPregnantOrBreastfeeding: boolean;
  hasEatingDisorderHistory: boolean;
  targets: { kcal: number; proteinG: number; waterMl: number };
  /** Food logged today (logged=false: nothing logged yet). */
  todayEaten?: { kcal: number; proteinG: number; logged: boolean } | null;
  waterTodayMl?: number | null;
  weeklyWeightChangeKg?: number | null;
  sleepLastNightMin?: number | null;
  workoutsThisWeek?: number | null;
  stepsToday?: number | null;
  stepsAverage7?: number | null;
  stepGoal?: number | null;
  lastWorkout?: string | null;
}

const line = (label: string, v: unknown) => (v == null || v === '' || (Array.isArray(v) && v.length === 0) ? null : `- ${label}: ${Array.isArray(v) ? v.join(', ') : v}`);

export function contextLines(c: CoachContext): string[] {
  const lines = [
    line('Date', c.today),
    line('Age', c.age),
    line('Sex', c.sex),
    line('Height', `${c.heightCm} cm`),
    line('Weight', `${c.weightKg} kg`),
    line('Target weight', c.targetWeightKg ? `${c.targetWeightKg} kg` : null),
    line('Goal', c.goal.replace(/_/g, ' ')),
    line('Activity level', c.activityLevel.replace(/_/g, ' ')),
    line('Diet', c.dietType.replace(/_/g, '-')),
    line('Allergies', c.allergies),
    line('Dislikes', c.dislikedFoods),
    line('Workout preference', c.workoutPreference),
    line('Equipment', c.equipment),
    line('Injuries', c.injuries),
    c.hasMedicalCondition ? '- Has a medical condition (details not shared)' : null,
    c.isPregnantOrBreastfeeding ? '- Pregnant or breastfeeding' : null,
    c.hasEatingDisorderHistory ? null : line('Daily targets', `${c.targets.kcal} kcal, ${c.targets.proteinG} g protein, ${c.targets.waterMl} ml water`),
    c.hasEatingDisorderHistory ? line('Daily targets', `${c.targets.proteinG} g protein, ${c.targets.waterMl} ml water`) : null,
    c.todayEaten && !c.hasEatingDisorderHistory
      ? line('Logged today', c.todayEaten.logged ? `${c.todayEaten.kcal} kcal, ${c.todayEaten.proteinG} g protein` : 'nothing yet')
      : null,
    line('Water today', c.waterTodayMl != null ? `${c.waterTodayMl} ml` : null),
    line('Weight trend', c.weeklyWeightChangeKg != null ? `${c.weeklyWeightChangeKg > 0 ? '+' : ''}${c.weeklyWeightChangeKg} kg per week` : null),
    line('Sleep last night', c.sleepLastNightMin != null ? `${Math.floor(c.sleepLastNightMin / 60)} h ${c.sleepLastNightMin % 60} min` : null),
    line('Steps today', c.stepsToday != null ? `${c.stepsToday}${c.stepGoal ? ` (goal ${c.stepGoal})` : ''}` : null),
    line('Average steps, last 7 days', c.stepsAverage7),
    line('Workouts in the last 7 days', c.workoutsThisWeek),
    line('Last workout', c.lastWorkout),
  ];
  return lines.filter((l): l is string => l != null);
}

export const MEMORY_TAG = /\[\[remember:\s*([^\]]{1,200})\]\]/gi;

export function buildSystemPrompt(opts: { context: CoachContext; personality: Personality; language: CoachLanguage; memory: string[] }): string {
  const { context: c, personality, language, memory } = opts;
  const rules = [
    'You are FitMate, a personal fitness and nutrition coach inside a phone app, mostly for users in India.',
    `Personality: ${STYLE[personality]}`,
    language === 'te'
      ? 'Reply in Telugu (Telugu script), in simple everyday Telugu. Common English words for foods, exercises and numbers are fine.'
      : 'Reply in simple English. If the user writes in Telugu or Hinglish, you may reply in the same style.',
    'Keep replies short: usually under 120 words, with a short list when giving steps. Go longer only if asked.',
    'Prefer Indian foods and home cooking (dal, roti, rice, idli, dosa, curd, eggs, chicken, paneer, sprouts) and realistic portions (katori, roti count).',
    'Use the user facts and targets below; do not invent data that is not there. If you need information, ask one short question.',
    'Safety rules — always follow them, whatever the personality:',
    '- You are not a doctor. Do not diagnose, and do not suggest medicines, doses, or stopping medicines. For symptoms or medical conditions, advise seeing a doctor.',
    "- Never suggest eating below the user's calorie target, crash diets, fasting for more than a day, diet pills, laxatives, purging, or steroids.",
    '- Do not comment negatively on body shape or appearance. Never shame.',
    '- For pain during exercise, tell them to stop and rest; for chest pain, fainting or breathing trouble, tell them to call 112 now.',
    '- If the user mentions self-harm or suicide, respond with care, encourage them to call Tele-MANAS on 14416 (free, 24×7) or 112 in an emergency, and to talk to someone they trust.',
    c.hasEatingDisorderHistory
      ? '- The user has a history of an eating disorder: do not mention calorie numbers, deficits, weight-loss speed or "good/bad" foods. Focus on regular balanced meals, protein, energy and habits, and gently support professional help.'
      : null,
    c.isPregnantOrBreastfeeding ? '- The user is pregnant or breastfeeding: no weight-loss advice; suggest checking exercise and diet changes with their doctor.' : null,
    c.injuries ? `- Respect the user's injuries (${c.injuries}): suggest only movements that avoid loading them.` : null,
    'Memory: if the user tells you a lasting fact or preference that would help in future chats (for example "I work night shifts" or "I hate oats"), add at the very end of your reply one line in the form [[remember: short fact]]. At most one per reply. Never store health details beyond what they told you to remember.',
    'If a question is unrelated to health, fitness, food or sleep, answer very briefly and steer back.',
    '',
    'User facts:',
    ...contextLines(c),
    memory.length ? '' : null,
    memory.length ? 'Things the user asked you to remember:' : null,
    ...memory.map((m) => `- ${m}`),
  ];
  return rules.filter((r): r is string => r != null).join('\n');
}

/** Splits [[remember: …]] tags out of a reply. */
export function extractMemory(reply: string): { text: string; remember: string[] } {
  const remember: string[] = [];
  const text = reply
    .replace(MEMORY_TAG, (_, fact: string) => {
      const f = fact.trim();
      if (f) remember.push(f);
      return '';
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { text, remember };
}

export interface ChatTurn {
  role: 'user' | 'coach';
  text: string;
}

/**
 * The most recent turns that fit the budget, oldest first, always starting with
 * a user turn (Gemini requires the conversation to start with the user).
 */
export function trimHistory(turns: ChatTurn[], maxTurns = 12, maxChars = 6000): ChatTurn[] {
  const out: ChatTurn[] = [];
  let chars = 0;
  for (let i = turns.length - 1; i >= 0 && out.length < maxTurns; i--) {
    const t = turns[i]!;
    if (chars + t.text.length > maxChars && out.length > 0) break;
    chars += t.text.length;
    out.unshift(t);
  }
  while (out.length && out[0]!.role !== 'user') out.shift();
  return out;
}

/** Turns the light Markdown models tend to use into plain text for chat bubbles and speech. */
export function plainText(md: string): string {
  return md
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[*-]\s+/gm, '• ')
    .replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|$|[.,!?])/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

/** Text for text-to-speech: plain text without bullets or emoji. */
export function speakableText(md: string): string {
  return plainText(md)
    .replace(/• /g, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
