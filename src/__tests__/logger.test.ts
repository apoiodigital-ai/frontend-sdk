import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { CaneLogEntry } from '../types';
import { logger } from '../safety/logger';
import { CaneApiError } from '../network/ApiClient';

describe('logger', () => {
  afterEach(() => {
    logger.configure({});
    jest.restoreAllMocks();
  });

  it('forwards entries at or above the configured level to the partner handler', () => {
    const entries: CaneLogEntry[] = [];
    logger.configure({
      level: 'warn',
      handler: (entry) => {
        entries.push(entry);
      },
    });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    logger.debug('scan started');
    logger.info('screen registered');
    logger.warn(
      'assist failed',
      new CaneApiError('timeout', undefined, 'timeout')
    );
    logger.error('render crashed', new Error('boom'));

    expect(entries.map((entry) => entry.level)).toEqual(['warn', 'error']);
    expect(entries[0]?.error).toEqual({
      name: 'CaneApiError',
      message: 'timeout',
      status: undefined,
      kind: 'timeout',
    });
  });

  it('writes warn and error to the console in production-like levels', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    logger.configure({ level: 'warn' });

    logger.error('render crashed');

    expect(warn).toHaveBeenCalledWith('[CaneSDK] [error] render crashed');
  });

  it('emits nothing when the level is silent', () => {
    const handler = jest.fn();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    logger.configure({ level: 'silent', handler });

    logger.error('render crashed', new Error('boom'));

    expect(handler).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('never forwards extra error fields that could carry personal data', () => {
    const entries: CaneLogEntry[] = [];
    logger.configure({
      level: 'warn',
      handler: (entry) => {
        entries.push(entry);
      },
    });
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const error = Object.assign(new Error('falhou'), {
      requestBody: { text: 'Saldo R$ 1.234,56 - Maria Silva' },
    });

    logger.warn('assist failed', error);

    expect(Object.keys(entries[0]?.error ?? {}).sort()).toEqual([
      'kind',
      'message',
      'name',
      'status',
    ]);
    expect(JSON.stringify(entries[0])).not.toContain('Maria');
  });

  it('keeps working when the partner handler throws', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    logger.configure({
      level: 'warn',
      handler: () => {
        throw new Error('crash reporter offline');
      },
    });

    expect(() => logger.warn('assist failed')).not.toThrow();
  });
});
