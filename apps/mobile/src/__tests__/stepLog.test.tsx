import { fireEvent, render, screen } from '@testing-library/react-native';
import StepLog from '../app/steps';
import i18n from '../i18n';
import { localDate } from '../lib/time';
import { ThemeProvider } from '../theme/ThemeProvider';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true } }));
let mockHours: Record<string, number[]> = {};
let mockSrc = { source: 'phone', sensor: true };
let mockPermitted: boolean | undefined = true;
const mockLive = jest.fn();
jest.mock('../features/steps/hooks', () => ({
  useStepSource: () => ({ data: mockSrc }),
  useActivityPermission: () => ({ data: mockPermitted }),
  useLiveSteps: (a: boolean) => mockLive(a),
  useStepHours: (d: string) => ({ data: mockHours[d] ?? Array.from({ length: 24 }, () => 0) }),
}));
let mockDays: { day: string; steps: number; source: string; flags: string[] }[] = [];
jest.mock('../features/health/hooks', () => ({
  useHealthSettings: () => ({ data: { enabled: false } }),
  useStepGoal: () => 8000,
  useStepHistory: () => ({ data: mockDays }),
}));

const today = localDate();
const h = (pairs: [number, number][]) => {
  const a = Array.from({ length: 24 }, () => 0);
  for (const [i, n] of pairs) a[i] = n;
  return a;
};
const wrap = () => render(<ThemeProvider><StepLog /></ThemeProvider>);

beforeEach(async () => {
  jest.clearAllMocks();
  mockHours = {};
  mockDays = [];
  mockSrc = { source: 'phone', sensor: true };
  mockPermitted = true;
  await i18n.changeLanguage('en');
});

describe('Step log', () => {
  it('shows each hour, the busiest hour and the day total', async () => {
    mockHours[today] = h([[0, 40], [7, 2140], [8, 600]]);
    await wrap();
    expect(screen.getByTestId('step-log-total')).toHaveTextContent('2,780');
    expect(screen.getByTestId('step-log-busiest')).toHaveTextContent('Busiest: 7 AM · 2,140');
    expect(screen.getByTestId('step-hour-7')).toHaveTextContent(/7 AM – 8 AM.*2,140/);
    expect(screen.queryByTestId('step-hour-9')).toBeNull();
    expect(mockLive).toHaveBeenCalledWith(true);
  });

  it('tapping a bar shows that hour', async () => {
    mockHours[today] = h([[8, 600]]);
    await wrap();
    await fireEvent.press(screen.getByTestId('step-bar-8'));
    expect(screen.getByTestId('step-log-picked')).toHaveTextContent('8 AM – 9 AM: 600 steps');
  });

  it('moves between days and never into the future', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const y = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    mockHours[y] = h([[18, 4000]]);
    await wrap();
    await fireEvent.press(screen.getByTestId('step-log-next'));
    expect(screen.getByTestId('step-log-day')).toHaveTextContent('Today');
    await fireEvent.press(screen.getByTestId('step-log-prev'));
    expect(screen.getByTestId('step-log-day')).toHaveTextContent('Yesterday');
    expect(screen.getByTestId('step-log-total')).toHaveTextContent('4,000');
    expect(mockLive).toHaveBeenLastCalledWith(false); // live updates only for today
  });

  it('shows a friendly empty state', async () => {
    await wrap();
    expect(screen.getByTestId('step-log-empty')).toHaveTextContent(/No steps yet today/);
  });

  it('keeps a typed-in total but still shows what the phone counted', async () => {
    mockHours[today] = h([[9, 1200]]);
    mockDays = [{ day: today, steps: 5000, source: 'manual', flags: [] }];
    await wrap();
    expect(screen.getByTestId('step-log-total')).toHaveTextContent('5,000');
    expect(screen.getByText(/You typed in a total/)).toBeTruthy();
    expect(screen.getByTestId('step-hour-9')).toBeTruthy();
  });

  it('explains when phone counting is off or not allowed', async () => {
    mockSrc = { source: 'health_connect', sensor: false };
    await wrap();
    expect(screen.getByText(/comes from FitMate’s own step counter/)).toBeTruthy();
    mockSrc = { source: 'phone', sensor: true };
    mockPermitted = false;
    await wrap();
    expect(screen.getAllByText(/Physical activity/).length).toBeGreaterThan(0);
  });
});
