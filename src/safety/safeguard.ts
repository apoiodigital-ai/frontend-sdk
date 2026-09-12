import { logger } from './logger';

/**
 * ============================================================================
 * FAIL-SAFE WRAPPER -- the single choke point every SDK operation goes
 * through.
 *
 * Hard requirement from the architecture doc: scanning, networking, and
 * rendering must NEVER crash or visibly break the host/partner app. Any
 * failure anywhere in the SDK must result in the SDK quietly hiding itself
 * and handing full control back to the host. This module is the one place
 * that implements that contract -- call sites should use `safeAsync`/
 * `safeSync` rather than ad-hoc try/catch, so the behavior stays consistent
 * everywhere (network errors, native scan errors, and JS logic errors all
 * degrade the same way). Render-time failures are covered separately by
 * `SafeBoundary` (a React error boundary), since try/catch cannot intercept
 * exceptions thrown during React's render phase.
 * ============================================================================
 */

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
