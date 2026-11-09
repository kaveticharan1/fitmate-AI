import { fireEvent, render, screen } from '@testing-library/react-native';
import Checkin from '../app/wellness/checkin';
import Wellness from '../app/wellness/index';
import Ingredients from '../app/wellness/ingredients';
import SkinProfile from '../app/wellness/skin-profile';
import i18n from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a), back: () => mockBack(), canGoBack: () => true } }));
jest.mock('expo-image-picker', () => ({}));
const mockSettings: Record<string, unknown> = {};
jest.mock('../db/repositories', () => ({
  getSetting: (k: string, d: unknown) => (k in mockSettings ? mockSettings[k] : d),
  setSetting: (k: string, v: unknown) => {
    mockSettings[k] = v;
  },
}));
let mockConnected = false;
jest.mock('../features/coach/hooks', () => ({ useAiStatus: () => ({ data: { connected: mockConnected, model: 'm' } }) }));
const mockSaveCheckin = jest.fn();
let mockInsights: unknown = { checkins: [], today: null, avg7: null, avgPrev7: null, associations: [], escalation: 'none' };
jest.mock('../features/face/hooks', () => ({
  useTodayCheckin: () => ({ data: null }),
  useSaveCheckin: () => ({ mutate: (v: unknown, o?: { onSuccess?: () => void }) => (mockSaveCheckin(v), o?.onSuccess?.()), isPending: false }),
  useFaceInsights: () => ({ data: mockInsights }),
}));
let mockSkin: unknown = null;
const mockSaveSkin = jest.fn();
jest.mock('../features/skin/hooks', () => ({
  useSkinProfile: () => ({ data: mockSkin }),
  useRoutineSteps: () => ({ data: [] }),
  useRoutineDone: () => ({ data: [] }),
  useSaveSkinProfile: () => ({ mutate: (v: unknown, o?: { onSuccess?: () => void }) => (mockSaveSkin(v), o?.onSuccess?.()), isPending: false }),
  useDeleteSkinData: () => ({ mutate: jest.fn(), isPending: false }),
  useReadLabel: () => ({ mutate: jest.fn(), isPending: false, isError: false }),
}));

const wrap = (C: () => React.JSX.Element) => render(<ThemeProvider><C /></ThemeProvider>);

beforeEach(async () => {
  jest.clearAllMocks();
  for (const k of Object.keys(mockSettings)) delete mockSettings[k];
  mockConnected = false;
  mockSkin = null;
  mockInsights = { checkins: [], today: null, avg7: null, avgPrev7: null, associations: [], escalation: 'none' };
  await i18n.changeLanguage('en');
});

describe('Face check-in', () => {
  it('requires a puffiness rating', async () => {
    await wrap(Checkin);
    await fireEvent.press(screen.getByTestId('checkin-save'));
    expect(mockSaveCheckin).not.toHaveBeenCalled();
    expect(screen.getByText('This is required')).toBeTruthy();
  });

  it('saves a quick check-in and skips optional answers', async () => {
    await wrap(Checkin);
    expect(screen.queryByTestId('area-cheeks')).toBeNull();
    await fireEvent.press(screen.getByTestId('puffiness-moderate'));
    await fireEvent.press(screen.getByTestId('area-under_eyes'));
    await fireEvent.press(screen.getByTestId('time-of-day-morning'));
    await fireEvent.press(screen.getByTestId('salty-yes'));
    await fireEvent.press(screen.getByTestId('checkin-save'));
    expect(mockSaveCheckin).toHaveBeenCalledWith(
      expect.objectContaining({ puffiness: 2, areas: ['under_eyes'], timeOfDay: 'morning', saltyYesterday: true, alcoholYesterday: null, stress: null, note: null }),
    );
    expect(mockBack).toHaveBeenCalled();
  });

  it('shows emergency help for throat swelling and a doctor note for pain', async () => {
    await wrap(Checkin);
    await fireEvent.press(screen.getByTestId('symptom-pain'));
    expect(screen.getByText(/Painful facial swelling/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('symptom-lips_tongue_throat'));
    expect(screen.getByTestId('checkin-emergency')).toBeTruthy();
    expect(screen.queryByText(/Painful facial swelling/)).toBeNull();
  });
});

describe('Wellness dashboard', () => {
  it('starts empty and links to check-in', async () => {
    await wrap(Wellness);
    expect(screen.getByText('No check-in yet today.')).toBeTruthy();
    expect(screen.queryByTestId('wellness-share')).toBeNull();
    await fireEvent.press(screen.getByTestId('open-checkin'));
    expect(mockPush).toHaveBeenCalledWith('/wellness/checkin');
  });

  it('shows today, averages, emergencies and the coach share toggle', async () => {
    mockConnected = true;
    const today = { day: 'x', puffiness: 1, areas: [], symptoms: [] };
    mockInsights = { checkins: [today], today, avg7: 1.5, avgPrev7: 2, associations: [], escalation: 'emergency' };
    await wrap(Wellness);
    expect(screen.getByTestId('today-puffiness')).toHaveTextContent('Puffiness today: Mild');
    expect(screen.getByTestId('avg-week')).toHaveTextContent('Average this week: 1.5 / 3 (last week 2)');
    expect(screen.getByTestId('wellness-emergency')).toBeTruthy();
    await fireEvent(screen.getByTestId('wellness-share'), 'valueChange', false);
    expect(mockSettings.wellnessShareWithCoach).toBe(false);
  });
});

describe('Skin profile', () => {
  it('needs a skin type, then saves', async () => {
    await wrap(SkinProfile);
    await fireEvent.press(screen.getByTestId('skin-save'));
    expect(mockSaveSkin).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('skin-type-oily'));
    await fireEvent.press(screen.getByTestId('concern-acne'));
    await fireEvent.changeText(screen.getByTestId('skin-allergies'), 'fragrance');
    await fireEvent.press(screen.getByTestId('skin-save'));
    expect(mockSaveSkin).toHaveBeenCalledWith(expect.objectContaining({ skinType: 'oily', concerns: ['acne'], allergies: 'fragrance', experience: 'beginner', shareWithCoach: true }));
  });
});

describe('Ingredient checker', () => {
  it('asks for the list instead of guessing from a product name', async () => {
    await wrap(Ingredients);
    await fireEvent.changeText(screen.getByTestId('ing-name-0'), 'Some Serum');
    await fireEvent.press(screen.getByTestId('ing-check'));
    expect(screen.getByText(/doesn’t guess a formula/)).toBeTruthy();
    expect(screen.queryByTestId('ing-result')).toBeNull();
  });

  it('flags allergies, pregnancy and finds actives', async () => {
    mockSkin = { skinType: 'sensitive', sensitive: true, fragranceFree: true, pregnant: true, allergies: 'fragrance' };
    await wrap(Ingredients);
    await fireEvent.changeText(screen.getByTestId('ing-list-0'), 'Aqua, Glycerin, Niacinamide, Retinol, Parfum');
    await fireEvent.press(screen.getByTestId('ing-check'));
    expect(screen.getByTestId('ing-result')).toBeTruthy();
    expect(screen.getByText(/Contains something you listed to avoid/)).toBeTruthy();
    expect(screen.getByText(/Pregnancy caution/)).toBeTruthy();
    expect(screen.getByTestId('ing-result')).toHaveTextContent(/• Niacinamide/);
  });

  it('compares two products', async () => {
    await wrap(Ingredients);
    await fireEvent.press(screen.getByTestId('ing-mode-two'));
    await fireEvent.changeText(screen.getByTestId('ing-list-0'), 'Aqua, Glycerin, Ceramide NP');
    await fireEvent.press(screen.getByTestId('ing-check'));
    expect(screen.getByText('Add the ingredient list first.')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('ing-list-1'), 'Aqua, Glycolic Acid, Salicylic Acid, Alcohol Denat');
    await fireEvent.press(screen.getByTestId('ing-check'));
    expect(screen.getByTestId('ing-gentler')).toHaveTextContent('Product 1 looks gentler for your profile.');
  });
});
