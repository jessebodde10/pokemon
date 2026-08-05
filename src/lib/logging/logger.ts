import { isAppError } from '@/lib/errors/app-error';

/**
 * Minimal structured logger.
 *
 * Redacts anything that looks like a secret or personal identifier before
 * writing, so provider keys, e-mail addresses and raw IPs never reach stdout.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE_KEY = /(key|token|secret|password|authorization|cookie|ip)/i;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

function redactValue(value: unknown, key?: string): unknown {
  if (key && SENSITIVE_KEY.test(key)) return '[redacted]';
  if (typeof value === 'string') return value.replace(EMAIL, '[email]');
  if (Array.isArray(value)) return value.map((item) => redactValue(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        redactValue(v, k),
      ]),
    );
  }
  return value;
}

function serialiseError(error: unknown): Record<string, unknown> {
  if (isAppError(error)) {
    return {
      name: error.name,
      code: error.code,
      message: error.message,
      details: redactValue(error.details),
    };
  }
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { name: 'UnknownError', message: String(error) };
}

function write(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
): void {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context ? (redactValue(context) as Record<string, unknown>) : {}),
  };
  const line = JSON.stringify(payload);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else if (level === 'debug') console.debug(line);
  else console.info(line);
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) =>
    write('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) =>
    write('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) =>
    write('warn', message, context),
  error: (
    message: string,
    error?: unknown,
    context?: Record<string, unknown>,
  ) =>
    write('error', message, {
      ...context,
      ...(error === undefined ? {} : { error: serialiseError(error) }),
    }),
};
