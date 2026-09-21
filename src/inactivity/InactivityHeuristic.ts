import type {
  HeuristicConstants,
  InactivityTimeoutBounds,
  ScanSummary,
} from '../types';
import { computeEstimatedTimeoutMs } from './estimator';

export class InactivityHeuristic {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private armedTimeoutMs: number | null = null;
  private onTimeout: (() => void) | null = null;

  get isArmed(): boolean {
    return this.timer !== null;
  }

  get currentTimeoutMs(): number | null {
    return this.armedTimeoutMs;
  }

  arm(
    summary: ScanSummary,
    constants: HeuristicConstants,
    bounds: InactivityTimeoutBounds,
    onTimeout: () => void
  ): void {
    this.clearTimer();
    const timeoutMs = computeEstimatedTimeoutMs(summary, constants, bounds);
    this.armedTimeoutMs = timeoutMs;
    this.onTimeout = onTimeout;
    this.timer = setTimeout(() => this.fire(), timeoutMs);
  }

  reset(): void {
    if (!this.isArmed || this.armedTimeoutMs === null) return;
    this.clearTimer();
    this.timer = setTimeout(() => this.fire(), this.armedTimeoutMs);
  }

  disarm(): void {
    this.clearTimer();
    this.armedTimeoutMs = null;
    this.onTimeout = null;
  }

  private fire(): void {
    this.timer = null;
    const cb = this.onTimeout;
    this.onTimeout = null;
    cb?.();
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
