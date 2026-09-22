import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { overlayController } from '../overlay/controller';

describe('overlayController', () => {
  beforeEach(() => {
    overlayController.reset();
  });

  it('starts hidden with the FAB off', () => {
    const state = overlayController.getState();
    expect(state.screen.kind).toBe('hidden');
    expect(state.fabVisible).toBe(false);
  });

  it('notifies subscribers on every state change', () => {
    const listener = jest.fn();
    const unsubscribe = overlayController.subscribe(listener);

    overlayController.setFabVisible(true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(overlayController.getState().fabVisible).toBe(true);

    unsubscribe();
    overlayController.setFabVisible(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('showIdlePrompt() resolves only once resolveIdlePrompt() is called', async () => {
    const promise = overlayController.showIdlePrompt();
    expect(overlayController.getState().screen.kind).toBe('idlePrompt');

    overlayController.resolveIdlePrompt(true);
    await expect(promise).resolves.toBe(true);
  });

  it('askQuestion() resolves with the tapped option', async () => {
    const pergunta = { texto: 'Boleto ou PIX?', opcoes: ['Boleto', 'PIX'] };
    const promise = overlayController.askQuestion(pergunta);

    const state = overlayController.getState();
    expect(state.screen).toEqual({ kind: 'question', pergunta });

    overlayController.answerQuestion('PIX');
    await expect(promise).resolves.toBe('PIX');
  });

  it('manual trigger callback can be registered and invoked by the FAB', () => {
    const trigger = jest.fn();
    overlayController.setManualTrigger(trigger);
    overlayController.triggerManualAssist();
    expect(trigger).toHaveBeenCalledTimes(1);
  });

  it('dismissSpotlight() only hides the spotlight screen', () => {
    overlayController.showLoading();
    overlayController.dismissSpotlight();
    expect(overlayController.getState().screen.kind).toBe('loading');

    overlayController.showSpotlight({
      kind: 'spotlight',
      answer: {
        viewID: 'btn',
        mensagem_escrita: 'Toque aqui',
        mensagem_voz_url: '',
        precisao: 1,
      },
      bounds: null,
    });
    overlayController.dismissSpotlight();
    expect(overlayController.getState().screen.kind).toBe('hidden');
  });

  it('reset() clears pending answers and hides everything', () => {
    overlayController.showIdlePrompt();
    overlayController.reset();
    expect(overlayController.getState().screen.kind).toBe('hidden');
    expect(overlayController.getState().fabVisible).toBe(false);
  });
});
