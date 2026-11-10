import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import i18n from '../i18n';
import Dashboard from '../app/(tabs)/index';
import Welcome from '../app/welcome';
import type { ProfileRow } from '../db/schema';
import { EMPTY_PROFILE, ProfileWizard } from '../features/profile/ProfileWizard';
import { LockScreen } from '../security/LockScreen';
import { ThemeProvider } from '../theme/ThemeProvider';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: () => true };
// A getter, because jest.mock factories run before this file's constants are initialised.
jest.mock('../features/agent/DayCard', () => ({ DayCard: () => null }));
jest.mock('../features/agent/DailySummary', () => ({ DailySummary: () => null }));
jest.mock('../features/agent/AgentCard', () => ({ AgentCard: () => null }));
jest.mock('../features/reminders/smartSync', () => ({ useSmartReminderSync: () => undefined }));
jest.mock('../features/health/hooks', () => ({
  useHealthSettings: () => ({ data: { enabled: false, importWeight: true, importSleep: true, lastSync: null, stepGoal: null } }),
  useStepHistory: () => ({ data: [] }),
  useAutoSync: () => ({ mutate: jest.fn(), isPending: false, data: undefined }),
  useManualSteps: () => ({ set: { mutate: jest.fn() }, clear: { mutate: jest.fn() } }),
  useStepGoal: () => 8000,
}));
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
}));

const mockSession = {
  setPendingConsent: jest.fn(),
  unlockPin: jest.fn(),
  unlockBiometric: jest.fn(),
  prefs: { biometricEnabled: false, autoLockSeconds: 60, blockScreenshots: true, autoWipe: false },
};
jest.mock('../security/SessionProvider', () => ({ useSession: () => mockSession }));

const baseProfile: ProfileRow = {
  id: 'me',
  name: 'Charan',
  dateOfBirth: '1996-01-01',
  sex: 'male',
  heightCm: 175,
  weightKg: 85,
  targetWeightKg: 75,
  waistCm: null,
  hipCm: null,
  goal: 'fat_loss',
  activityLevel: 'sedentary',
  occupation: null,
  sleepHours: null,
  workoutPreference: 'home',
  equipment: [],
  coachPersonality: 'strict',
  dietType: 'non_vegetarian',
  allergies: [],
  dislikedFoods: [],
  cookingTime: 'under_30',
  budget: 'medium',
  isPregnantOrBreastfeeding: false,
  hasEatingDisorderHistory: false,
  hasMedicalCondition: false,
  healthNotes: null,
  injuries: null,
  aiLanguage: 'en',
  createdAt: 't',
  updatedAt: 't',
  deletedAt: null,
};
let mockProfile: ProfileRow = baseProfile;
const mockLogWeight = jest.fn();
jest.mock('../features/profile/hooks', () => ({
  useProfile: () => ({ data: mockProfile }),
  useRecentWeights: () => ({ data: [{ id: 'w', measuredOn: '2026-11-01', weightKg: 86 }] }),
  useLogWeight: () => ({ mutateAsync: mockLogWeight, isPending: false }),
}));

let mockDiary: { kcal: number; proteinG: number; carbsG: number; fatG: number; fiberG: number }[] = [];
jest.mock('../features/food/hooks', () => ({
  useDiary: () => ({ data: mockDiary }),
}));

let mockWaterMl = 0;
const mockAddWater = jest.fn();
jest.mock('../features/progress/hooks', () => ({
  useWaterToday: () => ({ data: mockWaterMl }),
  useWaterActions: () => ({ add: { mutate: mockAddWater }, undo: { mutate: jest.fn() } }),
}));

const wrap = (ui: ReactNode) => render(<ThemeProvider>{ui}</ThemeProvider>);

beforeEach(async () => {
  jest.clearAllMocks();
  mockProfile = baseProfile;
  mockDiary = [];
  mockWaterMl = 0;
  await i18n.changeLanguage('en');
});

describe('Welcome', () => {
  it('requires both consent boxes before continuing', async () => {
    await wrap(<Welcome />);
    await fireEvent.press(screen.getByTestId('welcome-start'));
    expect(await screen.findByText('Please confirm to continue')).toBeTruthy();
    expect(mockRouter.push).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('consent-age'));
    await fireEvent.press(screen.getByTestId('consent-notice'));
    await fireEvent.press(screen.getByTestId('welcome-start'));
    expect(mockSession.setPendingConsent).toHaveBeenCalledWith(true);
    expect(mockRouter.push).toHaveBeenCalledWith('/security-setup');
  });

  it('switches the whole screen to Telugu', async () => {
    await wrap(<Welcome />);
    await fireEvent.press(screen.getByTestId('language-te'));
    expect(await screen.findByText('మొదలుపెట్టండి')).toBeTruthy();
  });
});

describe('ProfileWizard', () => {
  it('validates each step and submits parsed values', async () => {
    const onSubmit = jest.fn();
    await wrap(<ProfileWizard initial={EMPTY_PROFILE} submitLabel="See my plan" onSubmit={onSubmit} />);

    // Step 1: missing name and date.
    await fireEvent.press(screen.getByTestId('wizard-next'));
    expect(await screen.findAllByText('This is required')).toHaveLength(2);
    await fireEvent.changeText(screen.getByTestId('field-name'), 'Charan');
    // Pick dates with the calendar (mocked native picker).
    const pickDate = async (d: Date) => {
      (global as unknown as { __pickDate: Date }).__pickDate = d;
      await fireEvent.press(screen.getByTestId('field-dateOfBirth-calendar'));
      const picker = screen.queryByTestId('mock-date-picker');
      if (picker) await fireEvent.press(picker);
    };
    await pickDate(new Date(2012, 7, 15, 12));
    expect(screen.getByText('15-08-2012')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('wizard-next'));
    expect(await screen.findByText('FitMate is for adults aged 18 and over.')).toBeTruthy();
    await pickDate(new Date(1996, 10, 9, 12));
    expect(screen.getByText('09-11-1996')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('field-sex-male'));
    await fireEvent.press(screen.getByTestId('wizard-next'));

    // Step 2: numbers.
    await screen.findByTestId('wizard-step-1');
    await fireEvent.changeText(screen.getByTestId('field-heightCm'), '175');
    await fireEvent.changeText(screen.getByTestId('field-weightKg'), 'eighty');
    await fireEvent.press(screen.getByTestId('wizard-next'));
    expect(await screen.findByText('Enter a number')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('field-weightKg'), '85,5');
    await fireEvent.changeText(screen.getByTestId('field-targetWeightKg'), '500');
    await fireEvent.press(screen.getByTestId('wizard-next'));
    expect(await screen.findByText('Must be at most 350')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('field-targetWeightKg'), '75');
    await fireEvent.press(screen.getByTestId('wizard-next'));

    // Steps 3–5 keep their defaults.
    await screen.findByTestId('wizard-step-2');
    await fireEvent.press(screen.getByTestId('field-coachPersonality-strict'));
    await fireEvent.press(screen.getByTestId('wizard-next'));
    await screen.findByTestId('wizard-step-3');
    await fireEvent.changeText(screen.getByTestId('field-dislikedFoods'), 'bitter gourd, , karela');
    await fireEvent.press(screen.getByTestId('wizard-next'));
    await screen.findByTestId('wizard-step-4');
    // Pregnancy question is hidden for men.
    expect(screen.queryByTestId('field-isPregnantOrBreastfeeding')).toBeNull();
    await fireEvent.press(screen.getByTestId('wizard-submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const saved = onSubmit.mock.calls[0][0];
    expect(saved).toMatchObject({
      name: 'Charan',
      dateOfBirth: '1996-11-09',
      sex: 'male',
      heightCm: 175,
      weightKg: 85.5,
      targetWeightKg: 75,
      coachPersonality: 'strict',
      dislikedFoods: ['bitter gourd', 'karela'],
      isPregnantOrBreastfeeding: false,
    });
    expect(saved.waistCm).toBeUndefined();
  });
});

describe('Dashboard', () => {
  it('shows the calculated targets and the safety-floor note', async () => {
    await wrap(<Dashboard />);
    expect(screen.getByText('Hello, Charan')).toBeTruthy();
    // Sedentary 30-year-old man, 175 cm, 85 kg: target held at BMR ≈ 1,800 kcal.
    expect(screen.getByTestId('target-kcal')).toHaveTextContent(/1,800/);
    expect(screen.getByText(/safe minimum/)).toBeTruthy();
    expect(screen.getByText(/10 kg to go/)).toBeTruthy();
  });

  it("shows today's eaten calories and protein against the targets", async () => {
    mockDiary = [
      { kcal: 400, proteinG: 12, carbsG: 60, fatG: 10, fiberG: 3 },
      { kcal: 250, proteinG: 20, carbsG: 5, fatG: 15, fiberG: 1 },
    ];
    await wrap(<Dashboard />);
    expect(screen.getByText('650 of 1,800 kcal')).toBeTruthy();
    expect(screen.getByText('32 / 120 g')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('open-diary'));
    expect(mockRouter.navigate).toHaveBeenCalledWith('/food');
  });

  it('counts glasses of water toward the target', async () => {
    mockWaterMl = 750;
    await wrap(<Dashboard />);
    // 85 kg → 3.0 L target = 12 glasses.
    expect(screen.getByTestId('water-count')).toHaveTextContent('3 of 12 glasses · 0.75 L');
    await fireEvent.press(screen.getByTestId('water-add'));
    expect(mockAddWater).toHaveBeenCalledWith(250);
  });

  it('validates and saves a weight entry', async () => {
    await wrap(<Dashboard />);
    await fireEvent.press(screen.getByTestId('weight-log'));
    await fireEvent.changeText(screen.getByTestId('weight-input'), '12');
    await fireEvent.press(screen.getByTestId('weight-save'));
    expect(await screen.findByText('Must be at least 25')).toBeTruthy();
    expect(mockLogWeight).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId('weight-input'), '84.6');
    await fireEvent.press(screen.getByTestId('weight-save'));
    await waitFor(() => expect(mockLogWeight).toHaveBeenCalledWith(84.6));
  });

  it('shows a pregnancy safeguard instead of a calorie cut', async () => {
    mockProfile = { ...baseProfile, sex: 'female', isPregnantOrBreastfeeding: true };
    await wrap(<Dashboard />);
    expect(screen.getByText(/No calorie cut during pregnancy/)).toBeTruthy();
    expect(screen.getByText('Same as your maintenance calories')).toBeTruthy();
  });
});

describe('LockScreen', () => {
  it('needs at least 4 digits and reports a wrong PIN with the wait time', async () => {
    mockSession.unlockPin.mockResolvedValue({ ok: false, reason: 'wrong', failures: 5, retryAfterMs: 30_000, wipeIn: null });
    await wrap(<LockScreen />);
    await fireEvent.press(screen.getByTestId('pin-1'));
    await fireEvent.press(screen.getByTestId('unlock'));
    expect(mockSession.unlockPin).not.toHaveBeenCalled();
    for (const d of ['2', '3', '4', '5']) await fireEvent.press(screen.getByTestId(`pin-${d}`));
    await fireEvent.press(screen.getByTestId('unlock'));
    await waitFor(() => expect(mockSession.unlockPin).toHaveBeenCalledWith('12345'));
    expect(await screen.findByText(/Wait 30 s/)).toBeTruthy();
  });
});
