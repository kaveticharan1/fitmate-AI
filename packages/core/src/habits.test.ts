import { describe, expect, it } from 'vitest';
import { completionRate, forgivingStreak, sleepMinutes } from './habits';

describe('sleepMinutes', () => {
  it('handles crossing midnight and same-day naps', () => {
    expect(sleepMinutes('23:30', '06:30')).toBe(420);
    expect(sleepMinutes('01:00', '07:15')).toBe(375);
    expect(sleepMinutes('14:00', '15:00')).toBe(60);
  });
  it('rejects invalid or zero-length times', () => {
    expect(sleepMinutes('25:00', '06:00')).toBeNull();
    expect(sleepMinutes('7', '06:00')).toBeNull();
    expect(sleepMinutes('06:00', '06:00')).toBeNull();
  });
});

describe('forgivingStreak', () => {
  const today = '2026-11-10';
  it('counts back from today, or from yesterday if today is not done yet', () => {
    expect(forgivingStreak(['2026-11-08', '2026-11-09', '2026-11-10'], today)).toBe(3);
    expect(forgivingStreak(['2026-11-08', '2026-11-09'], today)).toBe(2);
  });
  it('forgives one missed day but not two', () => {
    expect(forgivingStreak(['2026-11-06', '2026-11-07', '2026-11-09', '2026-11-10'], today)).toBe(4);
    expect(forgivingStreak(['2026-11-05', '2026-11-06', '2026-11-09', '2026-11-10'], today)).toBe(2);
  });
  it('is zero with nothing recent', () => {
    expect(forgivingStreak([], today)).toBe(0);
    expect(forgivingStreak(['2026-11-01'], today)).toBe(0);
  });
});

describe('completionRate', () => {
  it('counts distinct days inside the window', () => {
    expect(completionRate(['2026-11-10', '2026-11-09', '2026-11-09', '2026-11-01'], '2026-11-10', 7)).toBeCloseTo(2 / 7);
  });
});
