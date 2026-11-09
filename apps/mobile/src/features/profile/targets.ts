import { ageFromDateOfBirth, calculateTargets, type BodyProfile, type NutritionTargets } from '@fitmate/core';
import type { ProfileRow } from '../../db/schema';

export function toBodyProfile(p: ProfileRow, today: Date = new Date()): BodyProfile {
  return {
    sex: p.sex,
    ageYears: ageFromDateOfBirth(p.dateOfBirth, today),
    heightCm: p.heightCm,
    weightKg: p.weightKg,
    targetWeightKg: p.targetWeightKg,
    activityLevel: p.activityLevel as BodyProfile['activityLevel'],
    goal: p.goal as BodyProfile['goal'],
    isPregnantOrBreastfeeding: p.isPregnantOrBreastfeeding,
    hasEatingDisorderHistory: p.hasEatingDisorderHistory,
    hasMedicalCondition: p.hasMedicalCondition,
  };
}

export function targetsForProfile(p: ProfileRow, today: Date = new Date()): NutritionTargets {
  return calculateTargets(toBodyProfile(p, today));
}
