import { dayCardFor, eveningReview, type DayFacts } from './daySummary';

const base: DayFacts = {
  kcal: 1900, kcalTarget: 2000, proteinG: 125, proteinTarget: 130, foodEntries: 5,
  waterMl: 2900, waterTarget: 3000, steps: 9000, stepGoal: 8000, workoutDone: true,
  sleepMin: 450, faceCheckedIn: null, gentle: false,
};

describe('day summary', () => {
  it('celebrates a good day', () => {
    expect(eveningReview(base)).toEqual({ wins: ['logged', 'protein', 'calories', 'water', 'steps', 'workout', 'sleep'], next: [] });
  });

  it('suggests at most three next steps', () => {
    const r = eveningReview({ ...base, foodEntries: 0, kcal: 0, proteinG: 0, waterMl: 800, steps: 2000, workoutDone: false, sleepMin: 300, faceCheckedIn: false });
    expect(r.wins).toEqual([]);
    expect(r.next).toEqual(['logFood', 'water', 'steps']);
  });

  it('never mentions protein or calories with eating-disorder history', () => {
    const r = eveningReview({ ...base, gentle: true, proteinG: 10 });
    expect(r.wins).not.toContain('protein');
    expect(r.wins).not.toContain('calories');
    expect(r.next).not.toContain('protein');
  });

  it('does not treat missing data as zero', () => {
    const r = eveningReview({ ...base, steps: null, sleepMin: null, workoutDone: true });
    expect(r.wins).not.toContain('steps');
    expect(r.next).not.toContain('steps');
    expect(r.next).not.toContain('sleepEarly');
  });

  it('shows the plan in the morning and the review in the evening', () => {
    expect(dayCardFor(new Date(2026, 10, 10, 7))).toBe('briefing');
    expect(dayCardFor(new Date(2026, 10, 10, 16))).toBe('none');
    expect(dayCardFor(new Date(2026, 10, 10, 20))).toBe('review');
    expect(dayCardFor(new Date(2026, 10, 10, 2))).toBe('none'); // a new day has nothing to review yet
  });
});
