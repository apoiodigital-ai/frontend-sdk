import { Platform } from 'react-native';
import NativeCaneSdk from '../NativeReactNativeSdk';
import type { CapturedElement } from '../types';
import { safeAsync } from '../safety/safeguard';

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
