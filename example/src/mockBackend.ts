/**
 * A tiny local mock of the ApoioDigital backend, used ONLY by this example
 * app to demonstrate the full `CaneSDK` request/response cycle without
 * needing a real server. It intercepts `fetch` calls aimed at
 * `MOCK_BASE_URL` (see `App.tsx`'s `CaneSDK.init` call) and simulates the
 * exact three-endpoint contract documented in the SDK's README, including
 * one clarifying-question round trip, so the "necessidade-informacoes ->
 * resposta-necessidade loop -> achar-resposta" flow can be exercised
 * end-to-end in this example. Every other `fetch` call is passed through to
 * the real implementation untouched.
 *
 * This file is intentionally NOT part of the published library -- it only
 * exists under `example/`.
 */
export const MOCK_BASE_URL = 'https://mock.cane.local';

/**
 * `viewID` this mock will eventually resolve to. It must match a real
 * element's `viewId` as captured by the native scanner, which (per the
 * scanner's id-resolution priority -- see README) falls back to
 * `contentDescription`/`accessibilityLabel` when no real native resource id
 * is set. `App.tsx`'s payment button sets exactly this `accessibilityLabel`.
 */
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
          // NOTE: `idPedido` is not in the literal spec response shape for
          // this endpoint -- the SDK reads it defensively. See the SDK
          // README's "Backend contract gap" note.
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
