import { describe, expect, it } from 'vitest';
import {
  aboutYouSchema,
  backupPasswordSchema,
  bodySchema,
  consentSchema,
  dateOfBirthField,
  foodSchema,
  normaliseDate,
  profileSchema,
  setPinSchema,
} from './index';

const firstMessage = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
  r.error?.issues[0]?.message;

describe('normaliseDate', () => {
  it('accepts Indian and ISO formats', () => {
    expect(normaliseDate('09-11-1996')).toBe('1996-11-09');
    expect(normaliseDate('9/1/1996')).toBe('1996-01-09');
    expect(normaliseDate('1996-11-09')).toBe('1996-11-09');
    expect(normaliseDate('Nov 9 1996')).toBeNull();
  });
});

describe('date of birth', () => {
  const field = dateOfBirthField(() => new Date(2026, 10, 9));
  it('returns ISO for adults', () => {
    expect(field.parse('09-11-1996')).toBe('1996-11-09');
  });
  it('rejects minors with a dedicated message', () => {
    expect(firstMessage(field.safeParse('10-11-2008'))).toBe('errors.minor');
  });
  it('rejects impossible dates', () => {
    expect(firstMessage(field.safeParse('31-02-1990'))).toBe('errors.date');
    expect(firstMessage(field.safeParse(''))).toBe('errors.required');
  });
});

describe('number fields', () => {
  it('parses decimals with a comma or a point', () => {
    const r = bodySchema.parse({ heightCm: '170', weightKg: '72,5', targetWeightKg: '', waistCm: '88.5', hipCm: '' });
    expect(r).toEqual({ heightCm: 170, weightKg: 72.5, targetWeightKg: undefined, waistCm: 88.5, hipCm: undefined });
  });
  it('reports required, non-numbers and ranges', () => {
    expect(firstMessage(bodySchema.safeParse({ heightCm: '', weightKg: '70', targetWeightKg: '', waistCm: '', hipCm: '' }))).toBe('errors.required');
    expect(firstMessage(bodySchema.safeParse({ heightCm: 'abc', weightKg: '70', targetWeightKg: '', waistCm: '', hipCm: '' }))).toBe('errors.number');
    expect(firstMessage(bodySchema.safeParse({ heightCm: '90', weightKg: '70', targetWeightKg: '', waistCm: '', hipCm: '' }))).toBe('errors.min');
    expect(firstMessage(bodySchema.safeParse({ heightCm: '170', weightKg: '70', targetWeightKg: '999', waistCm: '', hipCm: '' }))).toBe('errors.max');
  });
});

describe('lists', () => {
  it('splits, trims and de-duplicates', () => {
    const r = foodSchema.parse({
      dietType: 'vegetarian',
      allergies: 'peanuts, Peanuts ,  milk,,',
      dislikedFoods: '',
      cookingTime: 'under_30',
      budget: 'medium',
    });
    expect(r.allergies).toEqual(['peanuts', 'Peanuts', 'milk']);
    expect(r.dislikedFoods).toEqual([]);
  });
});

describe('profile', () => {
  const valid = {
    name: 'Charan',
    dateOfBirth: '1996-11-09',
    sex: 'male' as const,
    heightCm: '175',
    weightKg: '85',
    targetWeightKg: '75',
    waistCm: '',
    hipCm: '',
    goal: 'fat_loss' as const,
    activityLevel: 'light' as const,
    occupation: '',
    sleepHours: '7',
    workoutPreference: 'home' as const,
    equipment: 'dumbbells',
    coachPersonality: 'strict' as const,
    dietType: 'non_vegetarian' as const,
    allergies: '',
    dislikedFoods: 'bitter gourd',
    cookingTime: 'under_30' as const,
    budget: 'medium' as const,
    isPregnantOrBreastfeeding: false,
    hasEatingDisorderHistory: false,
    hasMedicalCondition: false,
    healthNotes: '',
    injuries: '',
    aiLanguage: 'te' as const,
  };

  it('accepts a full valid profile', () => {
    const p = profileSchema.parse(valid);
    expect(p.weightKg).toBe(85);
    expect(p.equipment).toEqual(['dumbbells']);
    expect(p.occupation).toBeUndefined();
  });

  it('rejects pregnancy flagged for a male profile', () => {
    expect(profileSchema.safeParse({ ...valid, isPregnantOrBreastfeeding: true }).success).toBe(false);
  });

  it('requires a name', () => {
    expect(firstMessage(aboutYouSchema.safeParse({ name: '  ', dateOfBirth: '1990-01-01', sex: 'male' }))).toBe('errors.required');
  });
});

describe('security schemas', () => {
  it('rejects short, weak and mismatched PINs', () => {
    expect(setPinSchema.safeParse({ pin: '482916', confirmPin: '482916' }).success).toBe(true);
    expect(firstMessage(setPinSchema.safeParse({ pin: '12', confirmPin: '12' }))).toBe('errors.pinFormat');
    expect(firstMessage(setPinSchema.safeParse({ pin: '1234', confirmPin: '1234' }))).toBe('errors.pinWeak');
    expect(firstMessage(setPinSchema.safeParse({ pin: '482916', confirmPin: '482917' }))).toBe('errors.pinMismatch');
  });

  it('requires a 10+ character backup password', () => {
    expect(backupPasswordSchema.safeParse({ password: 'short', confirm: 'short' }).success).toBe(false);
    expect(backupPasswordSchema.safeParse({ password: 'long enough pass', confirm: 'long enough pass' }).success).toBe(true);
  });

  it('requires both consent boxes', () => {
    expect(consentSchema.safeParse({ isAdult: true, acceptsPrivacyNotice: true }).success).toBe(true);
    expect(consentSchema.safeParse({ isAdult: true, acceptsPrivacyNotice: false }).success).toBe(false);
  });
});
