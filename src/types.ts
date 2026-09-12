/**
 * Shared public types for @apoiocane/react-native-sdk.
 *
 * NOTE on duplication with `NativeReactNativeSdk.ts`: the TurboModule codegen
 * parses that file's AST directly and expects the request/response shapes to
 * be declared inline there (it does not reliably follow cross-file type
 * imports across every RN/codegen version). `CapturedElement` below is the
 * app-facing twin of `CapturedElementNative` -- structurally identical by
 * contract, kept as separate declarations on purpose.
 */

/** A single captured node from the on-device view-hierarchy scan. */
export interface CapturedElement {
  /** Stable-ish identifier: native resource id / accessibilityIdentifier, or a synthetic fallback. */
  viewId: string;
  /** Native class name (e.g. "EditText", "UIButton"). */
  className: string;
  /** Visible text, or contentDescription/accessibilityLabel fallback. Always "" for secure fields. */
  text: string;
  /** True for password/secure-entry fields -- `text` is guaranteed blank when this is true. */
  isSecure: boolean;
  /** Best-effort guess at whether this node is interactive (clickable, focusable input, etc). */
  isInteractive: boolean;
  /** Absolute on-screen coordinates, already converted to window/screen space by native code. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface InactivityTimeoutBounds {
  /** Minimum allowed computed timeout, in ms. */
  min: number;
  /** Maximum allowed computed timeout, in ms. */
  max: number;
}

export interface CaneSDKOptions {
  /** Gate for auto-playing `mensagem_voz_url` when an answer is found. Default: true. */
  voiceGuidance?: boolean;
  /** Gate for haptic feedback on cutout reveal. Default: true. */
  hapticFeedback?: boolean;
  /**
   * 'auto' (default): compute a dynamic per-screen timeout and clamp it to the
   * SDK's built-in defaults (15000ms / 45000ms).
   * `{ min, max }`: compute the same dynamic timeout, but clamp to caller-supplied bounds.
   */
  inactivityTimeout?: 'auto' | InactivityTimeoutBounds;
  /**
   * Backend base URL override. Not part of the originally specified options
   * contract, but required to actually reach a backend -- see README
   * "Deviations from the spec". Falls back to a documented placeholder
   * default if omitted.
   */
  baseUrl?: string;
  /**
   * Advanced/optional overrides for the inactivity-heuristic constants
   * (base time, per-component time, reading speed). See
   * `src/inactivity/constants.ts` for defaults and rationale.
   */
  heuristicConstants?: Partial<HeuristicConstants>;
}

export interface CaneSDKInitConfig {
  accessKey: string;
  options?: CaneSDKOptions;
}

export interface HeuristicConstants {
  /** Fixed baseline orientation/thinking time before any per-content cost, in ms. */
  baseMs: number;
  /** Additional ms budgeted per interactive component on screen. */
  perComponentMs: number;
  /** Elderly-calibrated reading throughput, in characters processed per ms. */
  readingCharsPerMs: number;
  /** Built-in default lower clamp (used when caller doesn't pass explicit bounds), ms. */
  defaultMinMs: number;
  /** Built-in default upper clamp (used when caller doesn't pass explicit bounds), ms. */
  defaultMaxMs: number;
}

/** Local summary derived from a `CapturedElement[]` scan -- never sent anywhere. */
export interface ScanSummary {
  interactiveComponentCount: number;
  textCharCount: number;
}

// ---- Backend contract types (see README "Backend contract") ----

export interface PerguntaOpcoes {
  texto: string;
  opcoes: string[];
}

export interface NecessidadeInformacoesRequest {
  userId: string;
  prompt: string;
  elementos: CapturedElement[];
}

export interface NecessidadeInformacoesResponse {
  interromper: boolean;
  pergunta?: PerguntaOpcoes;
  /**
   * NOT listed in the literal spec response shape for this endpoint, but the
   * follow-up endpoint (`resposta-necessidade`) requires an `idPedido` to
   * correlate the loop. We read it defensively if present and carry it
   * forward. See README "Backend contract gap" -- flagged for the backend
   * engineer to confirm/emit.
   */
  idPedido?: string;
}

export interface RespostaNecessidadeRequest {
  userId: string;
  idPedido: string;
  resposta: string;
}

export interface RespostaNecessidadeResponse {
  interromper: boolean;
  pergunta?: PerguntaOpcoes;
  idPedido?: string;
}

export interface AcharRespostaRequest {
  userId: string;
  prompt: string;
  elementos: CapturedElement[];
}

export interface AcharRespostaResponse {
  viewID: string;
  mensagem_escrita: string;
  mensagem_voz_url: string;
  precisao: number;
}
