/**
 * Structured logger with PII-redacting paths.
 *
 * Every API route receives a correlation id (set by middleware as the
 * `x-correlation-id` request header). The logger child for that request
 * binds the id automatically so every log line, every audit log entry, and
 * every downstream call (AI, email, push) can be traced.
 *
 * Redaction is fail-closed: anything matching a known sensitive path gets
 * stripped before serialization, regardless of caller discipline.
 */

import pino from "pino";

const REDACT_PATHS = [
  // emails / phone numbers
  "*.email",
  "*.emails[*]",
  "*.phoneNumber",
  "*.emergencyContactPhone",
  "*.emergencyContactName",
  // veteran free-text (encrypted at rest, never in logs)
  "*.openEndedResponse",
  "*.openEnded",
  "*.body",
  "*.bodyEncrypted",
  "*.summary",
  "*.consultNotes",
  // auth material
  "*.password",
  "*.passwordHash",
  "*.token",
  "*.tokenHash",
  "*.codeHash",
  "*.authorization",
  "headers.authorization",
  "headers.cookie",
  "headers['set-cookie']",
];

const baseLogger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  redact: {
    paths: REDACT_PATHS,
    censor: "[redacted]",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    service: "sentinel",
    env: process.env.NODE_ENV ?? "development",
  },
});

export type Logger = pino.Logger;

export const logger: Logger = baseLogger;

/**
 * Build a child logger bound to a correlation id and (optional) request scope.
 * Pass this through async boundaries (worker jobs, AI calls, audit log) so
 * every log line for a single user-visible action carries the same id.
 */
export function withCorrelation(
  correlationId: string,
  fields: Record<string, unknown> = {},
): Logger {
  return baseLogger.child({ correlationId, ...fields });
}

/**
 * Generate a UUIDv4-style correlation id. Short, URL-safe, unambiguous.
 */
export function newCorrelationId(): string {
  return crypto.randomUUID();
}

export const CORRELATION_HEADER = "x-correlation-id";
