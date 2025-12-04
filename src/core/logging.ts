export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  level?: LogLevel;
  trace?(message: string, meta?: Record<string, unknown>): void;
  debug?(message: string, meta?: Record<string, unknown>): void;
  info?(message: string, meta?: Record<string, unknown>): void;
  warn?(message: string, meta?: Record<string, unknown>): void;
  error?(message: string, meta?: Record<string, unknown>): void;
}

const logPriority: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50
};

export const defaultLogger: Required<Logger> = {
  level: 'info',
  trace: (message, meta) => console.debug(`[TRACE] ${message}`, meta ?? ''),
  debug: (message, meta) => console.debug(`[DEBUG] ${message}`, meta ?? ''),
  info: (message, meta) => console.info(`[INFO] ${message}`, meta ?? ''),
  warn: (message, meta) => console.warn(`[WARN] ${message}`, meta ?? ''),
  error: (message, meta) => console.error(`[ERROR] ${message}`, meta ?? '')
};

export function createLogger(logger?: Logger): Required<Logger> {
  const finalLogger = { ...defaultLogger, ...logger } as Required<Logger>;
  const level = finalLogger.level ?? 'info';
  const minPriority = logPriority[level];

  function wrap(fn: (message: string, meta?: Record<string, unknown>) => void, levelKey: LogLevel) {
    const priority = logPriority[levelKey];
    return function log(message: string, meta?: Record<string, unknown>) {
      if (priority < minPriority) return;
      fn.call(finalLogger, message, meta);
    };
  }

  return {
    level,
    trace: wrap(finalLogger.trace, 'trace'),
    debug: wrap(finalLogger.debug, 'debug'),
    info: wrap(finalLogger.info, 'info'),
    warn: wrap(finalLogger.warn, 'warn'),
    error: wrap(finalLogger.error, 'error')
  };
}
