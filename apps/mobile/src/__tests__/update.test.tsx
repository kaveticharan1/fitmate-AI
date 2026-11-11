import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import i18n from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true }, useLocalSearchParams: () => mockParams }));
let mockParams: { start?: string } = {};

type Listener = (p: { received: number; total: number }) => void;
const mockNative: { current: Record<string, jest.Mock> | null } = { current: null };
let progressCb: Listener | null = null;
jest.mock('../../modules/fitmate-share', () => ({
  get FitmateShare() {
    return mockNative.current;
  },
}));

const makeNative = (over: Record<string, jest.Mock> = {}) => ({
  appInfo: jest.fn(() => ({ versionCode: 24, versionName: '1.8.0', abis: ['arm64-v8a'] })),
  canInstall: jest.fn(() => true),
  openInstallSettings: jest.fn(() => true),
  downloadedUpdate: jest.fn(() => null),
  downloadUpdate: jest.fn(async () => {
    progressCb?.({ received: 21, total: 42 });
    return { versionCode: 25, versionName: '1.9.0', bytes: 42 };
  }),
  installUpdate: jest.fn(async () => true),
  addListener: jest.fn((_e: string, cb: Listener) => {
    progressCb = cb;
    return { remove: jest.fn() };
  }),
  appSize: jest.fn(() => 0),
  shareApp: jest.fn(),
  ...over,
});

const latestJson = { version: '1.9.0', versionCode: 25, apk: 'https://github.com/kaveticharan1/fitmate-AI/releases/download/v1.9.0-build33/FitMate.apk', bytes: 42_000_000 };
const mockFetch = jest.fn();

// eslint-disable-next-line @typescript-eslint/no-require-imports
const load = () => require('../app/update').default as React.ComponentType;
const wrap = () => {
  const Screen = load();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <Screen />
      </ThemeProvider>
    </QueryClientProvider>,
  );
};

beforeEach(async () => {
  jest.restoreAllMocks();
  mockParams = {};
  progressCb = null;
  mockNative.current = makeNative();
  mockFetch.mockReset().mockResolvedValue({ ok: true, status: 200, json: async () => latestJson });
  global.fetch = mockFetch as never;
  await i18n.changeLanguage('en');
});

describe('App updates', () => {
  it('downloads the new version and opens the Android installer', async () => {
    await wrap();
    await waitFor(() => expect(screen.getByTestId('update-status')).toHaveTextContent('FitMate 1.9.0 is ready (40 MB)'));
    expect(screen.getByTestId('update-current')).toHaveTextContent('You have FitMate 1.8.0');
    await fireEvent.press(screen.getByTestId('update-go'));
    await waitFor(() => expect(mockNative.current!.installUpdate).toHaveBeenCalled());
    expect(mockNative.current!.downloadUpdate).toHaveBeenCalledWith(latestJson.apk);
    expect(screen.getByText(/Tap “Update” on the Android screen/)).toBeTruthy();
  });

  it('starts by itself when opened from the Home banner', async () => {
    mockParams = { start: '1' };
    await wrap();
    await waitFor(() => expect(mockNative.current!.installUpdate).toHaveBeenCalled());
  });

  it('reuses an update that was already downloaded', async () => {
    mockNative.current = makeNative({ downloadedUpdate: jest.fn(() => ({ versionCode: 25, versionName: '1.9.0', bytes: 42 })) });
    await wrap();
    await waitFor(() => screen.getByTestId('update-go'));
    await fireEvent.press(screen.getByTestId('update-go'));
    await waitFor(() => expect(mockNative.current!.installUpdate).toHaveBeenCalled());
    expect(mockNative.current!.downloadUpdate).not.toHaveBeenCalled();
  });

  it('asks once for install permission, then carries on after returning', async () => {
    let allowed = false;
    let onChange: ((s: string) => void) | null = null;
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_t: string, cb: (s: string) => void) => {
      onChange = cb;
      return { remove: jest.fn() };
    }) as never);
    mockNative.current = makeNative({ canInstall: jest.fn(() => allowed) });
    await wrap();
    await waitFor(() => screen.getByTestId('update-go'));
    await fireEvent.press(screen.getByTestId('update-go'));
    expect(mockNative.current.openInstallSettings).toHaveBeenCalled();
    expect(screen.getByText(/Allow from this source/)).toBeTruthy();
    expect(mockNative.current.downloadUpdate).not.toHaveBeenCalled();
    allowed = true;
    await act(async () => onChange?.('active'));
    await waitFor(() => expect(mockNative.current!.installUpdate).toHaveBeenCalled());
  });

  it('refuses a download signed with a different key and says so', async () => {
    mockNative.current = makeNative({ downloadUpdate: jest.fn().mockRejectedValue(Object.assign(new Error('x'), { code: 'SIGNATURE_MISMATCH' })) });
    await wrap();
    await waitFor(() => screen.getByTestId('update-go'));
    await fireEvent.press(screen.getByTestId('update-go'));
    await waitFor(() => expect(screen.getByText(/isn’t signed by FitMate/)).toBeTruthy());
    expect(mockNative.current.installUpdate).not.toHaveBeenCalled();
    expect(screen.getByTestId('update-go')).toHaveTextContent('Try again');
  });

  it('says when you already have the newest version', async () => {
    mockNative.current = makeNative({ appInfo: jest.fn(() => ({ versionCode: 25, versionName: '1.9.0', abis: [] })) });
    await wrap();
    await waitFor(() => expect(screen.getByTestId('update-status')).toHaveTextContent('You have the newest version.'));
    expect(screen.queryByTestId('update-go')).toBeNull();
  });

  it('handles being offline', async () => {
    mockFetch.mockRejectedValue(new Error('Network request failed'));
    await wrap();
    await waitFor(() => expect(screen.getByTestId('update-status')).toHaveTextContent(/Couldn’t check right now/), { timeout: 4000 });
  }, 10000);

  it('shows the download link where in-app updates are not available', async () => {
    mockNative.current = null;
    await wrap();
    expect(screen.getByText(/releases\/latest\/download\/FitMate.apk/)).toBeTruthy();
  });

  it('speaks Telugu', async () => {
    await i18n.changeLanguage('te');
    await wrap();
    await waitFor(() => expect(screen.getByText('డౌన్‌లోడ్ చేసి ఇన్‌స్టాల్ చేయి')).toBeTruthy());
  });
});

describe('Home update banner', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Banner = () => (require('../features/update/UpdateBanner') as typeof import('../features/update/UpdateBanner')).UpdateBanner;
  const wrapBanner = () => {
    const B = Banner();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    return render(
      <QueryClientProvider client={qc}>
        <ThemeProvider>
          <B />
        </ThemeProvider>
      </QueryClientProvider>,
    );
  };

  it('appears when a newer version is out and opens the update screen', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { router } = require('expo-router') as { router: { push: jest.Mock } };
    await wrapBanner();
    await waitFor(() => expect(screen.getByTestId('update-banner')).toHaveTextContent(/FitMate 1.9.0 is out/));
    await fireEvent.press(screen.getByTestId('update-banner-go'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/update', params: { start: '1' } });
  });

  it('stays hidden when up to date', async () => {
    mockNative.current = makeNative({ appInfo: jest.fn(() => ({ versionCode: 25, versionName: '1.9.0', abis: [] })) });
    await wrapBanner();
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(screen.queryByTestId('update-banner')).toBeNull();
  });
});
