import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { CapturedElement } from '../types';
import { CaneSDK } from '../CaneSDK';
import { overlayController } from '../overlay/controller';

const mockBoletoButton: CapturedElement = {
  viewId: 'btn-pagar-boleto',
  className: 'Button',
  text: 'Pagar boleto',
  isSecure: false,
  isInteractive: true,
  x: 10,
  y: 20,
  width: 100,
  height: 40,
};

jest.mock('../native/scanner', () => ({
  captureViewHierarchy: jest.fn(async () => [mockBoletoButton]),
}));

interface FetchCall {
  url: string;
  body: Record<string, unknown>;
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

async function waitFor(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('Condition was not reached in time');
}

async function settle(): Promise<void> {
  for (let tick = 0; tick < 5; tick += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

const screenKind = () => overlayController.getState().screen.kind;

describe('CaneSDK assist flow', () => {
  const calls: FetchCall[] = [];
  let routes: Record<string, unknown> = {};
  let networkDown = false;
  let forcedStatus: number | null = null;

  beforeEach(() => {
    calls.length = 0;
    routes = {};
    networkDown = false;
    forcedStatus = null;
    globalThis.fetch = jest.fn(async (input: unknown, init?: unknown) => {
      const url = String(input);
      const requestBody = (init as { body?: string } | undefined)?.body;
      calls.push({ url, body: requestBody ? JSON.parse(requestBody) : {} });
      if (networkDown) throw new TypeError('fetch failed');
      if (forcedStatus !== null) return jsonResponse({}, forcedStatus);
      const route = Object.keys(routes).find((path) => url.endsWith(path));
      return route ? jsonResponse(routes[route]) : jsonResponse({}, 404);
    }) as unknown as typeof fetch;

    CaneSDK.init({
      accessKey: 'chave-teste',
      options: {
        baseUrl: 'https://cane.test',
        voiceGuidance: false,
        hapticFeedback: false,
      },
    });
    CaneSDK.registerUser({ userId: 'usr_anon_teste' });
  });

  afterEach(() => {
    CaneSDK.destroy();
  });

  it('sends the clarification idPedido to achar-resposta', async () => {
    routes = {
      '/resposta/validar/necessidade-informacoes': {
        interromper: true,
        pergunta: { texto: 'Boleto ou Pix?', opcoes: ['Boleto', 'Pix'] },
        idPedido: 'pedido-1',
      },
      '/resposta/validar/resposta-necessidade': {
        interromper: false,
        pergunta: null,
        idPedido: 'pedido-1',
      },
      '/resposta/achar-resposta': {
        viewID: 'btn-pagar-boleto',
        mensagem_escrita: 'Toque em Pagar boleto',
        mensagem_voz_url: '',
        precisao: 0.9,
      },
    };

    overlayController.triggerManualAssist();
    await waitFor(() => screenKind() === 'question');
    overlayController.answerQuestion('Boleto');
    await waitFor(() => screenKind() === 'spotlight');

    const answerCall = calls.find((call) =>
      call.url.endsWith('/resposta/validar/resposta-necessidade')
    );
    expect(answerCall?.body).toEqual({
      userId: 'usr_anon_teste',
      idPedido: 'pedido-1',
      resposta: 'Boleto',
    });

    const findCall = calls.find((call) =>
      call.url.endsWith('/resposta/achar-resposta')
    );
    expect(findCall?.body.idPedido).toBe('pedido-1');
  });

  it('hides the loading overlay and stays usable when the network fails', async () => {
    networkDown = true;

    overlayController.triggerManualAssist();
    await waitFor(() => calls.length === 1 && screenKind() === 'hidden');
    await settle();

    networkDown = false;
    routes = {
      '/resposta/validar/necessidade-informacoes': {
        interromper: true,
        pergunta: { texto: 'Boleto ou Pix?', opcoes: ['Boleto', 'Pix'] },
        idPedido: 'pedido-3',
      },
    };
    overlayController.triggerManualAssist();
    await waitFor(() => screenKind() === 'question');
  });

  it('lets the user close the question without locking the SDK', async () => {
    routes = {
      '/resposta/validar/necessidade-informacoes': {
        interromper: true,
        pergunta: { texto: 'Boleto ou Pix?', opcoes: ['Boleto', 'Pix'] },
        idPedido: 'pedido-4',
      },
    };

    overlayController.triggerManualAssist();
    await waitFor(() => screenKind() === 'question');
    overlayController.cancelQuestion();
    await waitFor(() => screenKind() === 'hidden');
    await settle();

    overlayController.triggerManualAssist();
    await waitFor(() => screenKind() === 'question');
    expect(
      calls.filter((call) => call.url.endsWith('/resposta/achar-resposta'))
    ).toHaveLength(0);
  });

  it('releases the assist flow when the screen is unregistered mid-question', async () => {
    routes = {
      '/resposta/validar/necessidade-informacoes': {
        interromper: true,
        pergunta: { texto: 'Boleto ou Pix?', opcoes: ['Boleto', 'Pix'] },
        idPedido: 'pedido-5',
      },
    };

    overlayController.triggerManualAssist();
    await waitFor(() => screenKind() === 'question');
    CaneSDK.unregisterCriticalScreen();
    await waitFor(() => screenKind() === 'hidden');
    await settle();

    overlayController.triggerManualAssist();
    await waitFor(() => screenKind() === 'question');
  });

  it('suspends itself and hides the FAB when the access key is rejected', async () => {
    forcedStatus = 401;

    overlayController.triggerManualAssist();
    await waitFor(() => !overlayController.getState().fabVisible);
    expect(screenKind()).toBe('hidden');

    await settle();
    overlayController.triggerManualAssist();
    await settle();
    expect(calls).toHaveLength(1);
  });

  it('sends the idPedido even when no clarification was needed', async () => {
    routes = {
      '/resposta/validar/necessidade-informacoes': {
        interromper: false,
        pergunta: null,
        idPedido: 'pedido-2',
      },
      '/resposta/achar-resposta': {
        viewID: 'btn-pagar-boleto',
        mensagem_escrita: 'Toque em Pagar boleto',
        mensagem_voz_url: '',
        precisao: 0.9,
      },
    };

    overlayController.triggerManualAssist();
    await waitFor(() => screenKind() === 'spotlight');

    const findCall = calls.find((call) =>
      call.url.endsWith('/resposta/achar-resposta')
    );
    expect(findCall?.body.idPedido).toBe('pedido-2');
  });
});
