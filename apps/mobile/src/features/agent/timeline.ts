export type StepKind = 'face' | 'breakfast' | 'lunch' | 'snack' | 'workout' | 'dinner' | 'bed' | 'ai';
export type StepStatus = 'done' | 'next' | 'later' | 'open';

export interface TimelineStep {
  key: string;
  kind: StepKind;
  /** HH:MM */
  time: string;
  status: StepStatus;
  /** AI adjustments only: what the coach changed. */
  lines?: string[];
}

export interface TimelineInput {
  now: Date;
  times: { face: string; breakfast: string; lunch: string; snack: string; workout: string; dinner: string; bed: string };
  done: { face: boolean; breakfast: boolean; lunch: boolean; snack: boolean; workout: boolean; dinner: boolean };
  /** Include the face check-in (only for people who use Face & Skin). */
  withFace: boolean;
  /** Changes the coach made today that you confirmed. */
  adjustments: { at: Date; lines: string[] }[];
}

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
const clock = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Grace period after a planned time before it counts as "still open" rather than coming up. */
export const GRACE_MIN = 90;

/**
 * Today's plan as an ordered timeline. Each planned step is done, "next" (the
 * first one still to do), "later", or "open" (its time passed without being
 * logged — never called missed or failed). Confirmed coach changes appear at
 * the time they were made.
 */
export function buildTimeline(input: TimelineInput): TimelineStep[] {
  const nowMin = input.now.getHours() * 60 + input.now.getMinutes();
  const planned: { kind: Exclude<StepKind, 'ai' | 'bed'>; time: string }[] = [
    ...(input.withFace ? [{ kind: 'face' as const, time: input.times.face }] : []),
    { kind: 'breakfast', time: input.times.breakfast },
    { kind: 'lunch', time: input.times.lunch },
    { kind: 'snack', time: input.times.snack },
    { kind: 'workout', time: input.times.workout },
    { kind: 'dinner', time: input.times.dinner },
  ];
  const steps: TimelineStep[] = planned.map((p) => ({
    key: p.kind,
    kind: p.kind,
    time: p.time,
    status: input.done[p.kind] ? 'done' : nowMin > minutes(p.time) + GRACE_MIN ? 'open' : 'later',
  }));
  steps.push({ key: 'bed', kind: 'bed', time: input.times.bed, status: nowMin >= minutes(input.times.bed) ? 'done' : 'later' });

  const firstLater = steps.find((s) => s.status === 'later');
  if (firstLater) firstLater.status = 'next';

  const ai: TimelineStep[] = input.adjustments.map((a, i) => ({ key: `ai-${i}`, kind: 'ai', time: clock(a.at), status: 'done', lines: a.lines }));
  return [...steps, ...ai].sort((a, b) => minutes(a.time) - minutes(b.time) || (a.kind === 'ai' ? 1 : -1));
}
