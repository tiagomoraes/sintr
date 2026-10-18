/**
 * The logging boundary. Sensitive content must never reach logs, so this
 * logger works from an allowlist: only fields whose key is known to carry
 * operational metadata (ids, codes, counts, durations) are written, and only
 * when their value is a primitive. Everything else is replaced by
 * "[redacted]". Errors are reduced to their name and code; their message is
 * dropped because driver and library messages can echo values.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Readonly<Record<string, unknown>>;

export interface Logger {
  debug(event: string, fields?: LogFields): void;
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
  child(bindings: LogFields): Logger;
}

export const REDACTED = "[redacted]";

const SAFE_KEYS = new Set([
  "service",
  "event",
  "userId",
  "requestId",
  "sessionId",
  "tokenId",
  "reportId",
  "route",
  "method",
  "status",
  "durationMs",
  "job",
  "count",
  "code",
  "constraint",
  "table",
  "operation",
  "kekId",
  "version",
  "mode",
  "port",
  "attempt",
  "intervalMs",
  "level",
  "errorName",
  "errorCode",
  "authMessage",
]);

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const EVENT_NAME = /^[a-z0-9_.:-]{1,80}$/i;
const MAX_STRING = 200;

function safePrimitive(value: unknown): unknown {
  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}...` : value;
  }
  return REDACTED;
}

function describeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return {
      errorName: error.name,
      ...(typeof code === "string" || typeof code === "number" ? { errorCode: code } : {}),
    };
  }
  return { errorName: typeof error };
}

/** Reduce arbitrary fields to what may be written. Exported for tests. */
export function redact(fields: LogFields | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!fields) return out;
  for (const [key, value] of Object.entries(fields)) {
    if (key === "error" || key === "err" || value instanceof Error) {
      Object.assign(out, describeError(value));
    } else if (SAFE_KEYS.has(key)) {
      out[key] = safePrimitive(value);
    } else {
      out[key] = REDACTED;
    }
  }
  return out;
}

export interface LoggerOptions {
  level?: LogLevel;
  service?: string;
  /** Where lines go; defaults to stdout (stderr for warn and error). */
  write?: (level: LogLevel, line: string) => void;
}

function defaultWrite(level: LogLevel, line: string): void {
  if (level === "warn" || level === "error") {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }
}

export function createLogger(options: LoggerOptions = {}, bindings: LogFields = {}): Logger {
  const threshold = LEVELS[options.level ?? "info"];
  const write = options.write ?? defaultWrite;
  const base = redact({ ...(options.service ? { service: options.service } : {}), ...bindings });

  const emit = (level: LogLevel, event: string, fields?: LogFields) => {
    if (LEVELS[level] < threshold) return;
    const line = {
      time: new Date().toISOString(),
      level,
      event: EVENT_NAME.test(event) ? event : REDACTED,
      ...base,
      ...redact(fields),
    };
    write(level, JSON.stringify(line));
  };

  return {
    debug: (event, fields) => emit("debug", event, fields),
    info: (event, fields) => emit("info", event, fields),
    warn: (event, fields) => emit("warn", event, fields),
    error: (event, fields) => emit("error", event, fields),
    child: (more) => createLogger(options, { ...bindings, ...more }),
  };
}
