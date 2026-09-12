import { describe, expect, it } from '@jest/globals';
import {
  computeEstimatedTimeoutMs,
  resolveBounds,
  summarizeScan,
} from '../inactivity/estimator';
import { DEFAULT_HEURISTIC_CONSTANTS } from '../inactivity/constants';
import type { CapturedElement } from '../types';

function element(overrides: Partial<CapturedElement> = {}): CapturedElement {
  return {
    viewId: 'v1',
    className: 'TextView',
    text: '',
    isSecure: false,
    isInteractive: false,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    ...overrides,
  };
}

describe('summarizeScan', () => {
  it('counts interactive components and sums text length', () => {
    const elements = [
      element({ isInteractive: true, text: 'Confirmar' }),
      element({ isInteractive: false, text: 'Total: R$ 10,00' }),
      element({ isInteractive: true, text: '' }),
    ];

    const summary = summarizeScan(elements);

    expect(summary.interactiveComponentCount).toBe(2);
    expect(summary.textCharCount).toBe(
      'Confirmar'.length + 'Total: R$ 10,00'.length
    );
  });

  it('never counts characters from secure fields (already blanked upstream)', () => {
    const elements = [element({ isSecure: true, text: '' })];
    const summary = summarizeScan(elements);
    expect(summary.textCharCount).toBe(0);
  });
});

describe('computeEstimatedTimeoutMs', () => {
  const bounds = { min: 15_000, max: 45_000 };

  it('applies base + per-component + reading-speed formula', () => {
    const summary = { interactiveComponentCount: 2, textCharCount: 260 };
    const expectedRaw =
      DEFAULT_HEURISTIC_CONSTANTS.baseMs +
      2 * DEFAULT_HEURISTIC_CONSTANTS.perComponentMs +
      260 / DEFAULT_HEURISTIC_CONSTANTS.readingCharsPerMs;

    const result = computeEstimatedTimeoutMs(
      summary,
      DEFAULT_HEURISTIC_CONSTANTS,
      bounds
    );
    expect(result).toBe(Math.round(expectedRaw));
  });

  it('clamps below the minimum for near-empty screens', () => {
    const summary = { interactiveComponentCount: 0, textCharCount: 0 };
    const result = computeEstimatedTimeoutMs(
      summary,
      { ...DEFAULT_HEURISTIC_CONSTANTS, baseMs: 0 },
      bounds
    );
    expect(result).toBe(bounds.min);
  });

  it('clamps above the maximum for dense screens', () => {
    const summary = { interactiveComponentCount: 500, textCharCount: 100_000 };
    const result = computeEstimatedTimeoutMs(
      summary,
      DEFAULT_HEURISTIC_CONSTANTS,
      bounds
    );
    expect(result).toBe(bounds.max);
  });
});

describe('resolveBounds', () => {
  it('uses built-in defaults for "auto"', () => {
    const result = resolveBounds('auto', DEFAULT_HEURISTIC_CONSTANTS);
    expect(result).toEqual({
      min: DEFAULT_HEURISTIC_CONSTANTS.defaultMinMs,
      max: DEFAULT_HEURISTIC_CONSTANTS.defaultMaxMs,
    });
  });

  it('uses built-in defaults when undefined', () => {
    const result = resolveBounds(undefined, DEFAULT_HEURISTIC_CONSTANTS);
    expect(result).toEqual({
      min: DEFAULT_HEURISTIC_CONSTANTS.defaultMinMs,
      max: DEFAULT_HEURISTIC_CONSTANTS.defaultMaxMs,
    });
  });

  it('uses caller-supplied bounds when given explicit min/max', () => {
    const result = resolveBounds(
      { min: 1000, max: 2000 },
      DEFAULT_HEURISTIC_CONSTANTS
    );
    expect(result).toEqual({ min: 1000, max: 2000 });
  });
});
