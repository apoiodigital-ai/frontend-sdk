import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { InactivityHeuristic } from '../inactivity/InactivityHeuristic';
import { DEFAULT_HEURISTIC_CONSTANTS } from '../inactivity/constants';

const bounds = { min: 15_000, max: 45_000 };
const summary = { interactiveComponentCount: 1, textCharCount: 100 };

describe('InactivityHeuristic', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('is not armed until arm() is called', () => {
    const heuristic = new InactivityHeuristic();
    expect(heuristic.isArmed).toBe(false);
  });

  it('fires onTimeout once the computed duration elapses', () => {
    const heuristic = new InactivityHeuristic();
    const onTimeout = jest.fn();

    heuristic.arm(summary, DEFAULT_HEURISTIC_CONSTANTS, bounds, onTimeout);
    expect(heuristic.isArmed).toBe(true);
    expect(heuristic.currentTimeoutMs).not.toBeNull();

    jest.advanceTimersByTime((heuristic.currentTimeoutMs ?? 0) - 1);
    expect(onTimeout).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('reset() restarts the countdown instead of firing early', () => {
    const heuristic = new InactivityHeuristic();
    const onTimeout = jest.fn();
    heuristic.arm(summary, DEFAULT_HEURISTIC_CONSTANTS, bounds, onTimeout);
    const timeout = heuristic.currentTimeoutMs ?? 0;

    jest.advanceTimersByTime(timeout - 1);
    heuristic.reset();
    jest.advanceTimersByTime(timeout - 1);
    expect(onTimeout).not.toHaveBeenCalled();

    jest.advanceTimersByTime(2);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('reset() is a no-op when not armed (never re-triggers scanning/network)', () => {
    const heuristic = new InactivityHeuristic();
    expect(() => heuristic.reset()).not.toThrow();
    expect(heuristic.isArmed).toBe(false);
  });

  it('disarm() cancels a pending timeout entirely', () => {
    const heuristic = new InactivityHeuristic();
    const onTimeout = jest.fn();
    heuristic.arm(summary, DEFAULT_HEURISTIC_CONSTANTS, bounds, onTimeout);

    heuristic.disarm();
    expect(heuristic.isArmed).toBe(false);

    jest.advanceTimersByTime(bounds.max + 1000);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('is one-shot: firing does not re-arm automatically', () => {
    const heuristic = new InactivityHeuristic();
    const onTimeout = jest.fn();
    heuristic.arm(summary, DEFAULT_HEURISTIC_CONSTANTS, bounds, onTimeout);
    const timeout = heuristic.currentTimeoutMs ?? 0;

    jest.advanceTimersByTime(timeout);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(heuristic.isArmed).toBe(false);

    jest.advanceTimersByTime(timeout * 2);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });
});
