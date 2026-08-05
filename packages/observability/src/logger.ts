import pino, { type DestinationStream, type Logger, type LoggerOptions } from "pino";

export type { Logger } from "pino";

const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "*.password",
  "*.apiKey",
  "*.api_key",
  "*.token",
  "*.accessToken",
  "*.secret",
  "*.authorization",
  "*.cookie",
];

export interface CreateLoggerOptions {
  service: string;
  level?: string;
  /** Только для тестов — переопределяет назначение вывода (по умолчанию stdout). */
  destination?: DestinationStream;
}

/**
 * Единая фабрика структурированных логов (docs/ARCHITECTURE.md §14).
 * Секреты/пароли/cookies/authorization headers никогда не логируются —
 * см. docs/SECURITY.md §5. Правило применяется здесь централизованно,
 * а не оставляется на усмотрение каждого вызывающего кода.
 */
export function createLogger({ service, level = "info", destination }: CreateLoggerOptions): Logger {
  const options: LoggerOptions = {
    level,
    redact: {
      paths: REDACT_PATHS,
      censor: "[REDACTED]",
    },
    base: { service },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  return destination ? pino(options, destination) : pino(options);
}
