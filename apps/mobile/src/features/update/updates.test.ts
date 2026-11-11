import { compareVersions, fetchLatest, isNewer, LATEST_APK_URL, toMb, updateErrorKey } from './updates';

const res = (status: number, body: unknown) => ({ ok: status < 300, status, json: async () => body }) as Response;

describe('update checks', () => {
  it('reads latest.json written by the release build', async () => {
    const f = jest.fn().mockResolvedValueOnce(
      res(200, { version: '1.9.0', versionCode: 25, apk: 'https://github.com/kaveticharan1/fitmate-AI/releases/download/v1.9.0-build33/FitMate.apk', bytes: 42_000_000 }),
    );
    const l = await fetchLatest(f as never);
    expect(l).toEqual({ version: '1.9.0', versionCode: 25, apkUrl: expect.stringContaining('v1.9.0-build33'), bytes: 42_000_000 });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('falls back to the release tag when there is no latest.json', async () => {
    const f = jest
      .fn()
      .mockResolvedValueOnce(res(404, {}))
      .mockResolvedValueOnce(res(200, { tag_name: 'v1.8.0-build32', assets: [{ name: 'FitMate.apk', size: 51_350_648 }] }));
    expect(await fetchLatest(f as never)).toEqual({ version: '1.8.0', versionCode: null, apkUrl: LATEST_APK_URL, bytes: 51_350_648 });
  });

  it('never downloads from a non-GitHub address in latest.json', async () => {
    const f = jest
      .fn()
      .mockResolvedValueOnce(res(200, { version: '9.9.9', versionCode: 99, apk: 'https://evil.example/FitMate.apk' }))
      .mockResolvedValueOnce(res(200, { tag_name: 'v1.9.0-build33', assets: [] }));
    const l = await fetchLatest(f as never);
    expect(l.apkUrl).toBe(LATEST_APK_URL);
    expect(l.version).toBe('1.9.0');
  });

  it('throws when offline', async () => {
    const f = jest.fn().mockRejectedValue(new Error('Network request failed'));
    await expect(fetchLatest(f as never)).rejects.toThrow();
  });

  it('compares versions numerically', () => {
    expect(compareVersions('1.10.0', '1.9.2')).toBe(1);
    expect(compareVersions('1.8.0', '1.8.0')).toBe(0);
    expect(compareVersions('1.7.9', '1.8')).toBe(-1);
  });

  it('prefers the build number when known', () => {
    const cur = { versionCode: 24, versionName: '1.8.0' };
    expect(isNewer({ version: '1.8.0', versionCode: 25, apkUrl: '', bytes: null }, cur)).toBe(true);
    expect(isNewer({ version: '1.9.0', versionCode: 24, apkUrl: '', bytes: null }, cur)).toBe(false);
    expect(isNewer({ version: '1.9.0', versionCode: null, apkUrl: '', bytes: null }, cur)).toBe(true);
    expect(isNewer({ version: '1.8.0', versionCode: null, apkUrl: '', bytes: null }, cur)).toBe(false);
  });

  it('maps native errors to friendly messages', () => {
    expect(updateErrorKey({ code: 'SIGNATURE_MISMATCH' })).toBe('signature');
    expect(updateErrorKey({ code: 'DOWNLOAD_FAILED' })).toBe('offline');
    expect(updateErrorKey({ code: 'WRONG_APP' })).toBe('badFile');
    expect(updateErrorKey(new Error('x'))).toBe('generic');
    expect(toMb(42_000_000)).toBe(40);
    expect(toMb(null)).toBeNull();
  });
});
