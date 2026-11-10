import { CoachError } from '@fitmate/coach';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import CoachScreen from '../app/(tabs)/coach';
import AiSettings from '../app/settings/ai';
import i18n from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';

const mockPush = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('../features/coach/service', () => ({ pruneChat: jest.fn() }));
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), back: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => mockParams,
}));

const mockSpeak = jest.fn();
jest.mock('expo-speech', () => ({ speak: (...a: unknown[]) => mockSpeak(...a), stop: jest.fn() }));

// Speech recognition: capture event listeners so tests can fire them.
const mockListeners: Record<string, (e: unknown) => void> = {};
const mockStart = jest.fn();
let mockAvailable = true;
let mockGranted = true;
jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    isRecognitionAvailable: () => mockAvailable,
    requestPermissionsAsync: async () => ({ granted: mockGranted }),
    start: (o: unknown) => mockStart(o),
    stop: jest.fn(),
  },
  useSpeechRecognitionEvent: (name: string, fn: (e: unknown) => void) => {
    mockListeners[name] = fn;
  },
}));

let mockStatus = { connected: true, model: 'gemini-3.6-flash' };
let mockMessages: { id: string; role: 'user' | 'coach'; text: string; flags: string[]; actions: unknown[]; createdAt: string }[] = [];
let mockSendState: { isPending: boolean; isError: boolean; error: unknown } = { isPending: false, isError: false, error: null };
const mockSend = jest.fn();
const mockConnect = jest.fn();
let mockConnectState: { isPending: boolean; isError: boolean; error: unknown } = { isPending: false, isError: false, error: null };
const mockDisconnect = jest.fn();
const mockForget = jest.fn();
let mockReadAloud = false;
const mockDecide = jest.fn();
const mockDecideAsync = jest.fn();
const mockSetAgent = jest.fn();
jest.mock('../features/coach/hooks', () => ({
  useAiStatus: () => ({ data: mockStatus }),
  useCoachMessages: () => ({ data: mockMessages }),
  useCoachMemory: () => ({ data: [{ id: 'm1', text: 'Works night shifts' }] }),
  useSendMessage: () => ({ mutate: mockSend, ...mockSendState }),
  useClearChat: () => ({ mutate: jest.fn() }),
  useDeleteMemory: () => ({ mutate: mockForget }),
  useConnectAi: () => ({ mutate: mockConnect, ...mockConnectState }),
  useDisconnectAi: () => ({ mutate: mockDisconnect, isPending: false }),
  useReadAloud: () => ({ data: mockReadAloud }),
  useSetReadAloud: () => ({ mutate: jest.fn() }),
  useActionDecision: () => ({ mutate: mockDecide, mutateAsync: mockDecideAsync, isPending: false, data: undefined }),
  useAgentSettings: () => ({ data: { actions: 'confirm', retentionDays: 90 } }),
  useSetAgentSetting: () => ({ mutate: mockSetAgent }),
}));
jest.mock('../features/profile/hooks', () => ({ useProfile: () => ({ data: { aiLanguage: 'te' } }) }));

const wrap = (el: React.ReactElement) => render(<ThemeProvider>{el}</ThemeProvider>);
const msg = (role: 'user' | 'coach', text: string, flags: string[] = [], actions: unknown[] = []) => ({ id: `${role}-${text}`, role, text, flags, actions, createdAt: '' });

beforeEach(async () => {
  jest.clearAllMocks();
  mockStatus = { connected: true, model: 'gemini-3.6-flash' };
  mockMessages = [];
  mockSendState = { isPending: false, isError: false, error: null };
  mockConnectState = { isPending: false, isError: false, error: null };
  mockAvailable = true;
  mockGranted = true;
  mockReadAloud = false;
  mockParams = {};
  await i18n.changeLanguage('en');
});

describe('Coach chat', () => {
  it('asks to set up when the coach is off', async () => {
    mockStatus = { connected: false, model: '' };
    await wrap(<CoachScreen />);
    await fireEvent.press(screen.getByTestId('coach-setup-button'));
    expect(mockPush).toHaveBeenCalledWith('/settings/ai');
  });

  it('offers suggestions and sends one', async () => {
    await wrap(<CoachScreen />);
    await fireEvent.press(screen.getByTestId('suggest-dinner'));
    expect(mockSend).toHaveBeenCalledWith({ text: 'What should I eat for dinner to hit my protein?' }, expect.anything());
  });

  it('sends typed text and clears the box', async () => {
    await wrap(<CoachScreen />);
    await fireEvent.changeText(screen.getByTestId('coach-input'), '  eggs or paneer?  ');
    await fireEvent.press(screen.getByTestId('send'));
    expect(mockSend).toHaveBeenCalledWith({ text: 'eggs or paneer?' }, expect.anything());
    expect(screen.getByTestId('coach-input').props.value).toBe('');
  });

  it('starts with a prefilled question from the kitchen assistant', async () => {
    mockParams = { prefill: 'I have: Egg. Suggest one easy dish.' };
    await wrap(<CoachScreen />);
    expect(screen.getByTestId('coach-input').props.value).toBe('I have: Egg. Suggest one easy dish.');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('shows replies as plain text', async () => {
    mockMessages = [msg('user', 'dinner?'), msg('coach', '**Try:** dal\n* 2 rotis')];
    await wrap(<CoachScreen />);
    expect(screen.getByText('Try: dal\n• 2 rotis')).toBeTruthy();
    expect(screen.queryByTestId('send-error')).toBeNull();
  });

  it('shows helplines for flagged messages', async () => {
    mockMessages = [msg('user', 'I want to die', ['crisis']), msg('user', 'chest pain', ['emergency'])];
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await wrap(<CoachScreen />);
    await fireEvent.press(screen.getByTestId('call-telemanas'));
    expect(open).toHaveBeenCalledWith('tel:14416');
    await fireEvent.press(screen.getByTestId('call-112'));
    expect(open).toHaveBeenCalledWith('tel:112');
  });

  it('explains errors and retries', async () => {
    mockMessages = [msg('user', 'hi')];
    mockSendState = { isPending: false, isError: true, error: new CoachError('quota', 'x') };
    await wrap(<CoachScreen />);
    expect(screen.getByText(/free daily limit/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('retry'));
    expect(mockSend).toHaveBeenCalledWith({ retry: true }, expect.anything());
  });

  it('notices an unanswered message after reopening', async () => {
    mockMessages = [msg('user', 'hi')];
    await wrap(<CoachScreen />);
    expect(screen.getByText('Your last message wasn’t answered.')).toBeTruthy();
  });
});

describe('Coach actions', () => {
  it('shows a proposed food log with matched foods and runs it only on Confirm', async () => {
    mockMessages = [
      msg('user', 'I had 2 dosas and sambar'),
      msg('coach', 'Tap Confirm to log it.', [], [{ action: { type: 'log_food', meal: 'breakfast', items: [{ name: 'dosa', count: 2, unit: 'piece' }, { name: 'unicorn steak' }] }, status: 'proposed' }]),
    ];
    await wrap(<CoachScreen />);
    expect(screen.getByText('Log to Breakfast:')).toBeTruthy();
    expect(screen.getByText(/Dosa.*2/)).toBeTruthy();
    expect(screen.getByText(/unicorn steak — not in the food list/)).toBeTruthy();
    expect(mockDecide).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('action-confirm-0'));
    expect(mockDecide).toHaveBeenCalledWith(expect.objectContaining({ index: 0, confirm: true }));
    await fireEvent.press(screen.getByTestId('action-dismiss-0'));
    expect(mockDecide).toHaveBeenLastCalledWith(expect.objectContaining({ confirm: false }));
  });

  it('applies several proposed changes with one tap and carries on after a failure', async () => {
    mockDecideAsync.mockRejectedValueOnce(new Error('db')).mockResolvedValue({ done: 1, skipped: [] });
    mockMessages = [
      msg('user', 'skipped my workout, tired'),
      msg('coach', 'Here is the plan.', [], [
        { action: { type: 'log_water', ml: 500 }, status: 'proposed' },
        { action: { type: 'log_sleep', bed: '22:30', wake: '06:30' }, status: 'done' },
        { action: { type: 'set_reminder', label: 'Walk', time: '18:30' }, status: 'proposed' },
      ]),
    ];
    await wrap(<CoachScreen />);
    expect(screen.getByText('Here’s what I suggest changing:')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('apply-all'));
    await act(async () => {});
    expect(mockDecideAsync).toHaveBeenCalledTimes(2);
    expect(mockDecideAsync).toHaveBeenNthCalledWith(1, expect.objectContaining({ index: 0, confirm: true }));
    expect(mockDecideAsync).toHaveBeenNthCalledWith(2, expect.objectContaining({ index: 2, confirm: true }));
  });

  it('picks up a new question while the Coach tab is already open', async () => {
    mockParams = { prefill: 'first', n: '1' };
    const r = await wrap(<CoachScreen />);
    expect(screen.getByTestId('coach-input').props.value).toBe('first');
    mockParams = { prefill: 'second question', n: '2' };
    await r.rerender(<ThemeProvider><CoachScreen /></ThemeProvider>);
    expect(screen.getByTestId('coach-input').props.value).toBe('second question');
  });

  it('has no Apply all for a single change', async () => {
    mockMessages = [msg('user', 'water'), msg('coach', 'Ok', [], [{ action: { type: 'log_water', ml: 250 }, status: 'proposed' }])];
    await wrap(<CoachScreen />);
    expect(screen.queryByTestId('apply-all')).toBeNull();
    expect(screen.getByTestId('coach-status')).toHaveTextContent('Online');
  });

  it('shows the result of a finished action', async () => {
    mockMessages = [msg('user', 'water'), msg('coach', 'Done?', [], [{ action: { type: 'log_water', ml: 500 }, status: 'done' }])];
    await wrap(<CoachScreen />);
    expect(screen.getByText('Add 500 ml of water today')).toBeTruthy();
    expect(screen.getByTestId('action-status-0')).toHaveTextContent('✓ Done');
    expect(screen.queryByTestId('action-confirm-0')).toBeNull();
  });
});

describe('Coach voice', () => {
  it('starts listening when opened from the Home mic button', async () => {
    mockParams = { listen: '1', n: '1' };
    await wrap(<CoachScreen />);
    await act(async () => {});
    expect(mockStart).toHaveBeenCalled();
  });

  it('listens in Telugu and puts the transcript in the box', async () => {
    await wrap(<CoachScreen />);
    await fireEvent.press(screen.getByTestId('mic'));
    expect(mockStart).toHaveBeenCalledWith({ lang: 'te-IN', interimResults: true, continuous: false });
    await act(async () => {
      mockListeners.start?.(undefined);
      mockListeners.result?.({ isFinal: false, results: [{ transcript: 'రాత్రి' }] });
    });
    expect(screen.getByTestId('listening')).toHaveTextContent('రాత్రి');
    await act(async () => {
      mockListeners.result?.({ isFinal: true, results: [{ transcript: 'రాత్రి ఏం తినాలి' }] });
      mockListeners.end?.(undefined);
    });
    expect(screen.getByTestId('coach-input').props.value).toBe('రాత్రి ఏం తినాలి');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('explains when voice typing is unavailable or not allowed', async () => {
    mockAvailable = false;
    await wrap(<CoachScreen />);
    await fireEvent.press(screen.getByTestId('mic'));
    expect(screen.getByTestId('voice-error')).toHaveTextContent(/Install or update the Google app/);
    mockAvailable = true;
    mockGranted = false;
    await fireEvent.press(screen.getByTestId('mic'));
    expect(screen.getByTestId('voice-error')).toHaveTextContent(/microphone access/);
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('reads replies aloud in the coach language', async () => {
    mockMessages = [msg('user', 'hi'), msg('coach', '**Well done!** 💪')];
    await wrap(<CoachScreen />);
    await fireEvent.press(screen.getByLabelText('Read aloud'));
    expect(mockSpeak).toHaveBeenCalledWith('Well done!', { language: 'te-IN' });
  });
});

describe('AI coach settings', () => {
  it('needs agreement before the key field appears, then connects', async () => {
    mockStatus = { connected: false, model: '' };
    await wrap(<AiSettings />);
    expect(screen.getByText(/name, date of birth and health notes are not sent/)).toBeTruthy();
    expect(screen.queryByTestId('ai-key')).toBeNull();
    await fireEvent.press(screen.getByTestId('ai-agree'));
    await fireEvent.changeText(screen.getByTestId('ai-key'), ' AIzaSyA-123456789012345678901234567890 ');
    expect(screen.getByTestId('ai-key').props.secureTextEntry).toBe(true);
    await fireEvent.press(screen.getByTestId('ai-connect'));
    expect(mockConnect).toHaveBeenCalledWith('AIzaSyA-123456789012345678901234567890', expect.anything());
  });

  it('shows why a key failed', async () => {
    mockStatus = { connected: false, model: '' };
    mockConnectState = { isPending: false, isError: true, error: new CoachError('invalid_key', 'bad') };
    await wrap(<AiSettings />);
    await fireEvent.press(screen.getByTestId('ai-agree'));
    expect(screen.getByText(/That key didn’t work/)).toBeTruthy();
  });

  it('manages memory and turns the coach off', async () => {
    await wrap(<AiSettings />);
    expect(screen.getByTestId('ai-provider')).toHaveTextContent('Google Gemini · gemini-3.6-flash');
    await fireEvent.press(screen.getByTestId('forget-m1'));
    expect(mockForget).toHaveBeenCalledWith('m1');
    await fireEvent.press(screen.getByTestId('disconnect-ai'));
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('controls coach actions and chat history length', async () => {
    await wrap(<AiSettings />);
    expect(screen.getByText(/never your name, date of birth or health notes/)).toBeTruthy();
    await fireEvent(screen.getByTestId('agent-actions'), 'press');
    expect(mockSetAgent).toHaveBeenCalledWith({ key: 'coachActions', value: 'off' });
    await fireEvent.press(screen.getByTestId('agent-retention-30'));
    expect(mockSetAgent).toHaveBeenCalledWith({ key: 'chatRetentionDays', value: 30 });
  });
});
