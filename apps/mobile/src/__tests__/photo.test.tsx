import { CoachError } from '@fitmate/coach';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import FoodPhoto from '../app/food/photo';
import i18n from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), back: () => mockBack(), canGoBack: () => true },
  useLocalSearchParams: () => ({ meal: 'lunch', date: '2026-11-10' }),
}));

let mockCameraGranted = true;
const mockLaunchCamera = jest.fn();
const mockLaunchLibrary = jest.fn();
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: async () => ({ granted: mockCameraGranted }),
  launchCameraAsync: (o: unknown) => mockLaunchCamera(o),
  launchImageLibraryAsync: (o: unknown) => mockLaunchLibrary(o),
}));

let mockStatus = { connected: true, model: 'gemini-3.6-flash' };
jest.mock('../features/coach/hooks', () => ({ useAiStatus: () => ({ data: mockStatus }) }));

type Estimate = { items: { name: string; grams: number; kcal: number; protein: number; carbs: number; fat: number; fiber: number }[]; confidence: string; note: string | null };
let mockAnalyze: { data?: Estimate; isPending: boolean; isError: boolean; error?: unknown } = { isPending: false, isError: false };
const mockAnalyzeMutate = jest.fn();
jest.mock('../features/food/photo', () => ({ useAnalyzePhoto: () => ({ mutate: mockAnalyzeMutate, ...mockAnalyze }) }));
const mockSave = jest.fn();
jest.mock('../features/food/packaged', () => ({ useAddPhotoEntries: () => ({ mutate: mockSave, isPending: false }) }));

const wrap = () => render(<ThemeProvider><FoodPhoto /></ThemeProvider>);
const plate: Estimate = {
  items: [
    { name: 'Rice', grams: 200, kcal: 260, protein: 5.4, carbs: 56, fat: 0.6, fiber: 0.8 },
    { name: 'Chicken curry', grams: 150, kcal: 240, protein: 22, carbs: 6, fat: 14, fiber: 1 },
  ],
  confidence: 'medium',
  note: 'Curry oil is a guess.',
};

/** Picks a photo and feeds the estimate back as if Gemini answered. */
async function pickAndAnswer(e: Estimate) {
  mockLaunchCamera.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/p.jpg' }] });
  await fireEvent.press(screen.getByTestId('photo-camera'));
  await act(async () => {});
  expect(mockAnalyzeMutate).toHaveBeenCalledWith('file:///cache/p.jpg', expect.anything());
  mockAnalyze = { isPending: false, isError: false, data: e };
  await act(async () => mockAnalyzeMutate.mock.calls[0][1].onSuccess(e));
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockStatus = { connected: true, model: 'gemini-3.6-flash' };
  mockAnalyze = { isPending: false, isError: false };
  mockCameraGranted = true;
  await i18n.changeLanguage('en');
});

describe('Food photo', () => {
  it('needs the AI coach', async () => {
    mockStatus = { connected: false, model: '' };
    await wrap();
    await fireEvent.press(screen.getByTestId('photo-setup-button'));
    expect(mockPush).toHaveBeenCalledWith('/settings/ai');
  });

  it('says where the photo goes and that it is not kept', async () => {
    await wrap();
    expect(screen.getByText(/sent to your AI service \(Groq or Google Gemini\).*isn’t saved on this phone/)).toBeTruthy();
  });

  it('shows the estimate, lets you fix portions and remove items, then saves', async () => {
    await wrap();
    await pickAndAnswer(plate);
    expect(screen.getByText('Rough estimate. Please check the portions below.')).toBeTruthy();
    expect(screen.getByText('Curry oil is a guess.')).toBeTruthy();
    expect(screen.getByText('Total: 500 kcal · 27 g protein')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('photo-grams-0'), '150');
    expect(screen.getByText('Total: 435 kcal · 26 g protein')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('photo-remove-1'));
    expect(screen.getByText('Total: 195 kcal · 4 g protein')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('photo-save'));
    expect(mockSave).toHaveBeenCalledWith(
      { date: '2026-11-10', meal: 'lunch', items: [{ name: 'Rice', grams: 150, kcal: 195, protein: 4.1, carbs: 42, fat: 0.5, fiber: 0.6 }] },
      expect.anything(),
    );
  });

  it('blocks saving with an impossible portion', async () => {
    await wrap();
    await pickAndAnswer(plate);
    await fireEvent.changeText(screen.getByTestId('photo-grams-0'), '0');
    await fireEvent.press(screen.getByTestId('photo-save'));
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('explains when no food is found', async () => {
    await wrap();
    await pickAndAnswer({ items: [], confidence: 'high', note: 'This looks like a cat.' });
    expect(screen.getByTestId('photo-nothing')).toHaveTextContent('This looks like a cat.');
  });

  it('handles a denied camera and AI errors', async () => {
    mockCameraGranted = false;
    await wrap();
    await fireEvent.press(screen.getByTestId('photo-camera'));
    await act(async () => {});
    expect(screen.getByText(/Camera access is off/)).toBeTruthy();
    expect(mockLaunchCamera).not.toHaveBeenCalled();

    mockAnalyze = { isPending: false, isError: true, error: new CoachError('quota', 'x') };
    await wrap();
    expect(screen.getByText(/free daily limit/)).toBeTruthy();
  });

  it('does nothing if picking is cancelled', async () => {
    mockLaunchLibrary.mockResolvedValue({ canceled: true, assets: null });
    await wrap();
    await fireEvent.press(screen.getByTestId('photo-gallery'));
    await act(async () => {});
    expect(mockAnalyzeMutate).not.toHaveBeenCalled();
  });
});
