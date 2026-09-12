import type {
  AcharRespostaRequest,
  AcharRespostaResponse,
  NecessidadeInformacoesRequest,
  NecessidadeInformacoesResponse,
  RespostaNecessidadeRequest,
  RespostaNecessidadeResponse,
} from '../types';

/**
 * Placeholder default -- every real integration is expected to override
 * this via `CaneSDK.init({ options: { baseUrl } })`. Kept as an obvious
 * non-functional hostname rather than guessing at a real one.
 */
export const DEFAULT_BASE_URL = 'https://api.apoiodigital.example';

const REQUEST_TIMEOUT_MS = 10_000;

export class CaneApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'CaneApiError';
  }
}

/**
 * Deliberately built on plain `fetch` -- no axios or other HTTP client, per
 * an explicit "keep the SDK bundle small" requirement from the team. Every
 * request carries `x-api-key: <accessKey>` and matches the three backend
 * endpoints exactly as specified (see README "Backend contract").
 */
export class ApiClient {
  constructor(
    private readonly accessKey: string,
    private readonly baseUrl: string = DEFAULT_BASE_URL
  ) {}

  private async post<TResponse>(
    path: string,
    body: unknown
  ): Promise<TResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.accessKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new CaneApiError(
          `Backend responded ${response.status} for ${path}`,
          response.status
        );
      }

      return (await response.json()) as TResponse;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /** POST /resposta/validar/necessidade-informacoes */
  validarNecessidadeInformacoes(
    body: NecessidadeInformacoesRequest
  ): Promise<NecessidadeInformacoesResponse> {
    return this.post<NecessidadeInformacoesResponse>(
      '/resposta/validar/necessidade-informacoes',
      body
    );
  }

  /** POST /resposta/validar/resposta-necessidade */
  validarRespostaNecessidade(
    body: RespostaNecessidadeRequest
  ): Promise<RespostaNecessidadeResponse> {
    return this.post<RespostaNecessidadeResponse>(
      '/resposta/validar/resposta-necessidade',
      body
    );
  }

  /** POST /resposta/achar-resposta */
  acharResposta(body: AcharRespostaRequest): Promise<AcharRespostaResponse> {
    return this.post<AcharRespostaResponse>('/resposta/achar-resposta', body);
  }
}
