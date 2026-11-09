import * as Notifications from 'expo-notifications';
import * as HC from 'react-native-health-connect';
import { runStepsCheck, saveStepsSnapshot, setStepsTask } from './background';
import { decideCheckIn, type StepsSnapshot } from './stepsCheck';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

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

const hc = HC as unknown as Record<string, jest.Mock>;
const NOW = new Date(2026, 10, 10, 15, 0);
const snap = (over: Partial<StepsSnapshot> = {}): StepsSnapshot => ({
  day: '2026-11-10',
  checkInAt: new Date(2026, 10, 10, 19, 30).toISOString(),
  otherGaps: ['protein'],
  gaps: ['protein', 'steps'],
  params: { proteinLeft: 30, waterLeft: 0, stepsLeft: 5000 },
  stepGoal: 8000,
  lang: 'en',
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(mockStore)) delete mockStore[k];
  hc.getSdkStatus!.mockResolvedValue(3);
  hc.getGrantedPermissions!.mockResolvedValue([
    { accessType: 'read', recordType: 'Steps' },
    { accessType: 'read', recordType: 'BackgroundAccessPermission' },
  ]);
});

describe('decideCheckIn', () => {
  it('drops steps from the reminder once you catch up', () => {
    expect(decideCheckIn(snap(), 7000, NOW, '2026-11-10')).toEqual({ action: 'update', gaps: ['protein'], params: expect.objectContaining({ stepsLeft: 1000 }) });
  });
  it('cancels the reminder when steps were the only gap', () => {
    expect(decideCheckIn(snap({ otherGaps: [], gaps: ['steps'] }), 6000, NOW, '2026-11-10')).toEqual({ action: 'cancel' });
  });
  it('updates the steps left while still behind', () => {
    const d = decideCheckIn(snap(), 4000, NOW, '2026-11-10');
    expect(d).toEqual({ action: 'update', gaps: ['protein', 'steps'], params: expect.objectContaining({ stepsLeft: 4000 }) });
  });
  it('does nothing when unchanged, after the reminder time, or on another day', () => {
    expect(decideCheckIn(snap(), 3000, NOW, '2026-11-10')).toEqual({ action: 'none' });
    expect(decideCheckIn(snap(), 7000, new Date(2026, 10, 10, 20), '2026-11-10')).toEqual({ action: 'none' });
    expect(decideCheckIn(snap(), 7000, NOW, '2026-11-11')).toEqual({ action: 'none' });
  });
});

describe('runStepsCheck', () => {
  it('reads live steps and cancels the reminder', async () => {
    await saveStepsSnapshot(snap({ otherGaps: [], gaps: ['steps'] }));
    hc.aggregateRecord!.mockResolvedValue({ COUNT_TOTAL: 7600 });
    expect(await runStepsCheck(NOW)).toBe('cancel');
    expect(mockCancel).toHaveBeenCalledWith('smart-checkin');
    expect(await runStepsCheck(NOW)).toBe('none');
  });

  it('rewrites the reminder text with the new number', async () => {
    await saveStepsSnapshot(snap());
    hc.aggregateRecord!.mockResolvedValue({ COUNT_TOTAL: 4000 });
    expect(await runStepsCheck(NOW)).toBe('update');
    const call = mockSchedule.mock.calls[0]![0];
    expect(call.identifier).toBe('smart-checkin');
    expect(call.content.body).toMatch(/4,000|4000/);
    expect(call.trigger.date).toEqual(new Date(2026, 10, 10, 19, 30));
  });

  it('skips without a snapshot or without background access', async () => {
    expect(await runStepsCheck(NOW)).toBe('skipped');
    await saveStepsSnapshot(snap());
    hc.getGrantedPermissions!.mockResolvedValue([{ accessType: 'read', recordType: 'Steps' }]);
    expect(await runStepsCheck(NOW)).toBe('skipped');
    expect(hc.aggregateRecord).not.toHaveBeenCalled();
  });
});

describe('setStepsTask', () => {
  it('registers once and unregisters', async () => {
    await setStepsTask(true);
    expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith('fitmate-steps-check', { minimumInterval: 30 });
    (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValueOnce(true);
    await setStepsTask(false);
    expect(BackgroundTask.unregisterTaskAsync).toHaveBeenCalled();
  });
  it('does nothing when Android restricts background work', async () => {
    (BackgroundTask.getStatusAsync as jest.Mock).mockResolvedValueOnce(1);
    await setStepsTask(true);
    expect(BackgroundTask.registerTaskAsync).not.toHaveBeenCalled();
  });
});
void Notifications;
