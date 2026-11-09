export type Sex = 'male' | 'female' | 'unspecified';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very_active';

export type FitnessGoal =
  | 'fat_loss'
  | 'maintain'
  | 'muscle_gain'
  | 'general_fitness'
  | 'activity_habits';

/** Everything the calculator needs. Heights in cm, weights in kg. */
export interface BodyProfile {
  sex: Sex;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  targetWeightKg?: number | null;
  activityLevel: ActivityLevel;
  goal: FitnessGoal;
  /** Health safeguards — all voluntary, default false. */
  isPregnantOrBreastfeeding?: boolean;
  hasEatingDisorderHistory?: boolean;
  hasMedicalCondition?: boolean;
}

export type SafetyFlag =
  /** Pregnancy or breastfeeding: no calorie deficit, see a doctor. */
  | 'pregnancy_no_deficit'
  /** Eating-disorder history: no deficit, encourage professional support. */
  | 'eating_disorder_no_deficit'
  /** A medical condition was disclosed: gentler deficit, consult a doctor. */
  | 'medical_gentle_deficit'
  /** Target raised to the safety floor. */
  | 'floor_applied'
  /** Target weight is below a healthy BMI. */
  | 'target_below_healthy_bmi'
  /** BMI is in the underweight range: fat loss not recommended. */
  | 'underweight_no_deficit';

export type BmiCategory = 'underweight' | 'normal' | 'overweight' | 'obese';

export interface NutritionTargets {
  bmi: number;
  /** Category using Asian-Indian cut-offs (overweight ≥ 23, obese ≥ 25). */
  bmiCategory: BmiCategory;
  /** Category using WHO international cut-offs (overweight ≥ 25, obese ≥ 30). */
  bmiCategoryWho: BmiCategory;
  bmrKcal: number;
  maintenanceKcal: number;
  targetKcal: number;
  /** Positive = deficit, negative = surplus. */
  dailyDeltaKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  waterMl: number;
  /** Expected weekly weight change in kg (negative = loss). Estimate only. */
  expectedWeeklyChangeKg: number;
  /** Rough weeks to reach the target weight, or null if not applicable. */
  estimatedWeeksToTarget: number | null;
  flags: SafetyFlag[];
}
