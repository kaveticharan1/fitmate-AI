import { planDay } from '@fitmate/food-data';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import AddFood from '../app/food/add';
import Grocery from '../app/food/grocery';
import FoodItem from '../app/food/item';
import RecipeEdit from '../app/food/recipe-edit';
import PlanTab from '../app/(tabs)/plan';
import i18n from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: () => true };
let mockParams: Record<string, string> = {};
jest.mock('../features/food/packaged', () => ({ useCustomFoods: () => ({ data: [] }) }));
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
  useLocalSearchParams: () => mockParams,
}));

jest.mock('../db/foodRepo', () => ({
  getEntry: () => null,
  getRecipe: () => null,
  totalsOf: () => ({ kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }),
}));

const mockPlan = planDay({ date: '2026-11-10', targetKcal: 1800, targetProteinG: 120, dietType: 'non_vegetarian', allergies: [], dislikes: [] });
const mockAdd = jest.fn();
const mockSwap = jest.fn();
const mockLog = jest.fn();
const mockSaveRecipe = jest.fn();
const mockMutation = (fn: jest.Mock) => ({ mutate: fn, mutateAsync: async (v: unknown) => fn(v), isPending: false });
jest.mock('../features/food/hooks', () => ({
  useRecentFoods: () => ({ data: ['dosa'] }),
  useFavourites: () => ({ data: ['idli'] }),
  useAddFood: () => mockMutation(mockAdd),
  useUpdateFood: () => mockMutation(jest.fn()),
  useDeleteEntry: () => mockMutation(jest.fn()),
  useToggleFavourite: () => mockMutation(jest.fn()),
  useDayPlan: () => ({ plan: mockPlan, choices: {} }),
  useSwapMeal: () => mockMutation(mockSwap),
  useLogPlannedMeal: () => mockMutation(mockLog),
  useWeekPlan: () => [mockPlan],
  useSaveRecipe: () => mockMutation(mockSaveRecipe),
  useDeleteRecipe: () => mockMutation(jest.fn()),
}));

const wrap = (ui: ReactNode) => render(<ThemeProvider>{ui}</ThemeProvider>);

beforeEach(async () => {
  jest.clearAllMocks();
  mockParams = {};
  await i18n.changeLanguage('en');
});

describe('Add food', () => {
  it('shows favourites and recent foods, then searches in Roman Telugu', async () => {
    mockParams = { meal: 'lunch', date: '2026-11-10' };
    await wrap(<AddFood />);
    expect(screen.getByText('Add to Lunch')).toBeTruthy();
    expect(screen.getByTestId('favourites')).toBeTruthy();
    expect(screen.getByTestId('recent')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('food-search'), 'pappu');
    await fireEvent.press(screen.getByTestId('food-pappu'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/food/item', params: { foodId: 'pappu', meal: 'lunch', date: '2026-11-10' } });
  });

  it('offers a home recipe when nothing matches', async () => {
    await wrap(<AddFood />);
    await fireEvent.changeText(screen.getByTestId('food-search'), 'zzzz');
    expect(screen.getByText(/No match/)).toBeTruthy();
  });
});

describe('Food item', () => {
  it('updates nutrition with the quantity and oil, then saves', async () => {
    mockParams = { foodId: 'chicken_curry', meal: 'dinner', date: '2026-11-10' };
    await wrap(<FoodItem />);
    // 1 katori = 150 g → 225 kcal.
    expect(screen.getByTestId('grams')).toHaveTextContent('= 150 g');
    expect(screen.getByTestId('food-kcal')).toHaveTextContent('225');
    await fireEvent.press(screen.getByTestId('count-plus')); // 1.5 katori
    expect(screen.getByTestId('grams')).toHaveTextContent('= 225 g');
    await fireEvent.press(screen.getByTestId('oil-less'));
    // 225 g at 150 kcal/100 g = 337.5, minus half of 6 g oil/100 g × 9 kcal × 2.25 = 60.75 → 277
    expect(screen.getByTestId('food-kcal')).toHaveTextContent('277');
    await fireEvent.press(screen.getByTestId('food-save'));
    await waitFor(() =>
      expect(mockAdd).toHaveBeenCalledWith({ date: '2026-11-10', meal: 'dinner', foodId: 'chicken_curry', measureKey: 'katori', count: 1.5, oil: 'less' }),
    );
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('has no oil choice for foods without cooking oil', async () => {
    mockParams = { foodId: 'banana', meal: 'snack' };
    await wrap(<FoodItem />);
    expect(screen.queryByTestId('oil')).toBeNull();
  });
});

describe('Meal plan', () => {
  it('shows four meals with portions, swaps and logs', async () => {
    await wrap(<PlanTab />);
    for (const slot of ['breakfast', 'lunch', 'snack', 'dinner']) expect(screen.getByTestId(`planned-${slot}`)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('swap-lunch'));
    expect(mockSwap).toHaveBeenCalledWith('lunch');
    await fireEvent.press(screen.getByTestId('ate-breakfast'));
    expect(mockLog).toHaveBeenCalledWith(mockPlan.meals[0]);
  });
});

describe('Grocery list', () => {
  it('lists raw ingredients in groups and ticks items off', async () => {
    await wrap(<Grocery />);
    expect(screen.getByText('Rice, flours and grains')).toBeTruthy();
    const first = screen.getAllByRole('checkbox')[0]!;
    expect(first.props.accessibilityState.checked).toBe(false);
    await fireEvent.press(first);
    expect(screen.getAllByRole('checkbox')[0]!.props.accessibilityState.checked).toBe(true);
  });
});

describe('Home recipe editor', () => {
  it('validates, previews per-serving nutrition and saves', async () => {
    await wrap(<RecipeEdit />);
    await fireEvent.press(screen.getByTestId('recipe-save'));
    expect(screen.getByText('This is required')).toBeTruthy();
    expect(screen.getByText('Add at least one ingredient')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('recipe-name'), 'Amma pappu');
    await fireEvent.changeText(screen.getByTestId('ing-search'), 'kandi');
    await fireEvent.press(screen.getByTestId('food-toor_dal_raw'));
    await fireEvent.changeText(screen.getByTestId('ing-grams-0'), '200');
    // 200 g toor dal = 686 kcal over 4 servings ≈ 172 kcal each.
    expect(screen.getByTestId('recipe-preview')).toHaveTextContent(/172 kcal/);
    await fireEvent.press(screen.getByTestId('recipe-save'));
    await waitFor(() =>
      expect(mockSaveRecipe).toHaveBeenCalledWith({
        input: { name: 'Amma pappu', servings: 4, totalCookedG: null, ingredients: [{ foodId: 'toor_dal_raw', grams: 200 }] },
        id: undefined,
      }),
    );
  });
});
