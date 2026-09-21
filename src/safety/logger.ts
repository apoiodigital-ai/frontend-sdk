const PREFIX = '[CaneSDK]';

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : true;

export const logger = {
  warn(message: string, error?: unknown): void {
    if (!isDev) return;
    try {
      console.warn(`${PREFIX} ${message}`, error ?? '');
    } catch {}
  },
  info(message: string): void {
    if (!isDev) return;
    try {
      console.log(`${PREFIX} ${message}`);
    } catch {}
  },
};
