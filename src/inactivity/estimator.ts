import type {
  CapturedElement,
  HeuristicConstants,
  InactivityTimeoutBounds,
  ScanSummary,
} from '../types';

/** Derives the (local-only) scan summary counters from a captured element list. */
export function summarizeScan(elements: CapturedElement[]): ScanSummary {
  let interactiveComponentCount = 0;
  let textCharCount = 0;

  for (const el of elements) {
    if (el.isInteractive) {
      interactiveComponentCount += 1;
    }
    // Secure fields are already blanked to "" by native code before this
    // ever reaches JS, so this can't leak masked password characters.
    textCharCount += el.text?.length ?? 0;
  }

  return { interactiveComponentCount, textCharCount };
}

/**
 * estimatedMs = baseMs + interactiveComponentCount * perComponentMs + textCharCount / readingCharsPerMs
 * clamped to [min, max].
 */
export function computeEstimatedTimeoutMs(
  summary: ScanSummary,
  constants: HeuristicConstants,
  bounds: InactivityTimeoutBounds
): number {
  const raw =
    constants.baseMs +
    summary.interactiveComponentCount * constants.perComponentMs +
    summary.textCharCount / constants.readingCharsPerMs;

  const clamped = Math.min(Math.max(raw, bounds.min), bounds.max);
  return Math.round(clamped);
}

export function resolveBounds(
  inactivityTimeout: 'auto' | InactivityTimeoutBounds | undefined,
  constants: HeuristicConstants
): InactivityTimeoutBounds {
  if (inactivityTimeout && typeof inactivityTimeout === 'object') {
    return {
      min: inactivityTimeout.min,
      max: inactivityTimeout.max,
    };
  }
  return { min: constants.defaultMinMs, max: constants.defaultMaxMs };
}
