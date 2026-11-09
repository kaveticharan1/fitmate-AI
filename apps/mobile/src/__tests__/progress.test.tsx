import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import Progress from '../app/(tabs)/progress';
import i18n from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';

let mockWeights: { date: string; value: number }[] = [];
const mockLogWaist = jest.fn();
jest.mock('../features/progress/hooks', () => ({
  useWeightHistory: () => ({ data: mockWeights }),
  useWaistHistory: () => ({ data: [{ date: '2026-11-01', value: 96 }, { date: '2026-11-08', value: 94.5 }] }),
  useWeekFood: () => ({ data: [{ date: '2026-11-08', kcal: 1750, protein: 115 }, { date: '2026-11-09', kcal: 2300, protein: 70 }] }),
  useLogWaist: () => ({ mutateAsync: async (v: number) => mockLogWaist(v), isPending: false, isError: false }),
}));
jest.mock('../features/profile/hooks', () => ({ useProfile: () => ({ data: { targetWeightKg: 75 } }) }));
jest.mock('../features/food/hooks', () => ({ useTargets: () => ({ targetKcal: 1800, proteinG: 120 }) }));

beforeEach(async () => {
  jest.clearAllMocks();
  mockWeights = [];
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

  it('shows waist change and validates a new waist entry', async () => {
    await wrap();
    expect(screen.getByText('96 → 94.5 cm (-1.5 cm)')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('waist-input'), '20');
    await fireEvent.press(screen.getByTestId('waist-save'));
    expect(screen.getByText('Must be at least 40')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('waist-input'), '93.5');
    await fireEvent.press(screen.getByTestId('waist-save'));
    await waitFor(() => expect(mockLogWaist).toHaveBeenCalledWith(93.5));
  });
});
