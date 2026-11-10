import { buildTimeline, type TimelineInput } from './timeline';

const base = (over: Partial<TimelineInput> = {}): TimelineInput => ({
  now: new Date(2026, 10, 10, 14, 0),
  times: { face: '08:15', breakfast: '08:30', lunch: '13:30', snack: '17:00', workout: '18:00', dinner: '20:30', bed: '22:30' },
  done: { face: true, breakfast: true, lunch: false, snack: false, workout: false, dinner: false },
  withFace: true,
  adjustments: [],
  ...over,
});
const status = (s: ReturnType<typeof buildTimeline>) => Object.fromEntries(s.map((x) => [x.key, x.status]));

describe('buildTimeline', () => {
  it('marks done, the next step, and later ones in time order', () => {
    const s = buildTimeline(base());
    expect(s.map((x) => x.key)).toEqual(['face', 'breakfast', 'lunch', 'snack', 'workout', 'dinner', 'bed']);
    expect(status(s)).toMatchObject({ face: 'done', breakfast: 'done', lunch: 'next', snack: 'later', bed: 'later' });
  });

  it('calls a step "still open" only after the grace period, never missed', () => {
    const s = buildTimeline(base({ now: new Date(2026, 10, 10, 15, 30) }));
    expect(status(s)).toMatchObject({ lunch: 'open', snack: 'next' });
  });

  it('places coach adjustments at the time they were made', () => {
    const s = buildTimeline(base({ adjustments: [{ at: new Date(2026, 10, 10, 12, 5), lines: ['Add 500 ml of water today'] }] }));
    const ai = s.findIndex((x) => x.kind === 'ai');
    expect(s[ai - 1]!.key).toBe('breakfast');
    expect(s[ai]).toMatchObject({ time: '12:05', status: 'done', lines: ['Add 500 ml of water today'] });
  });

  it('skips the face check-in for people who do not use it, and has no "next" late at night', () => {
    const s = buildTimeline(base({ withFace: false, now: new Date(2026, 10, 10, 23, 0) }));
    expect(s.some((x) => x.kind === 'face')).toBe(false);
    expect(s.some((x) => x.status === 'next')).toBe(false);
    expect(status(s).bed).toBe('done');
  });
});
