import { runStepsCheck, saveStepsSnapshot } from './background';
import type { StepsSnapshot } from './stepsCheck';

const mockStore: Record<string, string> = {};
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => mockStore[k] ?? null,
  setItemAsync: async (k: string, v: string) => {
    mockStore[k] = v;
  },
  deleteItemAsync: async (k: string) => {
    delete mockStore[k];
  },
}));
const mockSchedule = jest.fn();
const mockCancel = jest.fn();
jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DATE: 'date' },
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: (...a: unknown[]) => mockSchedule(...a),
  cancelScheduledNotificationAsync: (...a: unknown[]) => mockCancel(...a),
}));
let mockLedger: { days: Record<string, number> } | null = null;
const mockRecord = jest.fn(async () => mockLedger);
jest.mock('../steps/phoneSteps', () => ({ recordReading: () => mockRecord() }));

const NOW = new Date(2026, 10, 10, 15, 0);
const snap: StepsSnapshot = {
  day: '2026-11-10',
  checkInAt: new Date(2026, 10, 10, 19, 30).toISOString(),
  otherGaps: [],
  gaps: ['steps'],
  params: { stepsLeft: 5000 },
  stepGoal: 8000,
  lang: 'en',
  source: 'phone',
};

beforeEach(() => {
  for (const k of Object.keys(mockStore)) delete mockStore[k];
  jest.clearAllMocks();
});

describe('background check with FitMate’s own counter', () => {
  it('records a phone reading on every run, even with no reminder to fix', async () => {
    mockLedger = { days: { '2026-11-10': 1000 } };
    expect(await runStepsCheck(NOW)).toBe('skipped');
    expect(mockRecord).toHaveBeenCalled();
  });

  it('cancels the evening steps nudge once the phone has counted enough', async () => {
    await saveStepsSnapshot(snap);
    mockLedger = { days: { '2026-11-10': 6200 } };
    expect(await runStepsCheck(NOW)).toBe('cancel');
    expect(mockCancel).toHaveBeenCalledWith('smart-checkin');
  });

  it('updates the steps left while still behind', async () => {
    await saveStepsSnapshot(snap);
    mockLedger = { days: { '2026-11-10': 2000 } };
    expect(await runStepsCheck(NOW)).toBe('update');
    expect(mockSchedule.mock.calls[0]![0].content.body).toMatch(/6,000|6000/);
  });

  it('skips when the phone can’t count (no permission or sensor)', async () => {
    await saveStepsSnapshot(snap);
    mockLedger = null;
    expect(await runStepsCheck(NOW)).toBe('skipped');
  });
});
