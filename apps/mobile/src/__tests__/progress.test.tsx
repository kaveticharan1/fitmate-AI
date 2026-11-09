import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import Progress from '../app/(tabs)/progress';
import Report from '../app/report';
import i18n from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';

let mockWeights: { date: string; value: number }[] = [];
const mockLogWaist = jest.fn();
jest.mock('../features/health/hooks', () => ({
  useHealthSettings: () => ({ data: { enabled: false, importWeight: true, importSleep: true, lastSync: null, stepGoal: null } }),
  useStepHistory: () => ({ data: [] }),
  useAutoSync: () => ({ mutate: jest.fn(), isPending: false, data: undefined }),
  useManualSteps: () => ({ set: { mutate: jest.fn() }, clear: { mutate: jest.fn() } }),
  useStepGoal: () => 8000,
}));
jest.mock('../features/progress/hooks', () => ({
  useWeightHistory: () => ({ data: mockWeights }),
  useWaistHistory: () => ({ data: [{ date: '2026-11-01', value: 96 }, { date: '2026-11-08', value: 94.5 }] }),
  useWeekFood: () => ({ data: [{ date: '2026-11-08', kcal: 1750, protein: 115 }, { date: '2026-11-09', kcal: 2300, protein: 70 }] }),
  useLogMeasurements: () => ({ mutateAsync: async (v: unknown) => mockLogWaist(v), isPending: false, isError: false }),
  useMeasurementHistory: () => ({ data: [{ date: '2026-11-01', waist: 96, hip: 104, chest: null, arm: null }, { date: '2026-11-08', waist: 94.5, hip: 103, chest: 101, arm: null }] }),
  useSleepHistory: () => ({ data: [{ wokeOn: '2026-11-08', minutes: 400, bedTime: '23:00', wakeTime: '05:40' }, { wokeOn: '2026-11-09', minutes: 440, bedTime: '23:00', wakeTime: '06:20' }] }),
  useLogSleep: () => ({ mutateAsync: async (v: unknown) => mockLogSleep(v), isPending: false }),
  useHabits: () => ({ data: mockHabits }),
  useHabitActions: () => ({ add: { mutateAsync: async (v: string) => mockAddHabit(v) }, remove: { mutate: jest.fn() }, toggle: { mutate: mockToggle } }),
  useWaterHistory: () => ({ data: [{ date: '2026-11-09', ml: 2000 }, { date: '2026-11-08', ml: 3000 }] }),
  useFoodHistory: () => ({ data: [{ date: '2026-11-08', kcal: 1750, protein: 115 }, { date: '2026-11-09', kcal: 2300, protein: 70 }] }),
}));
const mockLogSleep = jest.fn();
const mockAddHabit = jest.fn();
const mockToggle = jest.fn();
let mockHabits: { id: string; name: string; doneDates: string[] }[] = [];
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true } }));
jest.mock('../features/profile/hooks', () => ({ useProfile: () => ({ data: { targetWeightKg: 75 } }) }));
jest.mock('../features/food/hooks', () => ({ useTargets: () => ({ targetKcal: 1800, proteinG: 120, waterMl: 3000 }) }));

beforeEach(async () => {
  jest.clearAllMocks();
  mockWeights = [];
  mockHabits = [];
  await i18n.changeLanguage('en');
});

const wrap = () => render(<ThemeProvider><Progress /></ThemeProvider>);

describe('Progress', () => {
  it('asks for weigh-ins when there is no data', async () => {
    await wrap();
    expect(screen.getByText(/Log your weight on the Home tab/)).toBeTruthy();
  });

  it('shows the weekly weight trend', async () => {
    mockWeights = Array.from({ length: 4 }, (_, i) => ({ date: `2026-11-${String(1 + i * 7).padStart(2, '0')}`, value: 86 - 0.5 * i }));
    await wrap();
    expect(screen.getByTestId('weight-rate')).toHaveTextContent('Losing about 0.5 kg a week');
  });

  it('summarises the week from logged days only', async () => {
    await wrap();
    expect(screen.getByText('Food logged on 2 of 7 days')).toBeTruthy();
    expect(screen.getByText('Average 2025 kcal a day (target 1800)')).toBeTruthy();
    expect(screen.getByText(/Calories on target 1 days, protein met 1 days/)).toBeTruthy();
  });

  it('shows measurement changes and saves any combination', async () => {
    await wrap();
    expect(screen.getByTestId('change-waist')).toHaveTextContent('Waist: 96 → 94.5 cm (-1.5 cm)');
    expect(screen.getByTestId('change-chest')).toHaveTextContent('Chest: 101 cm');
    await fireEvent.press(screen.getByTestId('measure-save'));
    expect(screen.getByText('Enter at least one measurement')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('measure-arm'), '5');
    await fireEvent.press(screen.getByTestId('measure-save'));
    expect(screen.getByText('Must be at least 10')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('measure-arm'), '33');
    await fireEvent.changeText(screen.getByTestId('measure-waist'), '93.5');
    await fireEvent.press(screen.getByTestId('measure-save'));
    await waitFor(() => expect(mockLogWaist).toHaveBeenCalledWith({ waistCm: 93.5, armCm: 33 }));
  });

  it('validates and saves last night’s sleep', async () => {
    await wrap();
    expect(screen.getByTestId('sleep-avg')).toHaveTextContent('Avg 7h 00m (2 nights)');
    await fireEvent.changeText(screen.getByTestId('sleep-bed'), '11pm');
    await fireEvent.press(screen.getByTestId('sleep-save'));
    expect(screen.getByText('Use HH:MM, e.g. 08:30')).toBeTruthy();
    expect(mockLogSleep).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId('sleep-bed'), '23:15');
    await fireEvent.changeText(screen.getByTestId('sleep-wake'), '06:30');
    await fireEvent.press(screen.getByTestId('sleep-save'));
    await waitFor(() => expect(mockLogSleep).toHaveBeenCalledWith({ bed: '23:15', wake: '06:30' }));
  });

  it('adds habits and ticks them off', async () => {
    mockHabits = [{ id: 'h1', name: 'Walk 30 min', doneDates: [] }];
    await wrap();
    await fireEvent.press(screen.getByTestId('habit-Walk 30 min'));
    expect(mockToggle).toHaveBeenCalledWith({ id: 'h1', done: true });
    await fireEvent.changeText(screen.getByTestId('habit-name'), 'No sugar');
    await fireEvent.press(screen.getByTestId('habit-add'));
    await waitFor(() => expect(mockAddHabit).toHaveBeenCalledWith('No sugar'));
  });
});

describe('Report', () => {
  it('summarises calories, water, sleep and habits', async () => {
    mockHabits = [{ id: 'h1', name: 'Walk', doneDates: [] }];
    await render(<ThemeProvider><Report /></ThemeProvider>);
    expect(screen.getByText('2025 / 1800 kcal')).toBeTruthy();
    expect(screen.getByText('2.5 L / 3.0 L')).toBeTruthy();
    expect(screen.getByText('0%')).toBeTruthy();
  });
});
