import { describe, expect, it } from 'vitest';
import { buildSystemPrompt, extractActions, validateAction, ACTIONS_PROMPT } from './index';

describe('coach actions', () => {
  it('reads a proposed food log and strips the tag', () => {
    const r = extractActions('Nice breakfast! I can log this — tap Confirm below.\n[[action: {"type":"log_food","meal":"breakfast","items":[{"name":"dosa","count":2,"unit":"piece"},{"name":"sambar","count":1,"unit":"katori"}]}]]');
    expect(r.text).toBe('Nice breakfast! I can log this — tap Confirm below.');
    expect(r.actions).toEqual([
      { type: 'log_food', meal: 'breakfast', items: [{ name: 'dosa', count: 2, unit: 'piece' }, { name: 'sambar', count: 1, unit: 'katori' }] },
    ]);
  });

  it('rejects anything outside safe ranges or unknown types', () => {
    expect(validateAction({ type: 'log_water', ml: 9000 })).toBeNull();
    expect(validateAction({ type: 'log_weight', kg: 10 })).toBeNull();
    expect(validateAction({ type: 'log_sleep', bed: '25:00', wake: '06:00' })).toBeNull();
    expect(validateAction({ type: 'run_sql', sql: 'DROP TABLE profile' })).toBeNull();
    expect(validateAction({ type: 'log_food', meal: 'brunch', items: [{ name: 'x' }] })).toBeNull();
    expect(validateAction({ type: 'set_reminder', label: 'Walk', time: '7:05' })).toEqual({ type: 'set_reminder', label: 'Walk', time: '07:05' });
    expect(validateAction({ type: 'log_food', meal: 'lunch', items: [{ name: 'rice', count: 500 }] })).toEqual({ type: 'log_food', meal: 'lunch', items: [{ name: 'rice' }] });
  });

  it('ignores broken tags and caps the number of actions', () => {
    const many = Array.from({ length: 5 }, () => '[[action: {"type":"log_water","ml":250}]]').join('\n');
    expect(extractActions(`ok\n${many}`).actions).toHaveLength(3);
    expect(extractActions('ok [[action: {not json}]]')).toEqual({ text: 'ok', actions: [] });
  });

  it('adds extra blocks to the system prompt', () => {
    const p = buildSystemPrompt({
      context: { today: '2026-11-10', age: 29, sex: 'male', heightCm: 175, weightKg: 86, goal: 'fat_loss', activityLevel: 'light', dietType: 'vegetarian', allergies: [], dislikedFoods: [], workoutPreference: 'home', equipment: [], hasMedicalCondition: false, isPregnantOrBreastfeeding: false, hasEatingDisorderHistory: false, targets: { kcal: 2000, proteinG: 120, waterMl: 3000 } },
      personality: 'friendly',
      language: 'en',
      memory: [],
      extra: [ACTIONS_PROMPT],
    });
    expect(p).toContain('[[action: {...json...}]]');
  });
});
