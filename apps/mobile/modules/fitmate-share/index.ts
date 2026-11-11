import { requireOptionalNativeModule } from 'expo';

interface FitmateShareNative {
  appSize(): number;
  shareApp(message: string, chooserTitle: string): Promise<boolean>;
}

/** Null on iOS, in tests, and in builds without the module. */
export const FitmateShare = requireOptionalNativeModule<FitmateShareNative>('FitmateShare');
