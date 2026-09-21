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

export class CaneApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'CaneApiError';
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
