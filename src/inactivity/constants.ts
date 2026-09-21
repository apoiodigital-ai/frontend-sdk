import type { HeuristicConstants } from '../types';

export const DEFAULT_HEURISTIC_CONSTANTS: HeuristicConstants = {
  baseMs: 6000,
  perComponentMs: 900,
  readingCharsPerMs: 0.013,
  defaultMinMs: 15000,
  defaultMaxMs: 45000,
};

export function resolveHeuristicConstants(
  overrides?: Partial<HeuristicConstants>
): HeuristicConstants {
  return { ...DEFAULT_HEURISTIC_CONSTANTS, ...overrides };
}
