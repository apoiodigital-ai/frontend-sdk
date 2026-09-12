import type { PerguntaOpcoes } from '../types';
import {
  INITIAL_OVERLAY_STATE,
  type OverlayState,
  type OverlayScreenState,
} from './types';

/**
 * Small, dependency-free pub/sub state container for the overlay UI.
 *
 * `CaneSDK` (the imperative facade) and `CaneSDKHost` (the mounted render
 * anchor -- see README "Deviation: CaneSDKHost") never talk to each other
 * directly; they both go through this controller. That keeps the overlay
 * package independent of the facade package (no import cycle) and makes the
 * whole overlay trivially disable-able: if `CaneSDKHost` was never mounted,
 * every controller call below is a harmless no-op against zero listeners.
 */
class OverlayController {
  private state: OverlayState = INITIAL_OVERLAY_STATE;
  private listeners = new Set<() => void>();
  private pendingIdleAnswer: ((yes: boolean) => void) | null = null;
  private pendingQuestionAnswer: ((opcao: string) => void) | null = null;
  private manualTrigger: (() => void) | null = null;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = (): OverlayState => this.state;

  private setState(patch: Partial<OverlayState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  /** Registers the callback the floating action button invokes on tap. */
  setManualTrigger(trigger: (() => void) | null): void {
    this.manualTrigger = trigger;
  }

  triggerManualAssist(): void {
    this.manualTrigger?.();
  }

  configure(options: {
    voiceGuidance: boolean;
    hapticFeedback: boolean;
  }): void {
    this.setState({
      voiceGuidance: options.voiceGuidance,
      hapticFeedback: options.hapticFeedback,
    });
  }

  setFabVisible(visible: boolean): void {
    this.setState({ fabVisible: visible });
  }

  showLoading(): void {
    this.setState({ screen: { kind: 'loading' } });
  }

  /** Resolves once the user answers the local, pre-network idle nudge. */
  showIdlePrompt(): Promise<boolean> {
    this.setState({ screen: { kind: 'idlePrompt' } });
    return new Promise<boolean>((resolve) => {
      this.pendingIdleAnswer = resolve;
    });
  }

  resolveIdlePrompt(yes: boolean): void {
    const resolve = this.pendingIdleAnswer;
    this.pendingIdleAnswer = null;
    resolve?.(yes);
  }

  /** Resolves once the user taps one of the question's options. */
  askQuestion(pergunta: PerguntaOpcoes): Promise<string> {
    this.setState({ screen: { kind: 'question', pergunta } });
    return new Promise<string>((resolve) => {
      this.pendingQuestionAnswer = resolve;
    });
  }

  answerQuestion(opcao: string): void {
    const resolve = this.pendingQuestionAnswer;
    this.pendingQuestionAnswer = null;
    resolve?.(opcao);
  }

  showSpotlight(
    screen: Extract<OverlayScreenState, { kind: 'spotlight' }>
  ): void {
    this.setState({ screen });
  }

  hideScreen(): void {
    this.pendingIdleAnswer = null;
    this.pendingQuestionAnswer = null;
    this.setState({ screen: { kind: 'hidden' } });
  }

  reset(): void {
    this.pendingIdleAnswer = null;
    this.pendingQuestionAnswer = null;
    this.manualTrigger = null;
    this.state = INITIAL_OVERLAY_STATE;
    this.listeners.forEach((listener) => listener());
  }
}

export const overlayController = new OverlayController();
