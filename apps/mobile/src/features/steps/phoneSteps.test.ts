import { PermissionsAndroid, Platform } from 'react-native';
import { getStepSource, loadLedger, recordReading, requestActivityPermission, syncPhoneSteps } from './phoneSteps';

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
let mockTotal: { total: number; bootMs: number } | null = null;
let mockSensor = true;
jest.mock('../../../modules/fitmate-steps', () => ({
  FitmateSteps: {
    isAvailable: () => mockSensor,
    readTotal: async () => mockTotal,
    startWatching: () => true,
    stopWatching: () => undefined,
    addListener: () => ({ remove: () => undefined }),
  },
}));
const mockSettings: Record<string, unknown> = {};
jest.mock('../../db/repositories', () => ({
  getSetting: (k: string, d: unknown) => (k in mockSettings ? mockSettings[k] : d),
  setSetting: (k: string, v: unknown) => {
    mockSettings[k] = v;
  },
}));
const mockSave = jest.fn((_days: unknown[], _src?: string) => 1);
const mockSaveHours = jest.fn();
jest.mock('../../db/stepsRepo', () => ({ saveSyncedSteps: (d: unknown[], s?: string) => mockSave(d, s), saveStepHours: (h: unknown) => mockSaveHours(h) }));

const boot = new Date(2026, 10, 1, 6).getTime();
let check: jest.SpyInstance;

beforeEach(() => {
  for (const k of Object.keys(mockStore)) delete mockStore[k];
  for (const k of Object.keys(mockSettings)) delete mockSettings[k];
  mockSensor = true;
  mockTotal = null;
  jest.clearAllMocks();
  Object.defineProperty(Platform, 'OS', { get: () => 'android', configurable: true });
  Object.defineProperty(Platform, 'Version', { get: () => 34, configurable: true });
  check = jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true);
});

describe('phone step counting', () => {
  it('is the default source when the phone has a step sensor', () => {
    expect(getStepSource()).toBe('phone');
    mockSensor = false;
    expect(getStepSource()).toBe('health_connect');
    mockSettings.stepSource = 'health_connect';
    mockSensor = true;
    expect(getStepSource()).toBe('health_connect');
  });

  it('records readings into the ledger and saves days as the phone source', async () => {
    mockTotal = { total: 10000, bootMs: boot };
    await recordReading(undefined, new Date(2026, 10, 10, 8).getTime());
    mockTotal = { total: 12345, bootMs: boot };
    await recordReading(undefined, new Date(2026, 10, 10, 9).getTime());
    expect((await loadLedger()).days['2026-11-10']).toBe(2345);
    mockTotal = { total: 12400, bootMs: boot };
    await syncPhoneSteps(new Date(2026, 10, 10, 9, 1));
    expect(mockSave).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ day: '2026-11-10' })]), 'phone');
    expect(mockSaveHours).toHaveBeenCalledWith(expect.objectContaining({ '2026-11-10T08': 2345, '2026-11-10T09': 55 }));
  });

  it('applies live readings in order, never losing one', async () => {
    mockTotal = { total: 100, bootMs: boot };
    await recordReading(undefined, Date.now() - 60000);
    await Promise.all([101, 102, 103, 104, 105].map((n, i) => recordReading({ total: n, bootMs: boot }, Date.now() - 50000 + i * 1000)));
    const l = await loadLedger();
    expect(l.lastTotal).toBe(105);
    expect(Object.values(l.days).reduce((a, b) => a + b, 0)).toBe(5);
  });

  it('does nothing without the permission or a sensor', async () => {
    check.mockResolvedValue(false);
    expect(await recordReading()).toBeNull();
    check.mockResolvedValue(true);
    mockSensor = false;
    expect(await recordReading()).toBeNull();
    expect(mockStore).toEqual({});
  });

  it('keeps the old count if the sensor gives no reading in time', async () => {
    mockTotal = { total: 500, bootMs: boot };
    await recordReading(undefined, Date.now() - 1000);
    mockTotal = null;
    expect((await recordReading())?.lastTotal).toBe(500);
  });

  it('does not save anything when Health Connect is the chosen source', async () => {
    mockSettings.stepSource = 'health_connect';
    mockTotal = { total: 900, bootMs: boot };
    expect(await syncPhoneSteps()).toBeNull();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('asks for the permission once and reports a refusal', async () => {
    check.mockResolvedValue(false);
    const req = jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);
    expect(await requestActivityPermission()).toBe(false);
    req.mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
    expect(await requestActivityPermission()).toBe(true);
  });
});
