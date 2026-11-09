import { fireEvent, render, screen } from '@testing-library/react-native';
import Kitchen from '../app/food/kitchen';
import i18n from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), back: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({ meal: 'dinner', date: '2026-11-10' }),
}));
let mockProfile = { dietType: 'non_vegetarian', allergies: [] as string[], dislikedFoods: [] as string[] };
jest.mock('../features/profile/hooks', () => ({ useProfile: () => ({ data: mockProfile }) }));
let mockConnected = false;
jest.mock('../features/coach/hooks', () => ({ useAiStatus: () => ({ data: { connected: mockConnected, model: 'm' } }) }));
const mockSettings: Record<string, unknown> = {};
jest.mock('../db/repositories', () => ({
  getSetting: (k: string, d: unknown) => (k in mockSettings ? mockSettings[k] : d),
  setSetting: (k: string, v: unknown) => {
    mockSettings[k] = v;
  },
}));

const wrap = () => render(<ThemeProvider><Kitchen /></ThemeProvider>);

beforeEach(async () => {
  jest.clearAllMocks();
  for (const k of Object.keys(mockSettings)) delete mockSettings[k];
  mockProfile = { dietType: 'non_vegetarian', allergies: [], dislikedFoods: [] };
  mockConnected = false;
  await i18n.changeLanguage('en');
});

describe('Kitchen assistant', () => {
  it('asks for ingredients first', async () => {
    await wrap();
    expect(screen.getByText('Pick a few ingredients to see dishes.')).toBeTruthy();
    expect(screen.queryByTestId('have-oil')).toBeNull();
  });

  it('suggests dishes from what you have and remembers the selection', async () => {
    await wrap();
    await fireEvent.press(screen.getByTestId('have-egg_raw'));
    await fireEvent.press(screen.getByTestId('have-onion'));
    expect(screen.getByTestId('dish-omelette')).toBeTruthy();
    expect(screen.getByTestId('dish-egg_curry')).toHaveTextContent(/needs Tomato/);
    expect(mockSettings.kitchenHave).toEqual(['egg_raw', 'onion']);
    await fireEvent.press(screen.getByTestId('dish-omelette'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/food/item', params: { foodId: 'omelette', meal: 'dinner', date: '2026-11-10' } });
  });

  it('follows the diet in the profile', async () => {
    mockProfile = { dietType: 'vegetarian', allergies: [], dislikedFoods: [] };
    mockSettings.kitchenHave = ['egg_raw', 'onion'];
    await wrap();
    expect(screen.queryByTestId('dish-omelette')).toBeNull();
    expect(screen.getByText(/Nothing yet with just these/)).toBeTruthy();
  });

  it('filters the ingredient list and offers the AI coach', async () => {
    mockConnected = true;
    mockSettings.kitchenHave = ['spinach'];
    await wrap();
    await fireEvent.changeText(screen.getByTestId('kitchen-search'), 'palak');
    expect(screen.getByTestId('have-spinach')).toBeTruthy();
    expect(screen.queryByTestId('have-egg_raw')).toBeNull();
    await fireEvent.press(screen.getByTestId('kitchen-ask-coach'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/coach', params: { prefill: expect.stringMatching(/^I have: Spinach/) } });
  });
});
