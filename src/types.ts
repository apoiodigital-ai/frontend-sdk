export interface CapturedElement {
  viewId: string;
  className: string;
  text: string;
  isSecure: boolean;
  isInteractive: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface InactivityTimeoutBounds {
  min: number;
  max: number;
}

export type CaneLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface CaneLogErrorSummary {
  name: string;
  message: string;
  status?: number;
  kind?: string;
}

export interface CaneLogEntry {
  level: Exclude<CaneLogLevel, 'silent'>;
  message: string;
  timestamp: number;
  error?: CaneLogErrorSummary;
}

export type CaneLogHandler = (entry: CaneLogEntry) => void;

export interface CaneSDKOptions {
  voiceGuidance?: boolean;
  hapticFeedback?: boolean;
  inactivityTimeout?: 'auto' | InactivityTimeoutBounds;
  baseUrl?: string;
  heuristicConstants?: Partial<HeuristicConstants>;
  logLevel?: CaneLogLevel;
  onLog?: CaneLogHandler;
}

export interface CaneSDKInitConfig {
  accessKey: string;
  options?: CaneSDKOptions;
}

export interface HeuristicConstants {
  baseMs: number;
  perComponentMs: number;
  readingCharsPerMs: number;
  defaultMinMs: number;
  defaultMaxMs: number;
}

export interface ScanSummary {
  interactiveComponentCount: number;
  textCharCount: number;
}

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
  idPedido?: string;
}

export interface AcharRespostaResponse {
  viewID: string;
  mensagem_escrita: string;
  mensagem_voz_url: string | null;
  precisao: number;
  idResposta?: string;
}
