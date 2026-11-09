import { act, fireEvent, render, screen } from '@testing-library/react-native';
import RemindersScreen from '../app/settings/reminders';
import i18n from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';

const mockSettings: Record<string, unknown> = {};
jest.mock('../db/repositories', () => ({
  getSetting: (k: string, d: unknown) => (k in mockSettings ? mockSettings[k] : d),
  setSetting: (k: string, v: unknown) => {
    mockSettings[k] = v;
  },
}));
const mockApply = jest.fn(async () => 0);
jest.mock('../features/reminders/notifications', () => ({ applyReminders: (...a: unknown[]) => mockApply(...(a as [])) }));
const mockSync = jest.fn(async () => 2);
jest.mock('../features/reminders/smartSync', () => ({
  currentDayStatus: () => ({ status: {}, targets: {} }),
  syncSmartReminders: (...a: unknown[]) => mockSync(...(a as [])),
}));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => true } }));

beforeEach(async () => {
  jest.clearAllMocks();
  for (const k of Object.keys(mockSettings)) delete mockSettings[k];
  await i18n.changeLanguage('en');
});

describe('Reminder settings', () => {
  it('reads settings saved before smart reminders existed', async () => {
    mockSettings['reminders.v1'] = { water: { enabled: true, startHour: 8, endHour: 21, everyHours: 2 }, medicines: [] };
    await render(<ThemeProvider><RemindersScreen /></ThemeProvider>);
    expect(screen.getByTestId('smart-card')).toBeTruthy();
  });

  it('turns on the evening check-in with a chosen time and schedules it', async () => {
    await render(<ThemeProvider><RemindersScreen /></ThemeProvider>);
    await fireEvent(screen.getByTestId('smart-checkin'), 'press');
    await fireEvent.press(screen.getByTestId('smart-time-20:30'));
    await fireEvent(screen.getByTestId('smart-weighin'), 'press');
    await act(async () => {
      fireEvent.press(screen.getByTestId('reminders-save'));
    });
    expect((mockSettings['reminders.v1'] as { smart: unknown }).smart).toEqual({ checkIn: true, checkInTime: '20:30', logNudge: false, morning: false, weighIn: true });
    expect(mockSync).toHaveBeenCalledWith(expect.any(Function), {}, {}, true);
    expect(screen.getByText(i18n.t('reminders.saved', { count: 2 }))).toBeTruthy();
  });
});
