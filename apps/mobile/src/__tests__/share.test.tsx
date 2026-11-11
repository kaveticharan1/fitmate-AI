import { fireEvent, render, screen } from '@testing-library/react-native';
import { Share } from 'react-native';
import i18n from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true } }));

const mockNative: { current: null | { appSize: jest.Mock; shareApp: jest.Mock } } = { current: null };
jest.mock('../../modules/fitmate-share', () => ({
  get FitmateShare() {
    return mockNative.current;
  },
}));

const LINK = 'https://github.com/kaveticharan1/fitmate-AI/releases/latest/download/FitMate.apk';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ShareApp = () => require('../app/share').default;
const wrap = () => {
  const Screen = ShareApp();
  return render(<ThemeProvider><Screen /></ThemeProvider>);
};

beforeEach(async () => {
  jest.restoreAllMocks();
  mockNative.current = null;
  await i18n.changeLanguage('en');
});

describe('Share FitMate', () => {
  it('sends the app file with a message that carries the download link', async () => {
    mockNative.current = { appSize: jest.fn(() => 31 * 1024 * 1024), shareApp: jest.fn().mockResolvedValue(true) };
    await wrap();
    expect(screen.getByTestId('share-file-card')).toHaveTextContent(/about 31 MB/);
    await fireEvent.press(screen.getByTestId('share-file'));
    expect(mockNative.current.shareApp).toHaveBeenCalledWith(expect.stringContaining(LINK), 'Share FitMate with');
  });

  it('sends a link-only message as text with the full https link', async () => {
    mockNative.current = { appSize: jest.fn(() => 0), shareApp: jest.fn() };
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
    await wrap();
    expect(screen.getByTestId('share-file-card')).not.toHaveTextContent(/MB/);
    await fireEvent.press(screen.getByTestId('share-link'));
    expect(share).toHaveBeenCalledWith({ message: expect.stringContaining(LINK) });
    expect(mockNative.current.shareApp).not.toHaveBeenCalled();
  });

  it('without file sharing, only offers the link', async () => {
    await wrap();
    expect(screen.queryByTestId('share-file-card')).toBeNull();
    expect(screen.getByTestId('share-url')).toHaveTextContent(LINK);
  });

  it('shows an error when sharing fails and stays usable', async () => {
    mockNative.current = { appSize: jest.fn(() => 0), shareApp: jest.fn().mockRejectedValue(new Error('no')) };
    await wrap();
    await fireEvent.press(screen.getByTestId('share-file'));
    expect(screen.getByText('Could not open sharing. Please try again.')).toBeTruthy();
    expect(screen.getByTestId('share-file')).toBeEnabled();
  });

  it('speaks Telugu', async () => {
    await i18n.changeLanguage('te');
    await wrap();
    expect(screen.getByText('డౌన్‌లోడ్ లింక్ పంపండి')).toBeTruthy();
  });
});
