import { describe, expect, it } from 'vitest';
import { averageSteps, daysFromAggregate, defaultStepGoal, stepsToKcal, stepsToKm, validateStepRecords } from './steps';

describe('steps', () => {
  it('sets goals from activity level', () => {
    expect(defaultStepGoal('sedentary')).toBe(6000);
    expect(defaultStepGoal('very_active')).toBe(12000);
    expect(defaultStepGoal('unknown')).toBe(8000);
  });

  it('estimates calories and distance', () => {
    expect(stepsToKcal(10000, 70)).toBe(400);
    expect(stepsToKcal(10000, 86)).toBe(491);
    expect(stepsToKm(10000)).toBe(7.5);
    expect(stepsToKm(10000, 175)).toBe(7.3);
  });

  it('accepts normal walking and running', () => {
    expect(
      validateStepRecords([
        { start: '2026-11-09T06:00:00Z', end: '2026-11-09T06:30:00Z', count: 3300 }, // 110/min walk
        { start: '2026-11-09T07:00:00Z', end: '2026-11-09T07:10:00Z', count: 1700 }, // 170/min run
        { start: '2026-11-09T08:00:00Z', end: '2026-11-09T08:00:30Z', count: 60 },
      ]),
    ).toEqual([]);
  });

  it('flags impossible cadence, bursts and huge days', () => {
    const flags = validateStepRecords(
      [
        { start: '2026-11-09T10:00:00Z', end: '2026-11-09T10:10:00Z', count: 4000, origin: 'shaker' }, // 400/min
        { start: '2026-11-09T11:00:00Z', end: '2026-11-09T11:01:00Z', count: 900 },
        { start: '2026-11-09T12:00:00Z', end: '2026-11-09T12:00:00Z', count: 2000 },
      ],
      75000,
    );
    expect(flags.map((f) => f.reason)).toEqual(['too_fast', 'burst', 'burst', 'daily_total']);
    expect(flags[0]!.origin).toBe('shaker');
  });

  it('reads Health Connect daily groups', () => {
    expect(
      daysFromAggregate([
        { startTime: '2026-11-08T00:00', result: { COUNT_TOTAL: 8432.0 } },
        { startTime: '2026-11-09T00:00', result: {} },
      ]),
    ).toEqual([
      { date: '2026-11-08', steps: 8432 },
      { date: '2026-11-09', steps: 0 },
    ]);
  });

  it('averages only days with data', () => {
    expect(averageSteps([{ steps: 8000 }, { steps: 0 }, { steps: 6000 }])).toBe(7000);
    expect(averageSteps([{ steps: 0 }])).toBeNull();
  });
});
