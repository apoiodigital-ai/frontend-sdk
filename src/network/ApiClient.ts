import type {
  AcharRespostaRequest,
  AcharRespostaResponse,
  NecessidadeInformacoesRequest,
  NecessidadeInformacoesResponse,
  RespostaNecessidadeRequest,
  RespostaNecessidadeResponse,
} from '../types';

export const DEFAULT_BASE_URL = 'https://api.apoiodigital.example';

const REQUEST_TIMEOUT_MS = 10_000;

export type CaneApiErrorKind = 'http' | 'network' | 'timeout' | 'invalid-json';

export class CaneApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly kind: CaneApiErrorKind = 'http'
  ) {
    super(message);
    this.name = 'CaneApiError';
  }

  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

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
    const timeoutError = () =>
      new CaneApiError(
        `Request to ${path} timed out after ${REQUEST_TIMEOUT_MS}ms`,
        undefined,
        'timeout'
      );

    try {
      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}${path}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.accessKey,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch {
        throw controller.signal.aborted
          ? timeoutError()
          : new CaneApiError(
              `Network failure calling ${path}`,
              undefined,
              'network'
            );
      }

      if (!response.ok) {
        throw new CaneApiError(
          `Backend responded ${response.status} for ${path}`,
          response.status,
          'http'
        );
      }

      try {
        return (await response.json()) as TResponse;
      } catch {
        throw controller.signal.aborted
          ? timeoutError()
          : new CaneApiError(
              `Backend sent an invalid JSON body for ${path}`,
              response.status,
              'invalid-json'
            );
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  validarNecessidadeInformacoes(
    body: NecessidadeInformacoesRequest
  ): Promise<NecessidadeInformacoesResponse> {
    return this.post<NecessidadeInformacoesResponse>(
      '/resposta/validar/necessidade-informacoes',
      body
    );
  }

  validarRespostaNecessidade(
    body: RespostaNecessidadeRequest
  ): Promise<RespostaNecessidadeResponse> {
    return this.post<RespostaNecessidadeResponse>(
      '/resposta/validar/resposta-necessidade',
      body
    );
  }

  acharResposta(body: AcharRespostaRequest): Promise<AcharRespostaResponse> {
    return this.post<AcharRespostaResponse>('/resposta/achar-resposta', body);
  }
}
