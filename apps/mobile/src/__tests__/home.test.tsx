import { fireEvent, render, screen } from '@testing-library/react-native';
import { kcalProgress, progressOf, DailySummary } from '../features/agent/DailySummary';
import { AskCoachBar } from '../features/coach/AskCoachBar';
import { mealForTime } from '../features/coach/open';
import i18n from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';

const mockPush = jest.fn();
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a), navigate: (...a: unknown[]) => mockNavigate(...a) } }));
let mockProfile: Record<string, unknown> = {};
jest.mock('../features/profile/hooks', () => ({ useProfile: () => ({ data: mockProfile }) }));
jest.mock('../features/profile/targets', () => ({ targetsForProfile: () => ({ targetKcal: 2000, proteinG: 100, waterMl: 3000 }) }));
let mockEntries: { kcal: number; proteinG: number; meal: string }[] = [];
jest.mock('../features/food/hooks', () => ({ useDiary: () => ({ data: mockEntries }) }));
jest.mock('../features/progress/hooks', () => ({ useWaterToday: () => ({ data: 1500 }) }));
jest.mock('../features/health/hooks', () => ({ useHealthSettings: () => ({ data: { enabled: false } }), useStepHistory: () => ({ data: [] }), useStepGoal: () => 8000 }));
jest.mock('../features/workouts/hooks', () => ({ useWorkoutHistory: () => ({ data: [] }), usePersonalisation: () => null, useWorkoutText: () => ({ workoutName: () => 'x' }) }));
let mockFace: boolean | null = null;
jest.mock('../features/face/hooks', () => ({ useFaceToday: () => mockFace }));

const wrap = (el: React.ReactElement) => render(<ThemeProvider>{el}</ThemeProvider>);

beforeEach(async () => {
  jest.clearAllMocks();
  mockProfile = { hasEatingDisorderHistory: false };
  mockEntries = [{ kcal: 600, proteinG: 30, meal: 'breakfast' }, { kcal: 700, proteinG: 40, meal: 'lunch' }];
  mockFace = null;
  await i18n.changeLanguage('en');
});

describe('progressOf', () => {
  it('grades values against a target', () => {
    expect(progressOf(0, 100)).toBe('todo');
    expect(progressOf(40, 100)).toBe('progress');
    expect(progressOf(100, 100)).toBe('done');
    expect(progressOf(0, 0)).toBe('todo');
  });
});

describe('kcalProgress', () => {
  it('flags going well over the calorie target', () => {
    expect(kcalProgress(0, 2000)).toBe('todo');
    expect(kcalProgress(1000, 2000)).toBe('progress');
    expect(kcalProgress(1950, 2000)).toBe('done');
    expect(kcalProgress(2600, 2000)).toBe('over');
  });
});

describe('mealForTime', () => {
  it('picks the meal for the hour', () => {
    expect(mealForTime(new Date(2026, 10, 10, 8))).toBe('breakfast');
    expect(mealForTime(new Date(2026, 10, 10, 13))).toBe('lunch');
    expect(mealForTime(new Date(2026, 10, 10, 17))).toBe('snack');
    expect(mealForTime(new Date(2026, 10, 10, 21))).toBe('dinner');
  });
});

describe('Daily summary', () => {
  it('shows each area with a status and opens the right place', async () => {
    await wrap(<DailySummary />);
    expect(screen.getByTestId('sum-food')).toHaveTextContent(/1,300 of 2,000 kcal.*In progress/);
    expect(screen.getByTestId('sum-protein')).toHaveTextContent(/70 of 100 g/);
    expect(screen.getByTestId('sum-water')).toHaveTextContent(/6 of 12 glasses/);
    expect(screen.getByTestId('sum-face')).toHaveTextContent(/To do/);
    expect(screen.queryByTestId('sum-steps')).toBeNull();
    await fireEvent.press(screen.getByTestId('sum-face'));
    expect(mockPush).toHaveBeenCalledWith('/wellness/checkin');
    await fireEvent.press(screen.getByTestId('summary-all'));
    expect(mockNavigate).toHaveBeenCalledWith('/progress');
  });

  it('hides calorie and protein numbers in gentle mode', async () => {
    mockProfile = { hasEatingDisorderHistory: true };
    await wrap(<DailySummary />);
    expect(screen.getByTestId('sum-food')).toHaveTextContent(/2 meals logged.*Done/);
    expect(screen.queryByText(/kcal/)).toBeNull();
    expect(screen.queryByTestId('sum-protein')).toBeNull();
  });
});

describe('Ask coach bar', () => {
  it('opens the coach, the meal camera, or voice', async () => {
    await wrap(<AskCoachBar />);
    await fireEvent.press(screen.getByTestId('ask-coach'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/coach', params: { n: expect.any(String) } });
    await fireEvent.press(screen.getByTestId('ask-voice'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/coach', params: { n: expect.any(String), listen: '1' } });
    await fireEvent.press(screen.getByTestId('ask-photo'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/food/photo', params: { meal: expect.stringMatching(/breakfast|lunch|snack|dinner/) } });
  });
});
