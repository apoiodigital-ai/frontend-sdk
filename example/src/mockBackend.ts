export const MOCK_BASE_URL = 'https://mock.cane.local';

export const DEMO_TARGET_VIEW_ID = 'cane-demo-pay-button';

let pedidoCounter = 0;

function delay<T>(value: T, ms = 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export function installMockBackend(): void {
  const realFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.url;

    if (!url.startsWith(MOCK_BASE_URL)) {
      return realFetch(input, init);
    }

    const body = init?.body ? JSON.parse(init.body as string) : {};

    if (url.endsWith('/resposta/validar/necessidade-informacoes')) {
      pedidoCounter += 1;
      const idPedido = `demo-pedido-${pedidoCounter}`;
      console.log('[CaneSDK mock backend] necessidade-informacoes <-', body);
      return delay(
        jsonResponse({
          interromper: true,
          pergunta: {
            texto: 'Você está tentando pagar um boleto ou fazer um PIX?',
            opcoes: ['Pagar boleto', 'Fazer PIX'],
          },
          idPedido,
        })
      );
    }

    if (url.endsWith('/resposta/validar/resposta-necessidade')) {
      console.log('[CaneSDK mock backend] resposta-necessidade <-', body);
      return delay(jsonResponse({ interromper: false }));
    }

    if (url.endsWith('/resposta/achar-resposta')) {
      console.log('[CaneSDK mock backend] achar-resposta <-', body);
      return delay(
        jsonResponse({
          viewID: DEMO_TARGET_VIEW_ID,
          mensagem_escrita:
            'Toque neste botão verde para confirmar o pagamento.',
          mensagem_voz_url: '',
          precisao: 0.92,
        })
      );
    }

    return delay(jsonResponse({}, 404));
  }) as typeof fetch;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
