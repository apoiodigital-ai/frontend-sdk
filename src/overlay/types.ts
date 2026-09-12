import type { AcharRespostaResponse, PerguntaOpcoes } from '../types';

export interface ElementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type OverlayScreenState =
  | { kind: 'hidden' }
  | { kind: 'idlePrompt' }
  | { kind: 'question'; pergunta: PerguntaOpcoes }
  | {
      kind: 'spotlight';
      answer: AcharRespostaResponse;
      bounds: ElementBounds | null;
    }
  | { kind: 'loading' };

export interface OverlayState {
  fabVisible: boolean;
  screen: OverlayScreenState;
  voiceGuidance: boolean;
  hapticFeedback: boolean;
}

export const INITIAL_OVERLAY_STATE: OverlayState = {
  fabVisible: false,
  screen: { kind: 'hidden' },
  voiceGuidance: true,
  hapticFeedback: true,
};
