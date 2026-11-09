import { ageFromDateOfBirth, MIN_AGE_YEARS } from '@fitmate/core';
import { z } from 'zod';
import { commaList, ERR, optionalNumber, optionalText, requiredNumber } from './fields';

export const SEXES = ['male', 'female', 'unspecified'] as const;
export const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'very_active'] as const;
export const GOALS = ['fat_loss', 'maintain', 'muscle_gain', 'general_fitness', 'activity_habits'] as const;
export const DIET_TYPES = ['vegetarian', 'eggetarian', 'non_vegetarian', 'vegan'] as const;
export const COOKING_TIME = ['none', 'under_15', 'under_30', 'over_30'] as const;
export const BUDGETS = ['low', 'medium', 'high'] as const;
export const COACH_PERSONALITIES = ['friendly', 'strict', 'trainer', 'motivational', 'military'] as const;
export const WORKOUT_PREFERENCES = ['none', 'walking', 'home', 'gym', 'mixed'] as const;
export const LANGUAGES = ['en', 'te'] as const;

/**
 * Converts a typed date (DD-MM-YYYY, DD/MM/YYYY or YYYY-MM-DD) to ISO YYYY-MM-DD.
 * Returns null when the text isn't in one of those shapes.
 */
export function normaliseDate(input: string): string | null {
  const s = input.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return `${m[1]}-${m[2]!.padStart(2, '0')}-${m[3]!.padStart(2, '0')}`;
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  return null;
}

/** Date of birth typed by the user → ISO date; the person must be an adult. */
export const dateOfBirthField = (today: () => Date = () => new Date()) =>
  z
    .string()
    .trim()
    .min(1, ERR.required)
    .transform((v, ctx) => {
      const iso = normaliseDate(v);
      if (!iso) {
        ctx.addIssue({ code: 'custom', message: ERR.date });
        return z.NEVER;
      }
      let age: number;
      try {
        age = ageFromDateOfBirth(iso, today());
      } catch {
        ctx.addIssue({ code: 'custom', message: ERR.date });
        return z.NEVER;
      }
      if (age < MIN_AGE_YEARS) {
        ctx.addIssue({ code: 'custom', message: ERR.minor });
        return z.NEVER;
      }
      if (age > 100) {
        ctx.addIssue({ code: 'custom', message: ERR.date });
        return z.NEVER;
      }
      return iso;
    });

export const aboutYouSchema = z.object({
  name: z.string().trim().min(1, ERR.required).max(50, ERR.tooLong),
  dateOfBirth: dateOfBirthField(),
  sex: z.enum(SEXES),
});

export const bodySchema = z.object({
  heightCm: requiredNumber(100, 250),
  weightKg: requiredNumber(25, 350),
  targetWeightKg: optionalNumber(25, 350),
  waistCm: optionalNumber(40, 250),
  hipCm: optionalNumber(40, 250),
});

export const goalSchema = z.object({
  goal: z.enum(GOALS),
  activityLevel: z.enum(ACTIVITY_LEVELS),
  occupation: optionalText(80),
  sleepHours: optionalNumber(3, 14),
  workoutPreference: z.enum(WORKOUT_PREFERENCES),
  equipment: commaList(),
  coachPersonality: z.enum(COACH_PERSONALITIES),
});

export const foodSchema = z.object({
  dietType: z.enum(DIET_TYPES),
  allergies: commaList(),
  dislikedFoods: commaList(),
  cookingTime: z.enum(COOKING_TIME),
  budget: z.enum(BUDGETS),
});

export const healthSchema = z.object({
  isPregnantOrBreastfeeding: z.boolean(),
  hasEatingDisorderHistory: z.boolean(),
  hasMedicalCondition: z.boolean(),
  healthNotes: optionalText(300),
  injuries: optionalText(300),
  aiLanguage: z.enum(LANGUAGES),
});

/** The whole profile, as saved after onboarding or editing. */
export const profileSchema = aboutYouSchema
  .extend(bodySchema.shape)
  .extend(goalSchema.shape)
  .extend(foodSchema.shape)
  .extend(healthSchema.shape)
  .superRefine((p, ctx) => {
    if (p.sex === 'male' && p.isPregnantOrBreastfeeding) {
      ctx.addIssue({ code: 'custom', path: ['isPregnantOrBreastfeeding'], message: 'errors.invalid' });
    }
  });

export type ProfileInput = z.input<typeof profileSchema>;
export type Profile = z.output<typeof profileSchema>;

/** Onboarding steps in order, with the fields each one owns. */
export const ONBOARDING_STEPS = [
  { key: 'about', schema: aboutYouSchema },
  { key: 'body', schema: bodySchema },
  { key: 'goal', schema: goalSchema },
  { key: 'food', schema: foodSchema },
  { key: 'health', schema: healthSchema },
] as const;
