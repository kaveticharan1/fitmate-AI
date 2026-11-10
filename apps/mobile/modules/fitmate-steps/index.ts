import { requireOptionalNativeModule } from 'expo';

export interface StepReading {
  /** Steps since the phone last started. */
  total: number;
  /** When the phone last started (ms since 1970). */
  bootMs: number;
}

interface FitmateStepsNative {
  isAvailable(): boolean;
  readTotal(timeoutMs: number): Promise<StepReading | null>;
  startWatching(): boolean;
  stopWatching(): void;
  addListener(event: 'onSteps', cb: (r: StepReading) => void): { remove(): void };
}

/** Null on iOS, in tests, and in builds without the module. */
export const FitmateSteps = requireOptionalNativeModule<FitmateStepsNative>('FitmateSteps');
