import type { HeuristicConstants } from '../types';

/**
 * Default constants for the dynamic inactivity heuristic.
 *
 * Rationale for the reading-speed constant (`readingCharsPerMs`):
 * average adult silent reading speed is often cited around 200-250 wpm.
 * The client asked us to calibrate for elderly users, who read on-screen UI
 * text more slowly (vision, unfamiliarity with the app, etc). We picked
 * ~130 wpm as the target, which is a commonly cited "slow/elderly reader"
 * figure and sits comfortably below average.
 *
 *   130 words/min * ~6 chars/word (5 letters + 1 space, a standard estimate)
 *     = 780 chars/min
 *     = 13 chars/sec
 *     = 0.013 chars/ms
 *
 * All of this is overridable per-init via `options.heuristicConstants`,
 * exactly because "sane default" language in the spec implies these numbers
 * will get tuned against real usage data later.
 */
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
