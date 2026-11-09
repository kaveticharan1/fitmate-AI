import i18n from '../../i18n';
import { applyReminders, applySmart } from './notifications';
import { DEFAULT_REMINDERS } from './schedule';
import type { SmartNudge } from './smart';
import { smartText } from './smartSync';

let mockScheduled: { identifier: string }[] = [];
let mockGranted = true;
const mockCancel = jest.fn();
const mockSchedule = jest.fn();
jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  AndroidNotificationVisibility: { PRIVATE: 0 },
  SchedulableTriggerInputTypes: { DAILY: 'daily', WEEKLY: 'weekly', DATE: 'date' },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: async () => ({ granted: mockGranted }),
  requestPermissionsAsync: async () => ({ granted: mockGranted }),
  getAllScheduledNotificationsAsync: async () => mockScheduled,
  cancelScheduledNotificationAsync: async (id: string) => mockCancel(id),
  scheduleNotificationAsync: async (r: unknown) => mockSchedule(r),
}));
jest.mock('../../db/repositories', () => ({ getSetting: (_k: string, d: unknown) => d }));

const nudges: SmartNudge[] = [
  { id: 'smart-checkin', kind: 'checkIn', when: { date: new Date(2026, 10, 10, 19, 30) }, gaps: ['protein', 'water'], generic: false, params: { proteinLeft: 78, waterLeft: 6, stepsLeft: 0 } },
  { id: 'smart-morning', kind: 'morning', when: { daily: { hour: 8, minute: 0 } } },
  { id: 'smart-weighin', kind: 'weighIn', when: { weekly: { weekday: 1, hour: 7, minute: 30 } } },
];
const text = () => ({ title: 'T', body: 'B' });

beforeEach(async () => {
  jest.clearAllMocks();
  mockScheduled = [{ identifier: 'water-8' }, { identifier: 'med-1' }, { identifier: 'smart-checkin' }];
  mockGranted = true;
  await i18n.changeLanguage('en');
});

describe('smart notifications', () => {
  it('replace only the smart ones, with the right triggers', async () => {
    expect(await applySmart(nudges, text, { askPermission: false })).toBe(3);
    expect(mockCancel.mock.calls.map((c) => c[0])).toEqual(['smart-checkin']);
    const triggers = mockSchedule.mock.calls.map((c) => c[0].trigger);
    expect(triggers[0]).toEqual({ type: 'date', date: new Date(2026, 10, 10, 19, 30), channelId: 'reminders' });
    expect(triggers[1]).toEqual({ type: 'daily', hour: 8, minute: 0, channelId: 'reminders' });
    expect(triggers[2]).toEqual({ type: 'weekly', weekday: 1, hour: 7, minute: 30, channelId: 'reminders' });
  });

  it('never ask for permission during automatic refresh', async () => {
    mockGranted = false;
    expect(await applySmart(nudges, text, { askPermission: false })).toBe(0);
    expect(mockSchedule).not.toHaveBeenCalled();
    await expect(applySmart(nudges, text, { askPermission: true })).rejects.toThrow('permission');
  });

  it('clear smart ones when there is nothing to send', async () => {
    expect(await applySmart([], text, { askPermission: false })).toBe(0);
    expect(mockCancel).toHaveBeenCalledWith('smart-checkin');
  });

  it('water and medicine changes keep the smart ones', async () => {
    await applyReminders({ ...DEFAULT_REMINDERS, water: { enabled: true, startHour: 8, endHour: 9, everyHours: 1 } }, { title: 'FitMate', water: 'Drink', medicine: (n) => n });
    expect(mockCancel.mock.calls.map((c) => c[0])).toEqual(['water-8', 'med-1']);
    expect(mockSchedule).toHaveBeenCalledTimes(2);
  });

  it('write helpful text, and keep it gentle when needed', () => {
    const t = i18n.t.bind(i18n);
    const targets = { proteinG: 138, waterMl: 3000, steps: 8000, gentle: false };
    expect(smartText(t, nudges[0]!, targets)).toEqual({
      title: 'Evening check-in',
      body: '78 g protein to go — curd, dal, eggs or paneer at dinner will help. 6 more glasses of water.',
    });
    expect(smartText(t, nudges[1]!, targets).body).toBe('Today: 138 g protein, 3.0 L water, 8,000 steps. You’ve got this!');
    expect(smartText(t, nudges[1]!, { ...targets, gentle: true }).body).not.toMatch(/protein/);
    expect(smartText(t, { ...nudges[0]!, generic: true, gaps: [] } as SmartNudge, targets).body).toMatch(/How did today go/);
  });
});
