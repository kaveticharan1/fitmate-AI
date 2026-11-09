import { act, render } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { continueInChat, logNotification, NotificationBridge, readNotificationLog } from './bridge';

const mockMessages: { role: string; text: string; flags: string[] }[] = [];
jest.mock('../../db/coachRepo', () => ({
  addMessage: (role: string, text: string, flags: string[]) => mockMessages.push({ role, text, flags }),
  hasMessageWithFlag: (f: string) => mockMessages.some((m) => m.flags.includes(f)),
}));
const mockSettings: Record<string, unknown> = {};
jest.mock('../../db/repositories', () => ({
  getSetting: (k: string, d: unknown) => (k in mockSettings ? mockSettings[k] : d),
  setSetting: (k: string, v: unknown) => {
    mockSettings[k] = v;
  },
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
const mockSnooze = jest.fn(async () => undefined);
jest.mock('./notifications', () => ({ setupCategories: jest.fn(), snooze: (...a: unknown[]) => mockSnooze(...(a as [])) }));
const mockInvalidate = jest.fn();
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: mockInvalidate }) }));

const n = Notifications as unknown as Record<string, jest.Mock>;
const response = (actionIdentifier: string, id = 'smart-workout-today') => ({
  actionIdentifier,
  notification: { date: 1, request: { identifier: id, content: { title: 'Workout time', body: 'Ready to move?', data: { kind: 'workout' } } } },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockMessages.length = 0;
  for (const k of Object.keys(mockSettings)) delete mockSettings[k];
});

describe('notification bridge', () => {
  it('turns an opened reminder into the coach’s message, once', () => {
    expect(continueInChat('r1', { title: 'Workout time', body: 'Ready to move?' })).toBe(true);
    expect(continueInChat('r1', { title: 'Workout time', body: 'Ready to move?' })).toBe(false);
    expect(mockMessages).toEqual([{ role: 'coach', text: 'Workout time — Ready to move?', flags: ['reminder', 'n:r1'] }]);
  });

  it('keeps a short history, newest first', () => {
    for (let i = 0; i < 55; i++) logNotification({ at: String(i), title: 't', body: `b${i}`, action: 'opened' });
    const log = readNotificationLog();
    expect(log).toHaveLength(50);
    expect(log[0]!.body).toBe('b54');
  });

  it('opens the chat on tap and snoozes on the Snooze button', async () => {
    let listener: (r: unknown) => void = () => undefined;
    n.addNotificationResponseReceivedListener!.mockImplementation((fn: (r: unknown) => void) => {
      listener = fn;
      return { remove: jest.fn() };
    });
    await render(<NotificationBridge />);
    await act(async () => listener(response('expo.modules.notifications.actions.DEFAULT')));
    expect(mockPush).toHaveBeenCalledWith('/coach');
    expect(mockMessages[0]!.text).toBe('Workout time — Ready to move?');

    await act(async () => listener(response('snooze', 'smart-meal-lunch-today')));
    expect(mockSnooze).toHaveBeenCalledWith(expect.objectContaining({ title: 'Workout time' }));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(readNotificationLog().map((l) => l.action)).toEqual(['snoozed', 'opened']);
  });

  it('handles the tap that launched the app after unlocking', async () => {
    n.getLastNotificationResponseAsync!.mockResolvedValueOnce(response('expo.modules.notifications.actions.DEFAULT'));
    await render(<NotificationBridge />);
    await act(async () => {});
    expect(mockPush).toHaveBeenCalledWith('/coach');
  });
});
