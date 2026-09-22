import type {
  CaneLogEntry,
  CaneLogErrorSummary,
  CaneLogHandler,
  CaneLogLevel,
} from '../types';

type EmittedLevel = CaneLogEntry['level'];

const PREFIX = '[CaneSDK]';
const LEVEL_WEIGHT: Record<EmittedLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};
const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : true;

export function defaultLogLevel(): CaneLogLevel {
  return isDev ? 'debug' : 'warn';
}

let minimumLevel: CaneLogLevel = defaultLogLevel();
let externalHandler: CaneLogHandler | null = null;

function summarizeError(error: unknown): CaneLogErrorSummary | undefined {
  if (error === undefined || error === null) return undefined;
  if (error instanceof Error) {
    const details = error as Error & { status?: unknown; kind?: unknown };
    return {
      name: error.name,
      message: error.message,
      status: typeof details.status === 'number' ? details.status : undefined,
      kind: typeof details.kind === 'string' ? details.kind : undefined,
    };
  }
  return { name: typeof error, message: String(error) };
}

function isEnabled(level: EmittedLevel): boolean {
  if (minimumLevel === 'silent') return false;
  return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[minimumLevel];
}

function writeToConsole(entry: CaneLogEntry): void {
  try {
    const text = `${PREFIX} [${entry.level}] ${entry.message}`;
    const details = entry.error ? [entry.error] : [];
    if (entry.level === 'warn' || entry.level === 'error') {
      console.warn(text, ...details);
    } else {
      console.log(text, ...details);
    }
  } catch {}
}

function forwardToHandler(entry: CaneLogEntry): void {
  if (!externalHandler) return;
  try {
    externalHandler(entry);
  } catch {}
}

function emit(level: EmittedLevel, message: string, error?: unknown): void {
  if (!isEnabled(level)) return;
  const entry: CaneLogEntry = {
    level,
    message,
    timestamp: Date.now(),
    error: summarizeError(error),
  };
  writeToConsole(entry);
  forwardToHandler(entry);
}

export const logger = {
  configure(options: {
    level?: CaneLogLevel;
    handler?: CaneLogHandler | null;
  }): void {
    minimumLevel = options.level ?? defaultLogLevel();
    externalHandler = options.handler ?? null;
  },
  debug(message: string): void {
    emit('debug', message);
  },
  info(message: string): void {
    emit('info', message);
  },
  warn(message: string, error?: unknown): void {
    emit('warn', message, error);
  },
  error(message: string, error?: unknown): void {
    emit('error', message, error);
  },
};
