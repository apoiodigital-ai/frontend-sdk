import type {
  CapturedElement,
  HeuristicConstants,
  InactivityTimeoutBounds,
  ScanSummary,
} from '../types';

export function summarizeScan(elements: CapturedElement[]): ScanSummary {
  let interactiveComponentCount = 0;
  let textCharCount = 0;

  for (const el of elements) {
    if (el.isInteractive) {
      interactiveComponentCount += 1;
    }
    textCharCount += el.text?.length ?? 0;
  }

  return { interactiveComponentCount, textCharCount };
}

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
