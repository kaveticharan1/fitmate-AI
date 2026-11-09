import * as HC from 'react-native-health-connect';
import { connectHealth, healthAvailability, syncHealth } from './healthConnect';

const hc = HC as unknown as Record<string, jest.Mock>;

const mockSettings: Record<string, unknown> = {};
const mockLogWeight = jest.fn();
jest.mock('../../db/repositories', () => ({
  getSetting: (k: string, fallback: unknown) => (k in mockSettings ? mockSettings[k] : fallback),
  setSetting: (k: string, v: unknown) => {
    mockSettings[k] = v;
  },
  logWeight: (kg: number, day: string) => mockLogWeight(kg, day),
}));

const mockSaved: { day: string; steps: number; flags?: unknown[] }[][] = [];
const mockWeightDays = new Set<string>();
const mockSleep: unknown[][] = [];
jest.mock('../../db/stepsRepo', () => ({
  saveSyncedSteps: (days: { day: string; steps: number }[]) => {
    mockSaved.push(days);
    return days.length;
  },
  hasWeightOn: (day: string) => mockWeightDays.has(day),
  addSleepIfMissing: (...a: unknown[]) => {
    mockSleep.push(a);
    return true;
  },
}));

// Local times, so the test works in any time zone.
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).toISOString();
const NOW = new Date(2026, 10, 9, 20, 0);
const ALL = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'Weight' },
  { accessType: 'read', recordType: 'SleepSession' },
];

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(mockSettings)) delete mockSettings[k];
  mockSaved.length = 0;
  mockSleep.length = 0;
  mockWeightDays.clear();
  mockSettings.healthEnabled = true;
  hc.getSdkStatus!.mockResolvedValue(3);
  hc.getGrantedPermissions!.mockResolvedValue(ALL);
  hc.aggregateGroupByPeriod!.mockResolvedValue([
    { startTime: '2026-11-08T00:00', endTime: '2026-11-09T00:00', result: { COUNT_TOTAL: 9100 } },
    { startTime: '2026-11-09T00:00', endTime: '2026-11-10T00:00', result: { COUNT_TOTAL: 4321 } },
    { startTime: '2026-11-07T00:00', endTime: '2026-11-08T00:00', result: { COUNT_TOTAL: 0 } },
  ]);
  hc.readRecords!.mockImplementation(async (type: string) => {
    if (type === 'Steps')
      return {
        records: [
          { startTime: at(9, 8), endTime: at(9, 8, 30), count: 3300, metadata: { dataOrigin: 'phone' } },
          { startTime: at(9, 12), endTime: at(9, 12, 5), count: 2000, metadata: { dataOrigin: 'shaky.app' } }, // 400/min
        ],
      };
    if (type === 'Weight')
      return {
        records: [
          { time: at(8, 7), weight: { inKilograms: 85.94 }, metadata: { dataOrigin: 'scale.app' } },
          { time: at(8, 21), weight: { inKilograms: 86.4 }, metadata: { dataOrigin: 'scale.app' } },
          { time: at(7, 7), weight: { inKilograms: 86.8 }, metadata: { dataOrigin: 'scale.app' } },
          { time: at(9, 7), weight: { inKilograms: 85.0 }, metadata: { dataOrigin: 'com.kaveticharan.fitmate' } },
        ],
      };
    return {
      records: [
        { startTime: at(8, 23, 10), endTime: at(9, 6, 20) },
        { startTime: at(9, 14), endTime: at(9, 14, 30) }, // 30-minute nap: skipped
      ],
    };
  });
});

describe('Health Connect sync', () => {
  it('reports availability', async () => {
    expect(await healthAvailability()).toBe('available');
    hc.getSdkStatus!.mockResolvedValue(2);
    expect(await healthAvailability()).toBe('update_required');
    hc.getSdkStatus!.mockRejectedValue(new Error('no module'));
    expect(await healthAvailability()).toBe('unavailable');
  });

  it('saves daily steps and flags impossible records', async () => {
    const r = await syncHealth({ now: NOW });
    expect(r.status).toBe('synced');
    const saved = mockSaved[0]!;
    expect(saved.map((d) => [d.day, d.steps])).toEqual([
      ['2026-11-08', 9100],
      ['2026-11-09', 4321],
    ]);
    expect(saved[1]!.flags).toEqual([expect.objectContaining({ reason: 'too_fast', origin: 'shaky.app' })]);
    expect(mockSettings.healthLastSync).toBe(NOW.toISOString());

    const call = hc.aggregateGroupByPeriod!.mock.calls[0]![0];
    expect(call.timeRangeSlicer).toEqual({ period: 'DAYS', length: 1 });
    expect(call.timeRangeFilter.startTime).toBe(new Date(2026, 9, 11).toISOString()); // 30 days incl. today
  });

  it('imports other apps’ weights (latest per day) without overwriting logged days', async () => {
    mockWeightDays.add('2026-11-07');
    const r = await syncHealth({ now: NOW });
    expect(mockLogWeight.mock.calls).toEqual([[86.4, '2026-11-08']]);
    expect(r.weights).toBe(1);
  });

  it('imports nights of sleep, skipping naps', async () => {
    const r = await syncHealth({ now: NOW });
    expect(mockSleep).toEqual([['2026-11-09', '23:10', '06:20', 430]]);
    expect(r.nights).toBe(1);
  });

  it('respects the import switches and missing permissions', async () => {
    mockSettings.healthImportWeight = false;
    hc.getGrantedPermissions!.mockResolvedValue([ALL[0]]);
    await syncHealth({ now: NOW });
    expect(mockLogWeight).not.toHaveBeenCalled();
    expect(mockSleep).toEqual([]);
  });

  it('does nothing when off, throttled, unavailable or not allowed', async () => {
    mockSettings.healthEnabled = false;
    expect((await syncHealth({ now: NOW })).status).toBe('disabled');
    mockSettings.healthEnabled = true;
    mockSettings.healthLastSync = new Date(NOW.getTime() - 60_000).toISOString();
    expect((await syncHealth({ now: NOW })).status).toBe('skipped');
    expect((await syncHealth({ now: NOW, force: true })).status).toBe('synced');
    hc.getSdkStatus!.mockResolvedValue(1);
    expect((await syncHealth({ now: NOW, force: true })).status).toBe('unavailable');
    hc.getSdkStatus!.mockResolvedValue(3);
    hc.getGrantedPermissions!.mockResolvedValue([]);
    expect((await syncHealth({ now: NOW, force: true })).status).toBe('no_permission');
  });

  it('turns syncing on only when steps are allowed', async () => {
    mockSettings.healthEnabled = false;
    hc.requestPermission!.mockResolvedValue([ALL[1]]);
    expect(await connectHealth()).toEqual({ steps: false, weight: true, sleep: false });
    expect(mockSettings.healthEnabled).toBe(false);
    hc.requestPermission!.mockResolvedValue(ALL);
    expect((await connectHealth()).steps).toBe(true);
    expect(mockSettings.healthEnabled).toBe(true);
    expect(hc.requestPermission!.mock.calls[1]![0]).toEqual(ALL);
  });
});
