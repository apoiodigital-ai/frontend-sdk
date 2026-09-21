import type {
  CaneSDKInitConfig,
  CapturedElement,
  HeuristicConstants,
} from './types';
import { ApiClient, DEFAULT_BASE_URL } from './network/ApiClient';
import { InactivityHeuristic } from './inactivity/InactivityHeuristic';
import { resolveHeuristicConstants } from './inactivity/constants';
import { resolveBounds, summarizeScan } from './inactivity/estimator';
import { captureViewHierarchy } from './native/scanner';
import { overlayController } from './overlay/controller';
import { caneSDKInternal } from './internal';
import { safeAsync, safeSync } from './safety/safeguard';
import { logger } from './safety/logger';

const DEFAULT_MANUAL_PROMPT =
  'O usuário solicitou ajuda nesta tela (toque no botão flutuante).';
const DEFAULT_IDLE_PROMPT =
  'O usuário parece estar com dificuldade nesta tela (heurística de inatividade).';

const MAX_QUESTION_LOOP_ITERATIONS = 6;

interface ResolvedOptions {
  voiceGuidance: boolean;
  hapticFeedback: boolean;
  inactivityTimeout: 'auto' | { min: number; max: number };
  baseUrl: string;
  heuristicConstants: HeuristicConstants;
}

type Status = 'uninitialized' | 'ready' | 'destroyed';

class CaneSDKFacade {
  private status: Status = 'uninitialized';
  private accessKey: string | null = null;
  private userId: string | null = null;
  private api: ApiClient | null = null;
  private options: ResolvedOptions = {
    voiceGuidance: true,
    hapticFeedback: true,
    inactivityTimeout: 'auto',
    baseUrl: DEFAULT_BASE_URL,
    heuristicConstants: resolveHeuristicConstants(),
  };

  private readonly heuristic = new InactivityHeuristic();
  private criticalScreenName: string | null = null;
  private lastScan: { elements: CapturedElement[]; scannedAt: number } | null =
    null;
  private readonly elementIndex = new Map<string, CapturedElement>();
  private assistInFlight = false;

  init(config: CaneSDKInitConfig): void {
    safeSync(() => {
      if (!config?.accessKey) {
        throw new Error('CaneSDK.init requires an accessKey.');
      }

      this.accessKey = config.accessKey;
      const opts = config.options ?? {};
      this.options = {
        voiceGuidance: opts.voiceGuidance ?? true,
        hapticFeedback: opts.hapticFeedback ?? true,
        inactivityTimeout: opts.inactivityTimeout ?? 'auto',
        baseUrl: opts.baseUrl ?? DEFAULT_BASE_URL,
        heuristicConstants: resolveHeuristicConstants(opts.heuristicConstants),
      };

      this.api = new ApiClient(this.accessKey, this.options.baseUrl);
      this.status = 'ready';

      caneSDKInternal.notifyUserActivity = () => this.heuristic.reset();

      overlayController.configure({
        voiceGuidance: this.options.voiceGuidance,
        hapticFeedback: this.options.hapticFeedback,
      });
      overlayController.setManualTrigger(() => {
        this.startAssist(DEFAULT_MANUAL_PROMPT);
      });
      overlayController.setFabVisible(true);
    }, 'CaneSDK.init');
  }

  registerUser({ userId }: { userId: string }): void {
    safeSync(() => {
      this.ensureReady('registerUser');
      this.userId = userId;
    }, 'CaneSDK.registerUser');
  }

  registerCriticalScreen({ name }: { name: string }): void {
    safeAsync(async () => {
      this.ensureReady('registerCriticalScreen');
      this.criticalScreenName = name;
      logger.info(`Critical screen registered: "${this.criticalScreenName}"`);

      const elements = await captureViewHierarchy();
      this.lastScan = { elements, scannedAt: Date.now() };
      this.indexElements(elements);

      const summary = summarizeScan(elements);
      const bounds = resolveBounds(
        this.options.inactivityTimeout,
        this.options.heuristicConstants
      );
      this.heuristic.arm(
        summary,
        this.options.heuristicConstants,
        bounds,
        () => {
          this.onHeuristicTimeout();
        }
      );
    }, 'CaneSDK.registerCriticalScreen');
  }

  unregisterCriticalScreen(): void {
    safeSync(() => {
      this.criticalScreenName = null;
      this.heuristic.disarm();
      overlayController.hideScreen();
      this.lastScan = null;
      this.elementIndex.clear();
    }, 'CaneSDK.unregisterCriticalScreen');
  }

  destroy(): void {
    safeSync(() => {
      this.heuristic.disarm();
      overlayController.reset();
      caneSDKInternal.notifyUserActivity = () => {};
      this.status = 'destroyed';
      this.accessKey = null;
      this.api = null;
      this.userId = null;
      this.criticalScreenName = null;
      this.lastScan = null;
      this.elementIndex.clear();
    }, 'CaneSDK.destroy');
  }

  private ensureReady(context: string): void {
    if (this.status !== 'ready') {
      throw new Error(
        `CaneSDK.${context}() called before init() (or after destroy()).`
      );
    }
  }

  private indexElements(elements: CapturedElement[]): void {
    this.elementIndex.clear();
    for (const element of elements) {
      this.elementIndex.set(element.viewId, element);
    }
  }

  private async onHeuristicTimeout(): Promise<void> {
    await safeAsync(async () => {
      const wantsHelp = await overlayController.showIdlePrompt();
      if (!wantsHelp) {
        overlayController.hideScreen();
        return;
      }
      await this.startAssist(DEFAULT_IDLE_PROMPT);
    }, 'CaneSDK.onHeuristicTimeout');
  }

  private async startAssist(promptText: string): Promise<void> {
    if (this.assistInFlight) return;
    this.assistInFlight = true;

    await safeAsync(async () => {
      if (!this.api || !this.userId) {
        logger.warn(
          'startAssist() requires both init() and registerUser() to have completed -- hiding overlay.'
        );
        overlayController.hideScreen();
        return;
      }

      overlayController.showLoading();

      let elements = this.lastScan?.elements;
      if (!elements) {
        elements = await captureViewHierarchy();
        this.lastScan = { elements, scannedAt: Date.now() };
      }
      this.indexElements(elements);

      let response = await this.api.validarNecessidadeInformacoes({
        userId: this.userId,
        prompt: promptText,
        elementos: elements,
      });
      let idPedido = response.idPedido;

      let loopGuard = 0;
      while (response.interromper && response.pergunta) {
        loopGuard += 1;
        if (loopGuard > MAX_QUESTION_LOOP_ITERATIONS) {
          logger.warn(
            'Clarification loop exceeded the safety cap -- hiding overlay.'
          );
          overlayController.hideScreen();
          return;
        }
        if (!idPedido) {
          logger.warn(
            'Backend did not return an "idPedido" to correlate the clarification loop ' +
              '(see README "Backend contract gap") -- hiding overlay.'
          );
          overlayController.hideScreen();
          return;
        }

        const resposta = await overlayController.askQuestion(response.pergunta);
        response = await this.api.validarRespostaNecessidade({
          userId: this.userId,
          idPedido,
          resposta,
        });
        idPedido = response.idPedido ?? idPedido;
      }

      const found = await this.api.acharResposta({
        userId: this.userId,
        prompt: promptText,
        elementos: elements,
      });

      const bounds = this.elementIndex.get(found.viewID);
      overlayController.showSpotlight({
        kind: 'spotlight',
        answer: found,
        bounds: bounds
          ? {
              x: bounds.x,
              y: bounds.y,
              width: bounds.width,
              height: bounds.height,
            }
          : null,
      });
    }, 'CaneSDK.startAssist');

    this.assistInFlight = false;
  }
}

export const CaneSDK = new CaneSDKFacade();
