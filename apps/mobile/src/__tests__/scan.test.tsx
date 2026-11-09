import { act, fireEvent, render, screen } from '@testing-library/react-native';
import AddFood from '../app/food/add';
import CustomFoodScreen from '../app/food/custom';
import ScanBarcode from '../app/food/scan';
import i18n from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { replace: (...a: unknown[]) => mockReplace(...a), push: (...a: unknown[]) => mockPush(...a), back: () => mockBack(), canGoBack: () => true },
  useLocalSearchParams: () => mockParams,
}));

let mockPermission: { granted: boolean; canAskAgain: boolean } | null = { granted: true, canAskAgain: true };
const mockRequestPermission = jest.fn();
jest.mock('expo-camera', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pressable } = require('react-native');
  return {
    useCameraPermissions: () => [mockPermission, mockRequestPermission],
    CameraView: ({ onBarcodeScanned }: { onBarcodeScanned: (r: { data: string }) => void }) =>
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('react').createElement(Pressable, { testID: 'mock-scan', onPress: () => {
        // Cameras report the same code several times a second.
        onBarcodeScanned({ data: '8901058851298' });
        onBarcodeScanned({ data: '8901058851298' });
      } }),
  };
});

type Lookup = { kind: string; [k: string]: unknown };
let mockLookup: { data?: Lookup; isPending: boolean; isError: boolean; error?: unknown } = { isPending: false, isError: false };
const mockLookupMutate = jest.fn();
const mockSave = jest.fn();
const mockAdd = jest.fn();
const mockUpdate = jest.fn();
const mockFood = { id: 'c1', barcode: '8901058851298', name: 'Masala Oats', brand: 'Saffola', kcal100: 380, protein100: 12, carbs100: 65, fat100: 8, fiber100: 9, servingG: 40, source: 'barcode' };
jest.mock('../features/food/packaged', () => ({
  useLookupBarcode: () => ({ mutate: mockLookupMutate, reset: jest.fn(), ...mockLookup }),
  useSaveCustomFood: () => ({ mutate: mockSave, isPending: false, isError: false }),
  useCustomFoods: () => ({ data: [mockFood] }),
  useCustomFood: () => ({ data: mockFood }),
  useLogCustomFood: () => ({ add: { mutate: mockAdd, isPending: false, isError: false }, update: { mutate: mockUpdate, isPending: false, isError: false } }),
}));
let mockEntry: Record<string, unknown> | null = null;
jest.mock('../db/foodRepo', () => ({ getEntry: () => mockEntry }));
const mockDelete = jest.fn();
jest.mock('../features/food/hooks', () => ({
  useDeleteEntry: () => ({ mutate: mockDelete }),
  useFavourites: () => ({ data: [] }),
  useRecentFoods: () => ({ data: [] }),
}));

const wrap = (el: React.ReactElement) => render(<ThemeProvider>{el}</ThemeProvider>);
const complete = {
  kind: 'found',
  product: { barcode: '8901058851298', name: 'Masala Oats', brand: 'Saffola', quantity: '500 g', per100: { kcal: 380, protein: 12, carbs: 65, fat: 8, fiber: 9 }, servingG: 40, complete: true },
};

beforeEach(async () => {
  jest.clearAllMocks();
  mockParams = { meal: 'breakfast', date: '2026-11-10' };
  mockPermission = { granted: true, canAskAgain: true };
  mockLookup = { isPending: false, isError: false };
  mockEntry = null;
  await i18n.changeLanguage('en');
});

describe('Barcode scanning', () => {
  it('looks up a scanned barcode once', async () => {
    await wrap(<ScanBarcode />);
    await fireEvent.press(screen.getByTestId('mock-scan'));
    expect(mockLookupMutate).toHaveBeenCalledTimes(1);
    expect(mockLookupMutate.mock.calls[0][0]).toBe('8901058851298');
  });

  it('goes straight to the amount for a saved product', async () => {
    await wrap(<ScanBarcode />);
    await fireEvent.press(screen.getByTestId('mock-scan'));
    await act(async () => mockLookupMutate.mock.calls[0][1].onSuccess({ kind: 'saved', food: { id: 'c1' } }));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/food/custom', params: { customFoodId: 'c1', meal: 'breakfast', date: '2026-11-10' } });
  });

  it('accepts a typed barcode only if the check digit is right', async () => {
    mockPermission = { granted: false, canAskAgain: false };
    await wrap(<ScanBarcode />);
    expect(screen.getByText(/Camera access is off/)).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('barcode-input'), '8901058851299');
    expect(screen.getByText(/doesn’t look like a barcode/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('barcode-lookup'));
    expect(mockLookupMutate).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId('barcode-input'), '8901058851298');
    await fireEvent.press(screen.getByTestId('barcode-lookup'));
    expect(mockLookupMutate).toHaveBeenCalledWith('8901058851298', expect.anything());
  });

  it('shows a found product and saves it', async () => {
    mockLookup = { isPending: false, isError: false, data: complete };
    await wrap(<ScanBarcode />);
    await fireEvent.press(screen.getByTestId('mock-scan'));
    expect(screen.getByTestId('product-per100')).toHaveTextContent('Per 100 g: 380 kcal · protein 12 g · carbs 65 g · fat 8 g');
    expect(screen.getByText(/Open Food Facts contributors/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('save-product'));
    expect(mockSave.mock.calls[0][0]).toEqual({
      barcode: '8901058851298',
      name: 'Masala Oats',
      brand: 'Saffola',
      per100: { kcal: 380, protein: 12, carbs: 65, fat: 8, fiber: 9 },
      servingG: 40,
      source: 'barcode',
    });
    mockSave.mock.calls[0][1].onSuccess('c9');
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/food/custom', params: { customFoodId: 'c9', meal: 'breakfast', date: '2026-11-10' } });
  });

  it('asks for label values when the product is unknown, and checks them', async () => {
    mockLookup = { isPending: false, isError: false, data: { kind: 'not_found', barcode: '8901058851298' } };
    await wrap(<ScanBarcode />);
    await fireEvent.press(screen.getByTestId('mock-scan'));
    await act(async () => mockLookupMutate.mock.calls[0][1].onSuccess({ kind: 'not_found' }));
    await fireEvent.changeText(screen.getByTestId('label-name'), 'Peanut chikki');
    await fireEvent.changeText(screen.getByTestId('label-kcal'), '1500');
    await fireEvent.changeText(screen.getByTestId('label-protein'), '15');
    await fireEvent.changeText(screen.getByTestId('label-carbs'), '55');
    await fireEvent.changeText(screen.getByTestId('label-fat'), '25');
    await fireEvent.press(screen.getByTestId('label-save'));
    expect(mockSave).not.toHaveBeenCalled();
    expect(screen.getByText('Check this value (per 100 g).')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('label-kcal'), '480');
    await fireEvent.press(screen.getByTestId('label-save'));
    expect(mockSave.mock.calls[0][0]).toEqual({
      barcode: '8901058851298',
      name: 'Peanut chikki',
      brand: null,
      per100: { kcal: 480, protein: 15, carbs: 55, fat: 25, fiber: 0 },
      servingG: null,
      source: 'label',
    });
  });

  it('offers retry and typing from the label when offline', async () => {
    mockLookup = { isPending: false, isError: true, error: { kind: 'network' } };
    await wrap(<ScanBarcode />);
    await fireEvent.press(screen.getByTestId('mock-scan'));
    expect(screen.getByText(/No internet/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('retry-lookup'));
    expect(mockLookupMutate).toHaveBeenCalledTimes(2);
  });
});

describe('Packaged food amount', () => {
  it('calculates the portion and adds it to the meal', async () => {
    mockParams = { customFoodId: 'c1', meal: 'breakfast', date: '2026-11-10' };
    await wrap(<CustomFoodScreen />);
    await fireEvent.press(screen.getByTestId('grams-40'));
    expect(screen.getByText('152 kcal')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('custom-save'));
    expect(mockAdd).toHaveBeenCalledWith({ date: '2026-11-10', meal: 'breakfast', customFoodId: 'c1', grams: 40 }, expect.anything());
  });

  it('edits and removes a logged packaged food', async () => {
    mockParams = { entryId: 'e1' };
    mockEntry = { id: 'e1', customFoodId: 'c1', meal: 'snack', loggedOn: '2026-11-09', quantityG: 60, name: 'Masala Oats', kcal: 228, proteinG: 7.2 };
    await wrap(<CustomFoodScreen />);
    expect(screen.getByTestId('custom-grams').props.value).toBe('60');
    await fireEvent.changeText(screen.getByTestId('custom-grams'), '80');
    await fireEvent.press(screen.getByTestId('custom-save'));
    expect(mockUpdate).toHaveBeenCalledWith({ entryId: 'e1', grams: 80, meal: 'snack' }, expect.anything());
    await fireEvent.press(screen.getByTestId('delete-entry'));
    expect(mockDelete).toHaveBeenCalledWith('e1', expect.anything());
  });

  it('shows a photo entry read-only', async () => {
    mockParams = { entryId: 'p1' };
    mockEntry = { id: 'p1', customFoodId: null, meal: 'lunch', loggedOn: '2026-11-09', quantityG: 350, name: 'Chicken biryani', kcal: 612, proteinG: 24 };
    await wrap(<CustomFoodScreen />);
    expect(screen.getByText('About 350 g · 612 kcal · 24 g protein')).toBeTruthy();
    expect(screen.queryByTestId('custom-grams')).toBeNull();
  });
});

describe('Add food', () => {
  it('opens the scanner and lists saved packaged foods', async () => {
    await wrap(<AddFood />);
    await fireEvent.press(screen.getByTestId('open-scan'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/food/scan', params: { meal: 'breakfast', date: '2026-11-10' } });
    await fireEvent.press(screen.getByTestId('packaged-c1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/food/custom', params: { customFoodId: 'c1', meal: 'breakfast', date: '2026-11-10' } });
    await fireEvent.changeText(screen.getByTestId('food-search'), 'saffola');
    expect(screen.getByTestId('packaged-c1')).toBeTruthy();
  });
});
