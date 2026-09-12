import { TurboModuleRegistry, type TurboModule } from 'react-native';

/**
 * Structural twin of `CapturedElement` (see `src/types.ts`) declared inline
 * here on purpose: RN's codegen parses this file's AST directly and expects
 * request/response shapes to be literally present, not re-exported from
 * elsewhere.
 */
export interface CapturedElementNative {
  viewId: string;
  className: string;
  text: string;
  isSecure: boolean;
  isInteractive: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Spec extends TurboModule {
  /**
   * Walks the host app's own view hierarchy (Activity DecorView on Android /
   * key UIWindow on iOS) exactly once and resolves with a flattened,
   * privacy-scrubbed snapshot. Debounced natively against layout settling
   * (~300-500ms) so it never reads mid-animation -- see
   * `android/.../ViewHierarchyScanner.kt` and `ios/CaneViewScanner.swift`.
   *
   * This never rejects: any native-side failure resolves with `[]` so the
   * JS fail-safe wrapper can degrade gracefully instead of surfacing a
   * native exception.
   */
  captureViewHierarchy(): Promise<CapturedElementNative[]>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('ReactNativeSdk');
