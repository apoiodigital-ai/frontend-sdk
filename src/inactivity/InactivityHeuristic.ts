import type {
  HeuristicConstants,
  InactivityTimeoutBounds,
  ScanSummary,
} from '../types';
import { computeEstimatedTimeoutMs } from './estimator';

/**
 * ============================================================================
 * PRIVACY DESIGN -- READ BEFORE TOUCHING THIS FILE
 * ============================================================================
 *
 * This is a deliberate architecture decision agreed with the client, not an
 * oversight, and it must NOT be "simplified" into a fixed timeout or into
 * something that scans/streams continuously. The whole point of this design
 * is that ZERO screen content ever leaves the device until the user
 * explicitly opts in after an idle prompt.
 *
 * Sequence of events:
 *
 *   1. `registerCriticalScreen()` runs the native view-hierarchy scanner
 *      EXACTLY ONCE, locally on-device. Nothing is sent to any backend at
 *      this point -- the result only feeds the arithmetic below.
 *   2. That single scan is reduced to two integers (interactive component
 *      count + total visible character count) and used to compute a
 *      dynamic timeout (see `estimator.ts`), clamped to sane bounds.
 *   3. This class arms ONE JS timer (`setTimeout`) for that computed
 *      duration. From this point until it fires, the SDK does *nothing* --
 *      no polling, no re-scanning, no network activity. `reset()` is called
 *      by a touch/gesture listener elsewhere in the tree; it just restarts
 *      the same local timer, it does not re-scan or contact anything.
 *   4. If the timer expires without being reset, we surface a small,
 *      non-blocking, LOCAL prompt ("Precisa de uma ajudinha para
 *      continuar?"). Nothing is transmitted yet -- this is still 100%
 *      on-device.
 *   5. ONLY if the user answers that prompt affirmatively does the SDK take
 *      the element tree (the one already captured in step 1, or a fresh
 *      re-scan if the caller asks for one) and hand it to the backend
 *      client to start the real assist flow.
 *
 * If you're refactoring this and thinking "let's just re-scan periodically
 * to keep it fresh" or "let's stream layout changes to the backend for
 * better accuracy" -- don't. That silently reintroduces exactly the
 * always-on surveillance behavior the client rejected when abandoning the
 * AccessibilityService-based prototype. Any future change to *when* data is
 * allowed to leave the device needs explicit product sign-off, not just an
 * engineering judgment call.
 * ============================================================================
 */
export class InactivityHeuristic {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private armedTimeoutMs: number | null = null;
  private onTimeout: (() => void) | null = null;

  /** Whether a critical screen currently has this heuristic armed. */
  get isArmed(): boolean {
    return this.timer !== null;
  }

  /** The last computed timeout, for diagnostics/tests. Not sent anywhere. */
  get currentTimeoutMs(): number | null {
    return this.armedTimeoutMs;
  }

  /**
   * Computes the dynamic timeout from a LOCAL scan summary and arms the
   * timer. Call this once per `registerCriticalScreen()` invocation.
   */
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

  /**
   * Called by the touch/gesture listener on ANY interaction. Purely
   * restarts the existing local timer -- never touches native scanning or
   * the network.
   */
  reset(): void {
    if (!this.isArmed || this.armedTimeoutMs === null) return;
    this.clearTimer();
    this.timer = setTimeout(() => this.fire(), this.armedTimeoutMs);
  }

  /** Disarms the heuristic entirely (screen unregistered, SDK destroyed). */
  disarm(): void {
    this.clearTimer();
    this.armedTimeoutMs = null;
    this.onTimeout = null;
  }

  private fire(): void {
    this.timer = null;
    const cb = this.onTimeout;
    // One-shot: don't re-arm automatically. A fresh `registerCriticalScreen`
    // call (e.g. on next screen) re-arms explicitly.
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
