import { logger } from './logger';

export async function safeAsync<T>(
  operation: () => Promise<T>,
  context: string,
  fallback?: T
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    logger.warn(
      `Swallowed error in "${context}" -- SDK hiding itself for this operation.`,
      error
    );
    return fallback;
  }
}

export function safeSync<T>(
  operation: () => T,
  context: string,
  fallback?: T
): T | undefined {
  try {
    return operation();
  } catch (error) {
    logger.warn(
      `Swallowed error in "${context}" -- SDK hiding itself for this operation.`,
      error
    );
    return fallback;
  }
}
