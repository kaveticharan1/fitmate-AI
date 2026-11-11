import { fireEvent, render, screen } from '@testing-library/react-native';
import { Share } from 'react-native';
import Buddies from '../app/buddies';
import { BuddyError } from '../features/buddies/client';
import i18n from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true } }));
let mockMembership: unknown = null;
let mockGroup: { data?: unknown; error?: unknown; isLoading?: boolean } = {};
const mockCreate = jest.fn();
const mockJoin = jest.fn();
const mockLeave = jest.fn();
const mockCheer = jest.fn();
const mockSetShare = jest.fn();
let mockCreateError: unknown = null;
jest.mock('../features/buddies/hooks', () => ({
  useMembership: () => ({ data: mockMembership, isLoading: false }),
  useBuddyGroup: () => ({ isLoading: false, isFetching: false, refetch: jest.fn(), ...mockGroup }),
  useShareSettings: () => ({ data: { steps: true, workouts: true, water: true, streak: true, weightTrend: false } }),
  useCreateGroup: () => ({ mutate: mockCreate, isPending: false, error: mockCreateError }),
  useJoinGroup: () => ({ mutate: mockJoin, isPending: false, error: null }),
  useLeaveGroup: () => ({ mutate: mockLeave, isPending: false, error: null }),
  useCheer: () => ({ mutate: mockCheer, isPending: false, error: null }),
  useSetShare: () => ({ mutate: mockSetShare }),
}));
let mockGentle = false;
jest.mock('../features/profile/hooks', () => ({ useProfile: () => ({ data: { name: 'Charan', hasEatingDisorderHistory: mockGentle } }) }));

const wrap = () => render(<ThemeProvider><Buddies /></ThemeProvider>);
const today = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();
const group = {
  group: { id: 'g', name: 'Morning walkers', code: 'ABCD2345' },
  me: 'me',
  members: [
    { id: 'me', name: 'Charan', lastSeen: '', day: today, summary: { steps: 5000, stepGoal: 8000, loggedToday: true }, updatedAt: new Date().toISOString() },
    { id: 'r', name: 'Ravi', lastSeen: '', day: today, summary: { steps: 9000, stepGoal: 8000, workoutsWeek: 3, streak: 5, weightTrend: 'down' }, updatedAt: new Date(Date.now() - 2 * 3600e3).toISOString() },
    { id: 'p', name: 'Priya', lastSeen: '', day: null, summary: null, updatedAt: null },
  ],
  cheers: [{ from: 'Ravi', kind: 'fire', at: new Date().toISOString() }],
};

beforeEach(async () => {
  jest.clearAllMocks();
  mockMembership = null;
  mockGroup = {};
  mockCreateError = null;
  mockGentle = false;
  await i18n.changeLanguage('en');
});

describe('Buddies — joining', () => {
  it('explains what is and is never shared', async () => {
    await wrap();
    expect(screen.getByText(/Never shared/)).toBeTruthy();
    expect(screen.getByText(/exact weight, photos/)).toBeTruthy();
  });

  it('needs agreement and a group name before creating', async () => {
    await wrap();
    await fireEvent.press(screen.getByTestId('buddies-submit'));
    expect(mockCreate).not.toHaveBeenCalled();
    expect(screen.getByText(/tick the box/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('buddies-agree'));
    await fireEvent.changeText(screen.getByTestId('buddies-group-name'), '  Morning walkers ');
    await fireEvent.press(screen.getByTestId('buddies-submit'));
    expect(mockCreate).toHaveBeenCalledWith({ groupName: 'Morning walkers', displayName: 'Charan' });
  });

  it('checks the invite code before joining', async () => {
    await wrap();
    await fireEvent.press(screen.getByTestId('buddies-mode-join'));
    await fireEvent.press(screen.getByTestId('buddies-agree'));
    await fireEvent.changeText(screen.getByTestId('buddies-code'), 'abc');
    await fireEvent.press(screen.getByTestId('buddies-submit'));
    expect(mockJoin).not.toHaveBeenCalled();
    expect(screen.getByText(/8-letter code/)).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('buddies-code'), 'abcd-2345');
    await fireEvent.press(screen.getByTestId('buddies-submit'));
    expect(mockJoin).toHaveBeenCalledWith({ code: 'ABCD2345', displayName: 'Charan' });
  });

  it('shows a friendly error from the server', async () => {
    mockCreateError = new BuddyError('network', 'x');
    await wrap();
    expect(screen.getByText(/Couldn’t reach the buddy server/)).toBeTruthy();
  });
});

describe('Buddies — in a group', () => {
  beforeEach(() => {
    mockMembership = { memberId: 'me', secret: 's', groupId: 'g', code: 'ABCD2345' };
    mockGroup = { data: group };
  });

  it('shows the group, invite code, cheers and each friend’s day', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
    await wrap();
    expect(screen.getByTestId('buddies-invite-code')).toHaveTextContent('ABCD2345');
    expect(screen.getByTestId('buddies-cheers')).toHaveTextContent(/from Ravi/);
    expect(screen.getByTestId('buddy-me')).toHaveTextContent(/Charan \(you\)/);
    expect(screen.getByTestId('buddy-r')).toHaveTextContent(/9,000 of 8,000 steps/);
    expect(screen.getByTestId('buddy-r')).toHaveTextContent(/3 workouts this week/);
    expect(screen.getByTestId('buddy-r')).toHaveTextContent(/5-day streak/);
    expect(screen.getByTestId('buddy-r')).toHaveTextContent(/Weight ↓/);
    expect(screen.getByTestId('buddy-p')).toHaveTextContent(/Hasn’t shared anything yet/);
    await fireEvent.press(screen.getByTestId('buddies-share-code'));
    expect(share).toHaveBeenCalledWith({ message: expect.stringMatching(/ABCD2345/) });
    expect(share.mock.calls[0]?.[0]).toEqual({ message: expect.stringContaining('https://github.com/kaveticharan1/fitmate-AI/releases/latest/download/FitMate.apk') });
    // No native file sharing in tests, so the app-file invite button is hidden.
    expect(screen.queryByTestId('buddies-share-app')).toBeNull();
  });

  it('sends cheers to friends but not to yourself', async () => {
    await wrap();
    expect(screen.queryByTestId('cheer-me-fire')).toBeNull();
    await fireEvent.press(screen.getByTestId('cheer-r-fire'));
    expect(mockCheer).toHaveBeenCalledWith({ to: 'r', kind: 'fire' }, expect.anything());
  });

  it('lets you change what you share; weight trend is hidden in gentle mode', async () => {
    await wrap();
    await fireEvent(screen.getByTestId('share-weight'), 'valueChange', true);
    expect(mockSetShare).toHaveBeenCalledWith(expect.objectContaining({ weightTrend: true }));
  });

  it('never offers weight trend in gentle mode', async () => {
    mockGentle = true;
    await wrap();
    expect(screen.queryByTestId('share-weight')).toBeNull();
    expect(screen.getByTestId('share-steps')).toBeTruthy();
  });

  it('asks twice before leaving', async () => {
    await wrap();
    await fireEvent.press(screen.getByTestId('buddies-leave'));
    expect(mockLeave).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('buddies-leave'));
    expect(mockLeave).toHaveBeenCalled();
  });

  it('offers to leave locally when the server no longer knows us', async () => {
    mockGroup = { data: undefined, error: new BuddyError('not_member', 'not_member') };
    await wrap();
    expect(screen.getByText(/no longer in this group/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('buddies-forget'));
    expect(mockLeave).toHaveBeenCalled();
  });
});
