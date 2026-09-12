/**
 * Namespaced, dev-only logger. Never throws. Never used to gate behavior --
 * purely diagnostic breadcrumbs for the host app's own Metro/logcat/Xcode
 * console, useful while integrating the SDK.
 */
const PREFIX = '[CaneSDK]';

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : true;

export const logger = {
  warn(message: string, error?: unknown): void {
    if (!isDev) return;
    try {
      console.warn(`${PREFIX} ${message}`, error ?? '');
    } catch {
      // never let logging itself throw
    }
  },
  info(message: string): void {
    if (!isDev) return;
    try {
      console.log(`${PREFIX} ${message}`);
    } catch {
      // never let logging itself throw
    }
  },
};
