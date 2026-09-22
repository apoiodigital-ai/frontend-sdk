import type { PerguntaOpcoes } from '../types';
import {
  INITIAL_OVERLAY_STATE,
  type OverlayState,
  type OverlayScreenState,
} from './types';

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

  dismissSpotlight(): void {
    if (this.state.screen.kind === 'spotlight') {
      this.hideScreen();
    }
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
