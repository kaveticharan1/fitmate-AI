import { describe, expect, it } from 'vitest';
import {
  ageFromDateOfBirth,
  bmiCategoryAsian,
  bmiCategoryWho,
  calculateBmi,
  calculateBmr,
  calculateTargets,
  calculateWaterMl,
} from './nutrition';
import type { BodyProfile } from './types';

const base: BodyProfile = {
  sex: 'male',
  ageYears: 30,
  heightCm: 175,
  weightKg: 85,
  targetWeightKg: 75,
  activityLevel: 'sedentary',
  goal: 'fat_loss',
};

describe('BMI', () => {
  it('calculates BMI to one decimal', () => {
    expect(calculateBmi(85, 175)).toBe(27.8);
    expect(calculateBmi(70, 160)).toBe(27.3);
  });

  it('uses Asian-Indian cut-offs and WHO cut-offs separately', () => {
    expect(bmiCategoryAsian(22.9)).toBe('normal');
    expect(bmiCategoryAsian(23)).toBe('overweight');
    expect(bmiCategoryAsian(25)).toBe('obese');
    expect(bmiCategoryWho(25)).toBe('overweight');
    expect(bmiCategoryWho(30)).toBe('obese');
    expect(bmiCategoryAsian(18.4)).toBe('underweight');
  });
});

describe('BMR (Mifflin-St Jeor)', () => {
  it('matches the published equation for men and women', () => {
    expect(calculateBmr({ sex: 'male', weightKg: 85, heightCm: 175, ageYears: 30 })).toBe(1798.75);
    expect(calculateBmr({ sex: 'female', weightKg: 70, heightCm: 160, ageYears: 28 })).toBe(1399);
  });

  it('uses the midpoint constant when sex is not given', () => {
    const male = calculateBmr({ sex: 'male', weightKg: 70, heightCm: 170, ageYears: 40 });
    const female = calculateBmr({ sex: 'female', weightKg: 70, heightCm: 170, ageYears: 40 });
    const unspecified = calculateBmr({ sex: 'unspecified', weightKg: 70, heightCm: 170, ageYears: 40 });
    expect(unspecified).toBe((male + female) / 2);
  });
});

describe('calculateTargets', () => {
  it('applies the BMR floor for a sedentary fat-loss profile', () => {
    const t = calculateTargets(base);
    expect(t.bmrKcal).toBe(1799);
    expect(t.maintenanceKcal).toBe(2160);
    // 20% deficit would be 1727 kcal, below BMR (1799), so the floor applies.
    expect(t.targetKcal).toBe(1800);
    expect(t.flags).toContain('floor_applied');
    expect(t.dailyDeltaKcal).toBe(359);
    expect(t.proteinG).toBe(120); // 1.6 g × 75 kg target weight
    expect(t.fatG).toBe(50); // 25% of 1800 / 9
    expect(t.carbsG).toBe(218);
    expect(t.expectedWeeklyChangeKg).toBe(-0.33);
    expect(t.estimatedWeeksToTarget).toBe(31);
    expect(t.bmiCategory).toBe('obese');
    expect(t.bmiCategoryWho).toBe('overweight');
    expect(t.waterMl).toBe(3000);
  });

  it('uses a full 20% deficit when it stays above the floor', () => {
    const t = calculateTargets({ ...base, activityLevel: 'moderate' });
    expect(t.maintenanceKcal).toBe(2790);
    expect(t.targetKcal).toBe(2230);
    expect(t.flags).not.toContain('floor_applied');
    expect(t.expectedWeeklyChangeKg).toBe(-0.51);
  });

  it('never goes below 20% of maintenance or the sex-specific floor', () => {
    const profiles: BodyProfile[] = [
      { ...base, sex: 'female', heightCm: 150, weightKg: 52, targetWeightKg: 48, ageYears: 60 },
      { ...base, sex: 'unspecified', heightCm: 155, weightKg: 60, ageYears: 45 },
      { ...base, weightKg: 140, heightCm: 180, activityLevel: 'very_active' },
    ];
    for (const p of profiles) {
      const t = calculateTargets(p);
      const floor = p.sex === 'male' ? 1500 : p.sex === 'female' ? 1200 : 1350;
      expect(t.targetKcal).toBeGreaterThanOrEqual(Math.min(floor, t.maintenanceKcal) - 5);
      expect(t.targetKcal).toBeGreaterThanOrEqual(Math.round(t.maintenanceKcal * 0.8) - 10);
      expect(t.targetKcal).toBeGreaterThanOrEqual(t.bmrKcal - 5);
    }
  });

  it('macros add up to the calorie target within rounding', () => {
    for (const goal of ['fat_loss', 'maintain', 'muscle_gain', 'general_fitness'] as const) {
      const t = calculateTargets({ ...base, goal });
      const kcal = t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9;
      expect(Math.abs(kcal - t.targetKcal)).toBeLessThanOrEqual(10);
    }
  });

  it('gives no deficit during pregnancy or breastfeeding', () => {
    const t = calculateTargets({ ...base, sex: 'female', isPregnantOrBreastfeeding: true });
    expect(t.targetKcal).toBe(t.maintenanceKcal);
    expect(t.flags).toContain('pregnancy_no_deficit');
    expect(t.expectedWeeklyChangeKg).toBeCloseTo(0, 1);
  });

  it('gives no deficit with an eating-disorder history', () => {
    const t = calculateTargets({ ...base, hasEatingDisorderHistory: true });
    expect(t.targetKcal).toBe(t.maintenanceKcal);
    expect(t.flags).toContain('eating_disorder_no_deficit');
  });

  it('halves the deficit when a medical condition is disclosed', () => {
    const t = calculateTargets({ ...base, activityLevel: 'moderate', hasMedicalCondition: true });
    expect(t.targetKcal).toBe(2510); // 90% of 2788
    expect(t.flags).toContain('medical_gentle_deficit');
  });

  it('refuses a deficit for an underweight BMI', () => {
    const t = calculateTargets({ ...base, sex: 'female', heightCm: 160, weightKg: 45, targetWeightKg: 42 });
    expect(t.bmiCategory).toBe('underweight');
    expect(t.targetKcal).toBe(t.maintenanceKcal);
    expect(t.flags).toContain('underweight_no_deficit');
    expect(t.flags).toContain('target_below_healthy_bmi');
  });

  it('adds a capped surplus for muscle gain', () => {
    const t = calculateTargets({ ...base, goal: 'muscle_gain', targetWeightKg: 90, activityLevel: 'very_active' });
    expect(t.targetKcal - t.maintenanceKcal).toBeLessThanOrEqual(300);
    expect(t.targetKcal).toBeGreaterThan(t.maintenanceKcal);
    expect(t.expectedWeeklyChangeKg).toBeGreaterThan(0);
    expect(t.estimatedWeeksToTarget).not.toBeNull();
    expect(t.proteinG).toBe(136); // 1.6 × 85 kg
  });

  it('uses 1.2 g/kg protein for maintenance', () => {
    const t = calculateTargets({ ...base, goal: 'maintain' });
    expect(t.proteinG).toBe(102);
    expect(t.estimatedWeeksToTarget).toBeNull();
  });

  it('rejects minors and impossible values', () => {
    expect(() => calculateTargets({ ...base, ageYears: 17 })).toThrow(RangeError);
    expect(() => calculateTargets({ ...base, heightCm: 40 })).toThrow(RangeError);
    expect(() => calculateTargets({ ...base, weightKg: Number.NaN })).toThrow(RangeError);
    expect(() => calculateTargets({ ...base, targetWeightKg: 5 })).toThrow(RangeError);
  });
});

describe('water target', () => {
  it('is 35 ml/kg, rounded and clamped', () => {
    expect(calculateWaterMl(70)).toBe(2500); // 2450 → 2500
    expect(calculateWaterMl(30)).toBe(1500);
    expect(calculateWaterMl(200)).toBe(4000);
  });
});

describe('ageFromDateOfBirth', () => {
  const today = new Date(2026, 10, 9); // 9 Nov 2026, local time

  it('counts whole years', () => {
    expect(ageFromDateOfBirth('1996-11-09', today)).toBe(30);
    expect(ageFromDateOfBirth('1996-11-10', today)).toBe(29);
    expect(ageFromDateOfBirth('2000-02-29', today)).toBe(26);
  });

  it('rejects bad dates', () => {
    expect(() => ageFromDateOfBirth('1996-02-30', today)).toThrow(RangeError);
    expect(() => ageFromDateOfBirth('09-11-1996', today)).toThrow(RangeError);
    expect(() => ageFromDateOfBirth('2030-01-01', today)).toThrow(RangeError);
  });
});
