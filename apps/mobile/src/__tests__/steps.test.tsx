import { fireEvent, render, screen } from '@testing-library/react-native';
import HealthSettings from '../app/settings/health';
import { StepsCard, StepsWeekCard } from '../features/health/StepsCards';
import i18n from '../i18n';
import { localDate, addDays } from '../lib/time';
import { ThemeProvider } from '../theme/ThemeProvider';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a), back: jest.fn(), canGoBack: () => true } }));
jest.mock('../features/profile/hooks', () => ({ useProfile: () => ({ data: { heightCm: 175, weightKg: 86, activityLevel: 'light' } }) }));

type Day = { day: string; steps: number; source: 'health_connect' | 'manual'; flags: unknown[] };
let mockSettings = { enabled: false, importWeight: true, importSleep: true, lastSync: null as string | null, stepGoal: null as number | null };
let mockDays: Day[] = [];
let mockAvailability = 'available';
const mockSync = jest.fn();
const mockSetManual = jest.fn();
const mockClearManual = jest.fn();
const mockConnect = jest.fn();
let mockConnectData: { steps: boolean } | undefined;
const mockDisconnect = jest.fn();
const mockSetSetting = jest.fn();
jest.mock('../features/health/hooks', () => ({
  useHealthSettings: () => ({ data: mockSettings }),
  useHealthAvailability: () => ({ data: mockAvailability }),
  useStepHistory: () => ({ data: mockDays }),
  useAutoSync: () => ({ mutate: mockSync, isPending: false, data: undefined }),
  useSyncHealth: () => ({ mutate: mockSync, isPending: false, data: { status: 'synced', days: 30, weights: 2, nights: 5 }, isError: false }),
  useManualSteps: () => ({ set: { mutate: mockSetManual }, clear: { mutate: mockClearManual } }),
  useStepGoal: (s: { stepGoal: number | null }) => s?.stepGoal ?? 8000,
  useConnectHealth: () => ({ mutate: mockConnect, isPending: false, data: mockConnectData, isError: false }),
  useDisconnectHealth: () => ({ mutate: mockDisconnect }),
  useSetHealthSetting: () => ({ mutate: mockSetSetting }),
}));
jest.mock('../features/health/healthConnect', () => ({ openHealthSettings: jest.fn() }));

const wrap = (el: React.ReactElement) => render(<ThemeProvider>{el}</ThemeProvider>);
const today = localDate();

beforeEach(async () => {
  jest.clearAllMocks();
  mockSettings = { enabled: false, importWeight: true, importSleep: true, lastSync: null, stepGoal: null };
  mockDays = [];
  mockAvailability = 'available';
  mockConnectData = undefined;
  await i18n.changeLanguage('en');
});

describe('Steps card', () => {
  it('invites connecting and lets you type steps in', async () => {
    await wrap(<StepsCard />);
    expect(screen.getByTestId('steps-today')).toHaveTextContent('0');
    await fireEvent.press(screen.getByTestId('steps-connect'));
    expect(mockPush).toHaveBeenCalledWith('/settings/health');

    await fireEvent.press(screen.getByTestId('steps-enter'));
    await fireEvent.changeText(screen.getByTestId('steps-input'), '6,500');
    await fireEvent.press(screen.getByTestId('steps-save'));
    expect(mockSetManual).toHaveBeenCalledWith({ day: today, steps: 6500 }, expect.anything());
  });

  it('rejects impossible typed values', async () => {
    await wrap(<StepsCard />);
    await fireEvent.press(screen.getByTestId('steps-enter'));
    await fireEvent.changeText(screen.getByTestId('steps-input'), '250000');
    await fireEvent.press(screen.getByTestId('steps-save'));
    expect(mockSetManual).not.toHaveBeenCalled();
  });

  it('shows synced steps with distance, calories and warnings', async () => {
    mockSettings = { ...mockSettings, enabled: true, lastSync: new Date(Date.now() - 12 * 60000).toISOString() };
    mockDays = [{ day: today, steps: 8432, source: 'health_connect', flags: [{ reason: 'too_fast' }] }];
    await wrap(<StepsCard />);
    expect(screen.getByTestId('steps-today')).toHaveTextContent('8,432');
    expect(screen.getByText('About 6.1 km · ~414 kcal')).toBeTruthy();
    expect(screen.getByText(/look unusual/)).toBeTruthy();
    expect(screen.getByTestId('steps-synced')).toHaveTextContent('Synced 12 min ago');
    await fireEvent.press(screen.getByTestId('steps-sync'));
    expect(mockSync).toHaveBeenCalledWith(true);
  });

  it('can switch a typed-in day back to Health Connect', async () => {
    mockSettings = { ...mockSettings, enabled: true };
    mockDays = [{ day: today, steps: 5000, source: 'manual', flags: [] }];
    await wrap(<StepsCard />);
    expect(screen.getByText('You typed this in.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('steps-use-sync'));
    expect(mockClearManual).toHaveBeenCalledWith(today, expect.anything());
  });
});

describe('Steps week card', () => {
  it('shows averages and days at goal', async () => {
    mockDays = [
      { day: addDays(today, -1), steps: 9000, source: 'health_connect', flags: [] },
      { day: today, steps: 5000, source: 'health_connect', flags: [] },
      { day: addDays(today, -20), steps: 4000, source: 'health_connect', flags: [] },
    ];
    await wrap(<StepsWeekCard />);
    expect(screen.getByTestId('steps-avg')).toHaveTextContent('Average 7,000 a day (30 days: 6,000)');
    expect(screen.getByText('Goal of 8,000 reached on 1 of 7 days')).toBeTruthy();
  });

  it('explains when there is no data', async () => {
    await wrap(<StepsWeekCard />);
    expect(screen.getByText(/No steps yet/)).toBeTruthy();
  });
});

describe('Health Connect settings', () => {
  it('connects and shows denial', async () => {
    await wrap(<HealthSettings />);
    await fireEvent.press(screen.getByTestId('hc-connect'));
    expect(mockConnect).toHaveBeenCalled();
    mockConnectData = { steps: false };
    await wrap(<HealthSettings />);
    expect(screen.getByText(/Steps weren’t allowed/)).toBeTruthy();
  });

  it('explains when Health Connect is missing or outdated', async () => {
    mockAvailability = 'unavailable';
    await wrap(<HealthSettings />);
    expect(screen.getByTestId('hc-unavailable')).toBeTruthy();
    mockAvailability = 'update_required';
    await wrap(<HealthSettings />);
    expect(screen.getByTestId('hc-update')).toBeTruthy();
  });

  it('manages sync, imports, goal and disconnect when connected', async () => {
    mockSettings = { ...mockSettings, enabled: true, lastSync: new Date().toISOString() };
    await wrap(<HealthSettings />);
    expect(screen.getByTestId('hc-sync-result')).toHaveTextContent('Updated 30 days of steps, 2 weights and 5 nights of sleep.');
    await fireEvent.press(screen.getByTestId('hc-sync'));
    expect(mockSync).toHaveBeenCalledWith(true);
    await fireEvent(screen.getByTestId('hc-import-sleep'), 'press');
    expect(mockSetSetting).toHaveBeenCalledWith({ key: 'healthImportSleep', value: false });

    await fireEvent.changeText(screen.getByTestId('step-goal'), '500');
    expect(screen.getByText('Enter a number from 1000 to 50000.')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('step-goal'), '10000');
    await fireEvent.press(screen.getByTestId('step-goal-save'));
    expect(mockSetSetting).toHaveBeenCalledWith({ key: 'stepGoal', value: 10000 }, expect.anything());

    await fireEvent.press(screen.getByTestId('hc-disconnect'));
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
