import type {
  ActivityLevel,
  BmiCategory,
  BodyProfile,
  NutritionTargets,
  SafetyFlag,
  Sex,
} from './types';

/** Standard activity multipliers applied to BMR to estimate maintenance calories. */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
};

/** Never recommend a daily intake below these values (kcal). */
export const CALORIE_FLOORS: Record<Sex, number> = {
  male: 1500,
  female: 1200,
  unspecified: 1350,
};

/** Approximate energy in 1 kg of body fat. */
export const KCAL_PER_KG = 7700;

export const MAX_DEFICIT_FRACTION = 0.2;
export const MEDICAL_MAX_DEFICIT_FRACTION = 0.1;
export const SURPLUS_FRACTION = 0.1;
export const MAX_SURPLUS_KCAL = 300;

export const MIN_AGE_YEARS = 18;

const round = (value: number, decimals = 0) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const roundTo = (value: number, step: number) => Math.round(value / step) * step;

export function assertValidProfile(p: BodyProfile): void {
  if (!Number.isFinite(p.ageYears) || p.ageYears < MIN_AGE_YEARS || p.ageYears > 100) {
    throw new RangeError(`Age must be between ${MIN_AGE_YEARS} and 100 years`);
  }
  if (!Number.isFinite(p.heightCm) || p.heightCm < 100 || p.heightCm > 250) {
    throw new RangeError('Height must be between 100 and 250 cm');
  }
  if (!Number.isFinite(p.weightKg) || p.weightKg < 25 || p.weightKg > 350) {
    throw new RangeError('Weight must be between 25 and 350 kg');
  }
  if (
    p.targetWeightKg != null &&
    (!Number.isFinite(p.targetWeightKg) || p.targetWeightKg < 25 || p.targetWeightKg > 350)
  ) {
    throw new RangeError('Target weight must be between 25 and 350 kg');
  }
}

/** Body mass index, rounded to one decimal. */
export function calculateBmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return round(weightKg / (m * m), 1);
}

/** Asian-Indian cut-offs (Indian consensus guidelines): overweight from 23, obese from 25. */
export function bmiCategoryAsian(bmi: number): BmiCategory {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 23) return 'normal';
  if (bmi < 25) return 'overweight';
  return 'obese';
}

/** WHO international cut-offs: overweight from 25, obese from 30. */
export function bmiCategoryWho(bmi: number): BmiCategory {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  return 'obese';
}

/**
 * Basal metabolic rate by the Mifflin-St Jeor equation (unrounded kcal/day).
 * For 'unspecified' sex the midpoint of the male (+5) and female (−161) constants is used.
 */
export function calculateBmr(
  p: Pick<BodyProfile, 'sex' | 'weightKg' | 'heightCm' | 'ageYears'>,
): number {
  const sexConstant = p.sex === 'male' ? 5 : p.sex === 'female' ? -161 : -78;
  return 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.ageYears + sexConstant;
}

/** Maintenance calories (unrounded) = BMR × activity factor. */
export function calculateMaintenance(p: BodyProfile): number {
  return calculateBmr(p) * ACTIVITY_FACTORS[p.activityLevel];
}

/** Daily water target: 35 ml per kg, rounded to 100 ml, kept within 1.5–4 litres. */
export function calculateWaterMl(weightKg: number): number {
  return Math.min(4000, Math.max(1500, roundTo(weightKg * 35, 100)));
}

/**
 * Calculates estimated daily targets with safety rules applied.
 *
 * All values are estimates. Safety rules, in order:
 * - fat loss uses at most a 20% deficit (10% if a medical condition was disclosed);
 * - no deficit for pregnancy/breastfeeding, eating-disorder history, or an underweight BMI;
 * - intake never goes below the sex-specific floor or the person's BMR, whichever is higher.
 */
export function calculateTargets(p: BodyProfile): NutritionTargets {
  assertValidProfile(p);
  const flags: SafetyFlag[] = [];

  const bmi = calculateBmi(p.weightKg, p.heightCm);
  const category = bmiCategoryAsian(bmi);
  const bmr = calculateBmr(p);
  const maintenance = bmr * ACTIVITY_FACTORS[p.activityLevel];

  let deficitFraction = 0;
  let surplusKcal = 0;

  if (p.goal === 'fat_loss') {
    deficitFraction = MAX_DEFICIT_FRACTION;
    if (p.hasMedicalCondition) {
      deficitFraction = MEDICAL_MAX_DEFICIT_FRACTION;
      flags.push('medical_gentle_deficit');
    }
    if (category === 'underweight') {
      deficitFraction = 0;
      flags.push('underweight_no_deficit');
    }
  } else if (p.goal === 'muscle_gain') {
    surplusKcal = Math.min(maintenance * SURPLUS_FRACTION, MAX_SURPLUS_KCAL);
  }

  if (p.hasEatingDisorderHistory) {
    if (deficitFraction > 0) flags.push('eating_disorder_no_deficit');
    deficitFraction = 0;
  }
  if (p.isPregnantOrBreastfeeding) {
    flags.push('pregnancy_no_deficit');
    deficitFraction = 0;
    surplusKcal = 0;
  }

  let target = maintenance * (1 - deficitFraction) + surplusKcal;

  if (deficitFraction > 0) {
    const floor = Math.min(maintenance, Math.max(CALORIE_FLOORS[p.sex], bmr));
    if (target < floor) {
      target = floor;
      flags.push('floor_applied');
    }
  }

  const targetKcal = roundTo(target, 10);
  const dailyDelta = maintenance - targetKcal;

  // Protein: 1.6 g/kg for fat loss and muscle gain, 1.2 g/kg otherwise.
  const usesHighProtein = p.goal === 'fat_loss' || p.goal === 'muscle_gain';
  const perKg = usesHighProtein ? 1.6 : 1.2;
  const referenceWeight =
    p.goal === 'fat_loss' && p.targetWeightKg != null && p.targetWeightKg < p.weightKg
      ? p.targetWeightKg
      : p.weightKg;
  const proteinCap = (targetKcal * 0.35) / 4;
  const proteinG = Math.round(Math.min(referenceWeight * perKg, proteinCap));
  const fatG = Math.round((targetKcal * 0.25) / 9);
  const carbsG = Math.max(0, Math.round((targetKcal - proteinG * 4 - fatG * 9) / 4));

  const expectedWeeklyChangeKg = round(-(dailyDelta * 7) / KCAL_PER_KG, 2);

  let estimatedWeeksToTarget: number | null = null;
  if (p.targetWeightKg != null) {
    if (calculateBmi(p.targetWeightKg, p.heightCm) < 18.5) {
      flags.push('target_below_healthy_bmi');
    }
    const remaining = p.targetWeightKg - p.weightKg;
    const sameDirection =
      (remaining < 0 && expectedWeeklyChangeKg < 0) || (remaining > 0 && expectedWeeklyChangeKg > 0);
    if (sameDirection) {
      estimatedWeeksToTarget = Math.ceil(Math.abs(remaining / expectedWeeklyChangeKg));
    }
  }

  return {
    bmi,
    bmiCategory: category,
    bmiCategoryWho: bmiCategoryWho(bmi),
    bmrKcal: Math.round(bmr),
    maintenanceKcal: roundTo(maintenance, 10),
    targetKcal,
    dailyDeltaKcal: Math.round(dailyDelta),
    proteinG,
    carbsG,
    fatG,
    waterMl: calculateWaterMl(p.weightKg),
    expectedWeeklyChangeKg,
    estimatedWeeksToTarget,
    flags,
  };
}

/**
 * Whole years between a YYYY-MM-DD date of birth and `today`.
 * Works on calendar dates only, so time zones can't shift the result by a day.
 */
export function ageFromDateOfBirth(dateOfBirth: string, today: Date = new Date()): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
  if (!match) throw new RangeError('Date of birth must be in YYYY-MM-DD format');
  const [, ys, ms, ds] = match;
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    throw new RangeError('Date of birth is not a real calendar date');
  }
  const ty = today.getFullYear();
  const tm = today.getMonth() + 1;
  const td = today.getDate();
  let age = ty - y;
  if (tm < m || (tm === m && td < d)) age -= 1;
  if (age < 0) throw new RangeError('Date of birth is in the future');
  return age;
}
