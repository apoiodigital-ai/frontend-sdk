import { Platform } from 'react-native';
import NativeCaneSdk from '../NativeReactNativeSdk';
import type { CapturedElement } from '../types';
import { safeAsync } from '../safety/safeguard';

/**
 * Thin, fail-safe wrapper around the native TurboModule. This is the ONLY
 * place in the JS layer that talks to native scanning code, and it is
 * invoked at exactly two moments by design (see `InactivityHeuristic.ts`):
 * once when a critical screen is registered, and again (only) if the user
 * opts in after the idle prompt and no fresh-enough cached scan exists.
 *
 * Never throws: any native failure (module not linked, no host view
 * available, exception during the walk, unsupported platform) resolves to
 * an empty array so callers can fail safe instead of crashing the host app.
 */
export async function captureViewHierarchy(): Promise<CapturedElement[]> {
  const result = await safeAsync(
    async () => {
      if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
        return [];
      }
      const raw = await NativeCaneSdk.captureViewHierarchy();
      return raw ?? [];
    },
    'native.captureViewHierarchy',
    []
  );
  return result ?? [];
}
