import { fireEvent, render, screen } from '@testing-library/react-native';
import TodayPlan from '../app/today';
import { AgentCard } from '../features/agent/AgentCard';
import i18n from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';

const mockPush = jest.fn();
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a), navigate: (...a: unknown[]) => mockNavigate(...a), back: jest.fn(), canGoBack: () => true } }));
jest.mock('../db/repositories', () => ({ getSetting: (_k: string, d: unknown) => d }));
let mockConnected = true;
let mockMessages: unknown[] = [];
jest.mock('../features/coach/hooks', () => ({ useAiStatus: () => ({ data: { connected: mockConnected } }), useCoachMessages: () => ({ data: mockMessages }) }));
jest.mock('../features/coach/useActionSummary', () => ({ useActionSummary: () => () => ['Add 500 ml of water today'] }));
jest.mock('../features/profile/hooks', () => ({ useProfile: () => ({ data: { name: 'C' } }) }));
jest.mock('../features/profile/targets', () => ({ targetsForProfile: () => ({ waterMl: 3000 }) }));
jest.mock('../features/food/hooks', () => ({ useDiary: () => ({ data: [{ meal: 'breakfast' }] }) }));
jest.mock('../features/progress/hooks', () => ({ useWaterToday: () => ({ data: 1000 }) }));
jest.mock('../features/health/hooks', () => ({ useHealthSettings: () => ({ data: { enabled: true } }), useStepHistory: () => ({ data: [] }), useStepGoal: () => 8000 }));
jest.mock('../features/workouts/hooks', () => ({ useWorkoutHistory: () => ({ data: [] }) }));
jest.mock('../features/face/hooks', () => ({ useFaceToday: () => null, useFaceInsights: () => ({ data: { checkins: [] } }) }));

const wrap = (el: React.ReactElement) => render(<ThemeProvider>{el}</ThemeProvider>);

beforeEach(async () => {
  jest.clearAllMocks();
  mockConnected = true;
  mockMessages = [];
  await i18n.changeLanguage('en');
});

describe('Today plan', () => {
  it('shows progress, all-day cards and a tappable timeline', async () => {
    mockMessages = [{ role: 'coach', createdAt: new Date().toISOString(), actions: [{ status: 'done', action: { type: 'log_water', ml: 500 } }, { status: 'proposed', action: { type: 'log_water', ml: 250 } }] }];
    await wrap(<TodayPlan />);
    expect(screen.getByTestId('today-progress')).toHaveTextContent(/1 of 5 done today/);
    expect(screen.getByTestId('today-water')).toHaveTextContent(/4 of 12 glasses/);
    expect(screen.getByTestId('today-steps')).toBeTruthy();
    expect(screen.getAllByText('AI adjustment')).toHaveLength(1);
    expect(screen.queryByTestId('step-face')).toBeNull();
    if (screen.queryByTestId('step-dinner-open')) {
      await fireEvent.press(screen.getByTestId('step-dinner-open'));
      expect(mockPush).toHaveBeenCalledWith({ pathname: '/food/add', params: expect.objectContaining({ meal: 'dinner' }) });
    }
    await fireEvent.press(screen.getByTestId('today-adjust'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/coach', params: expect.objectContaining({ prefill: expect.stringMatching(/adjust the rest of my day/) }) });
  });

  it('hides the adjust button when the coach is off', async () => {
    mockConnected = false;
    await wrap(<TodayPlan />);
    expect(screen.queryByTestId('today-adjust')).toBeNull();
  });
});

describe('Agent card', () => {
  it('shows the coach as active and opens the plan', async () => {
    await wrap(<AgentCard />);
    expect(screen.getByTestId('agent-status')).toHaveTextContent('Coach active');
    await fireEvent.press(screen.getByTestId('open-today'));
    expect(mockPush).toHaveBeenCalledWith('/today');
    expect(screen.queryByTestId('agent-setup')).toBeNull();
  });
  it('offers setup when the coach is off', async () => {
    mockConnected = false;
    await wrap(<AgentCard />);
    expect(screen.getByTestId('agent-status')).toHaveTextContent('Coach off');
    await fireEvent.press(screen.getByTestId('agent-setup'));
    expect(mockPush).toHaveBeenCalledWith('/settings/ai');
  });
});
