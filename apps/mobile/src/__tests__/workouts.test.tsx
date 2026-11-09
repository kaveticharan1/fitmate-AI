import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { getWorkout } from '@fitmate/workouts';
import WorkoutTab from '../app/(tabs)/workout';
import WorkoutDetail from '../app/workout/detail';
import WorkoutSession from '../app/workout/session';
import { beginWorkout, getActiveWorkout, setActiveWorkout } from '../features/workouts/activeSession';
import i18n from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';

const mockPush = jest.fn();
const mockBack = jest.fn();
let mockParams: { id?: string } = {};
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), back: () => mockBack(), canGoBack: () => true },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));
const mockSpeak = jest.fn();
jest.mock('expo-speech', () => ({ speak: (...a: unknown[]) => mockSpeak(...a), stop: jest.fn() }));

let mockProfile: Record<string, unknown> = {};
jest.mock('../features/profile/hooks', () => ({ useProfile: () => ({ data: mockProfile }) }));

let mockHistory: unknown[] = [];
let mockVoice = false;
const mockSave = jest.fn();
const mockSetVoice = jest.fn();
jest.mock('../db/workoutRepo', () => ({}));
jest.mock('../db/repositories', () => ({}));
jest.mock('../features/workouts/hooks', () => {
  const actual = jest.requireActual('../features/workouts/hooks');
  return {
    ...actual,
    useWorkoutHistory: () => ({ data: mockHistory }),
    useSaveWorkout: () => ({ mutate: mockSave }),
    useVoiceCues: () => ({ data: mockVoice }),
    useSetVoiceCues: () => ({ mutate: mockSetVoice }),
  };
});

const wrap = (el: React.ReactElement) => render(<ThemeProvider>{el}</ThemeProvider>);

beforeEach(async () => {
  jest.clearAllMocks();
  mockProfile = { equipment: [], workoutPreference: 'home', injuries: null, activityLevel: 'light', weightKg: 80 };
  mockHistory = [];
  mockVoice = false;
  mockParams = {};
  setActiveWorkout(null);
  await i18n.changeLanguage('en');
});

describe('Workout tab', () => {
  it('suggests a workout and lists only what you can do', async () => {
    await wrap(<WorkoutTab />);
    expect(screen.getByTestId('today-workout')).toBeTruthy();
    expect(screen.getByTestId('workout-home_beginner')).toBeTruthy();
    expect(screen.queryByTestId('workout-gym_beginner')).toBeNull();
    expect(screen.queryByTestId('workout-dumbbell_full')).toBeNull();
    expect(screen.getByText('Finished workouts will show up here.')).toBeTruthy();
  });

  it('filters by kind and shows the week summary', async () => {
    mockHistory = [{ id: 'h1', workoutId: 'walk_30', doneOn: '2099-01-01', durationS: 1800, estKcal: 160 }];
    await wrap(<WorkoutTab />);
    await fireEvent.press(screen.getByTestId('workout-filter-stretch'));
    expect(screen.getByTestId('workout-stretch_daily')).toBeTruthy();
    expect(screen.queryByTestId('workout-home_beginner')).toBeNull();
    expect(screen.getByTestId('history-h1')).toBeTruthy();
    expect(screen.getByTestId('week-count')).toHaveTextContent('1 workouts · 30 min');
  });

  it('shows a resume card for a workout in progress', async () => {
    beginWorkout(getWorkout('home_beginner')!, 50);
    await wrap(<WorkoutTab />);
    await fireEvent.press(screen.getByTestId('resume-workout'));
    expect(mockPush).toHaveBeenCalledWith('/workout/session');
  });
});

describe('Workout detail', () => {
  it('swaps knee-heavy exercises when the profile mentions knee pain', async () => {
    mockParams = { id: 'home_intermediate' };
    mockProfile = { ...mockProfile, injuries: 'knee pain' };
    await wrap(<WorkoutDetail />);
    expect(screen.getByText(/were swapped or removed because of the injuries/)).toBeTruthy();
    expect(screen.queryByText('Bodyweight squat')).toBeNull();
    expect(screen.queryByText('Reverse lunge')).toBeNull();
  });

  it('starts a session', async () => {
    mockParams = { id: 'home_beginner' };
    await wrap(<WorkoutDetail />);
    await fireEvent.press(screen.getByTestId('start-workout'));
    expect(getActiveWorkout()?.workout.id).toBe('home_beginner');
    expect(mockPush).toHaveBeenCalledWith('/workout/session');
  });
});

describe('Workout session', () => {
  const tiny = {
    id: 'home_beginner',
    name: 'Tiny',
    nameTe: 'Tiny',
    kind: 'home' as const,
    level: 1 as const,
    steps: [
      { exerciseId: 'squat', sets: 2, amount: 10, restSec: 30 },
      { exerciseId: 'plank', sets: 1, amount: 20, restSec: 0 },
    ],
  };

  it('goes through sets, rest, easier swap and saves at the end', async () => {
    beginWorkout(tiny, 30);
    await wrap(<WorkoutSession />);
    expect(screen.getByTestId('current-exercise')).toHaveTextContent('Bodyweight squat');
    expect(screen.getByText('Set 1 of 2')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('complete-set'));
    expect(screen.getByTestId('rest-card')).toBeTruthy();
    expect(screen.getByText('Next: set 2 of 2')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('skip-rest'));

    // Make the second set easier.
    await fireEvent.press(screen.getByTestId('easier'));
    expect(screen.getByTestId('current-exercise')).toHaveTextContent('Chair squat');
    await fireEvent.press(screen.getByTestId('complete-set'));
    await fireEvent.press(screen.getByTestId('skip-rest'));

    expect(screen.getByTestId('current-exercise')).toHaveTextContent('Plank');
    expect(screen.getByTestId('start-timer')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('complete-set'));

    expect(screen.getByTestId('workout-done')).toHaveTextContent(/3 of 3 sets/);
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave.mock.calls[0][0]).toMatchObject({ workoutId: 'home_beginner', completedSets: 3, totalSets: 3, estKcal: 30, exerciseIds: ['chair_squat', 'plank'] });

    await fireEvent.press(screen.getByTestId('close-workout'));
    expect(getActiveWorkout()).toBeNull();
    expect(mockBack).toHaveBeenCalled();
  });

  it('runs the rest countdown on its own', async () => {
    // Fake timers don't mix with RNTL's async render, so move the clock with Date.now and let the real interval tick.
    const realNow = Date.now.bind(Date);
    let offset = 0;
    const spy = jest.spyOn(Date, 'now').mockImplementation(() => realNow() + offset);
    try {
      beginWorkout(tiny, 30);
      await wrap(<WorkoutSession />);
      await fireEvent.press(screen.getByTestId('complete-set'));
      expect(screen.getByTestId('rest-timer')).toHaveTextContent('0:30');
      offset = 31_000;
      await act(() => new Promise((r) => setTimeout(r, 400)));
      expect(screen.queryByTestId('rest-card')).toBeNull();
      expect(screen.getByText('Set 2 of 2')).toBeTruthy();
    } finally {
      spy.mockRestore();
    }
  });

  it('finishes a timed set when its timer runs out', async () => {
    const realNow = Date.now.bind(Date);
    let offset = 0;
    const spy = jest.spyOn(Date, 'now').mockImplementation(() => realNow() + offset);
    try {
      beginWorkout({ ...tiny, steps: [{ exerciseId: 'plank', sets: 2, amount: 20, restSec: 0 }] }, 10);
      await wrap(<WorkoutSession />);
      await fireEvent.press(screen.getByTestId('start-timer'));
      expect(screen.getByTestId('current-amount')).toHaveTextContent('0:20');
      offset = 21_000;
      await act(() => new Promise((r) => setTimeout(r, 400)));
      expect(screen.getByText('Set 2 of 2')).toBeTruthy();
      expect(screen.getByTestId('start-timer')).toBeTruthy();
    } finally {
      spy.mockRestore();
    }
  });

  it('does not save a workout ended before any set', async () => {
    beginWorkout(tiny, 30);
    await wrap(<WorkoutSession />);
    await fireEvent.press(screen.getByTestId('finish-early'));
    expect(screen.getByText('No sets were done, so nothing was saved.')).toBeTruthy();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('speaks cues only when voice is on', async () => {
    beginWorkout(tiny, 30);
    await wrap(<WorkoutSession />);
    expect(mockSpeak).not.toHaveBeenCalled();
    screen.unmount();
    setActiveWorkout(null);

    mockVoice = true;
    beginWorkout(tiny, 30);
    await wrap(<WorkoutSession />);
    expect(mockSpeak).toHaveBeenCalledWith('Bodyweight squat. 10 reps. Set 1 of 2.', { language: 'en-IN' });
  });
});
