import { ageFromDateOfBirth, averageSteps, defaultStepGoal, weeklyRate } from '@fitmate/core';
import {
  ACTIONS_PROMPT,
  buildSystemPrompt,
  extractActions,
  CoachError,
  extractMemory,
  generateReply,
  safetyFlags,
  trimHistory,
  type CoachContext,
  type CoachLanguage,
  type FetchFn,
  type Personality,
} from '@fitmate/coach';
import { WORKOUTS } from '@fitmate/workouts';
import { addMemory, addMessage, deleteMessagesBefore, listMemory, recentMessages, type CoachMessage } from '../../db/coachRepo';
import { sleepHistory } from '../../db/habitsRepo';
import { stepHistory } from '../../db/stepsRepo';
import { dailyFoodTotals, waterToday, weightHistory } from '../../db/progressRepo';
import { getProfile, getSetting, hasConsent, recordConsent, withdrawConsent } from '../../db/repositories';
import { workoutHistory } from '../../db/workoutRepo';
import { addDays, localDate } from '../../lib/time';
import { targetsForProfile } from '../profile/targets';
import { deleteAiKey, getAiKey } from './aiKey';
import { refreshModels, withModels } from './model';
import { faceSkinContext, knowledgeFor, WELLNESS_RULES } from './wellnessContext';

const fetchFn: FetchFn = (url, init) => fetch(url, init);

/** Gathers the small set of facts the coach gets with each question. */
export function buildCoachContext(now: Date = new Date()): { context: CoachContext; personality: Personality; language: CoachLanguage } | null {
  const p = getProfile();
  if (!p) return null;
  const today = localDate(now);
  const targets = targetsForProfile(p, now);
  const food = dailyFoodTotals(today).find((d) => d.date === today);
  const weights = weightHistory(addDays(today, -28));
  const rate = weeklyRate(weights);
  const sleep = sleepHistory(today).find((s) => s.wokeOn === today);
  const workouts = workoutHistory(addDays(today, -6));
  const steps = stepHistory(addDays(today, -6));
  const last = workouts[0];
  const lastName = last ? (WORKOUTS.find((w) => w.id === last.workoutId)?.name ?? last.workoutId) : null;

  return {
    personality: p.coachPersonality as Personality,
    language: p.aiLanguage as CoachLanguage,
    context: {
      today,
      age: ageFromDateOfBirth(p.dateOfBirth, now),
      sex: p.sex,
      heightCm: p.heightCm,
      weightKg: p.weightKg,
      targetWeightKg: p.targetWeightKg,
      goal: p.goal,
      activityLevel: p.activityLevel,
      dietType: p.dietType,
      allergies: p.allergies,
      dislikedFoods: p.dislikedFoods,
      workoutPreference: p.workoutPreference,
      equipment: p.equipment,
      injuries: p.injuries,
      hasMedicalCondition: p.hasMedicalCondition,
      isPregnantOrBreastfeeding: p.isPregnantOrBreastfeeding,
      hasEatingDisorderHistory: p.hasEatingDisorderHistory,
      targets: { kcal: targets.targetKcal, proteinG: targets.proteinG, waterMl: targets.waterMl },
      todayEaten: { kcal: Math.round(food?.kcal ?? 0), proteinG: Math.round(food?.protein ?? 0), logged: !!food },
      waterTodayMl: waterToday(today),
      weeklyWeightChangeKg: rate == null ? null : Math.round(rate * 10) / 10,
      sleepLastNightMin: sleep?.minutes ?? null,
      workoutsThisWeek: workouts.length,
      stepsToday: steps.find((s) => s.day === today)?.steps ?? null,
      stepsAverage7: averageSteps(steps),
      stepGoal: getSetting<number | null>('stepGoal', null) ?? defaultStepGoal(p.activityLevel),
      lastWorkout: last ? `${last.doneOn} ${lastName}` : null,
    },
  };
}

/** Face & skin context and matching reference knowledge for this question (only what the user shares). */
function extraContext(lastUserText: string): string[] {
  const blocks: (string | null)[] = [];
  try {
    const ctx = faceSkinContext();
    const kb = knowledgeFor(lastUserText);
    blocks.push(WELLNESS_RULES, ctx, kb);
  } catch {
    /* wellness data is optional */
  }
  return blocks.filter((x): x is string => !!x);
}

/** Saves the user's message (with any local safety flags). */
export function saveUserMessage(text: string): CoachMessage {
  return addMessage('user', text.trim(), safetyFlags(text));
}

/** Asks the AI to answer the conversation so far and saves the reply. */
export async function requestCoachReply(): Promise<CoachMessage> {
  const stored = await getAiKey();
  if (!stored || !hasConsent('ai_coach')) throw new CoachError('invalid_key', 'AI coach is not set up');
  const setup = buildCoachContext();
  if (!setup) throw new CoachError('bad_response', 'No profile');
  const turns = trimHistory(recentMessages(40).map((m) => ({ role: m.role, text: m.text })));
  if (turns.length === 0) throw new CoachError('bad_response', 'Nothing to answer');
  const actionsOn = getSetting<'confirm' | 'off'>('coachActions', 'confirm') === 'confirm';
  const system = buildSystemPrompt({ ...setup, memory: listMemory().map((m) => m.text), extra: [...extraContext(turns.filter((x) => x.role === 'user').at(-1)?.text ?? ''), ...(actionsOn ? [ACTIONS_PROMPT] : [])] });
  const raw = await withModels(stored, (model, timeoutMs) => generateReply({ apiKey: stored.apiKey, model, system, turns, fetchFn, timeoutMs }));
  const { text: withoutMemory, remember } = extractMemory(raw);
  for (const fact of remember) addMemory(fact);
  const { text, actions } = extractActions(withoutMemory);
  return addMessage('coach', text || withoutMemory || raw, [], actionsOn ? actions.map((action) => ({ action, status: 'proposed' as const })) : []);
}

/** Deletes chat older than the user's retention setting (default 90 days; 0 = keep). */
export function pruneChat(now: Date = new Date()): number {
  const days = getSetting<number>('chatRetentionDays', 90);
  if (!days) return 0;
  return deleteMessagesBefore(new Date(now.getTime() - days * 86400000).toISOString());
}

/** Checks a key with Google, then stores it and records consent. */
export async function connectAi(apiKey: string): Promise<string> {
  const [model] = await refreshModels(apiKey);
  if (!hasConsent('ai_coach')) recordConsent('ai_coach');
  return model!;
}

/** Turns the AI coach off: removes the key and withdraws consent. Chat history stays until cleared. */
export async function disconnectAi(): Promise<void> {
  await deleteAiKey();
  withdrawConsent('ai_coach');
}

export async function aiStatus(): Promise<{ connected: boolean; model: string | null }> {
  const stored = await getAiKey();
  const connected = !!stored && hasConsent('ai_coach');
  return { connected, model: connected ? stored!.model : null };
}
