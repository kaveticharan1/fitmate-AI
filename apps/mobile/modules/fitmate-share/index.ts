import { requireOptionalNativeModule } from 'expo';

export interface AppInfo {
  versionCode: number;
  versionName: string;
  /** CPU types this phone supports, best first (e.g. arm64-v8a). */
  abis: string[];
}

export interface DownloadedUpdate {
  versionCode: number;
  versionName: string;
  bytes: number;
}

export interface UpdateProgress {
  received: number;
  /** -1 when the server didn't say. */
  total: number;
}

interface FitmateShareNative {
  appSize(): number;
  shareApp(message: string, chooserTitle: string): Promise<boolean>;
  appInfo(): AppInfo;
  canInstall(): boolean;
  openInstallSettings(): boolean;
  downloadedUpdate(): DownloadedUpdate | null;
  downloadUpdate(url: string): Promise<DownloadedUpdate>;
  installUpdate(): Promise<boolean>;
  addListener(event: 'onUpdateProgress', cb: (p: UpdateProgress) => void): { remove(): void };
}

/** Null on iOS, in tests, and in builds without the module. */
export const FitmateShare = requireOptionalNativeModule<FitmateShareNative>('FitmateShare');
