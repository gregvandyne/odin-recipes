/**
 * Sentry / OTel error-tracking shim.
 *
 * Sentry integration is loaded lazily so the package isn't required at build
 * time and isn't pulled into client bundles. If `SENTRY_DSN` is unset, this
 * module is a no-op — exceptions go through the pino logger and that's it.
 *
 * Routes and worker job handlers should wrap their bodies with
 * `withErrorTracking(name, async () => { ... })` so unexpected errors bubble
 * up to Sentry with the same correlation id we already log.
 *
 * PII redaction mirrors the pino redaction paths so a forwarded breadcrumb
 * never carries `email`, `phoneNumber`, `openEndedResponse`, etc.
 */

import { logger } from "@/lib/logging/log";

interface SentryClient {
  captureException(err: unknown, hint?: { tags?: Record<string, string>; extra?: Record<string, unknown> }): void;
  setTag(key: string, value: string): void;
  flush(timeout?: number): Promise<boolean>;
}

let _client: SentryClient | null | undefined; // undefined = uninitialized; null = init attempted, no DSN

async function maybeInit(): Promise<SentryClient | null> {
  if (_client !== undefined) return _client;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    _client = null;
    return null;
  }
  try {
    // Dynamic import keeps @sentry/nextjs out of the build graph when the
    // env var isn't set. The package may not be installed in dev — that's OK.
    // Use a string literal computed at runtime so TypeScript doesn't try to
    // resolve the module name at compile time.
    const moduleName = "@sentry/nextjs";
    type SentryModule = {
      init(opts: Record<string, unknown>): void;
      captureException(err: unknown, hint?: { tags?: Record<string, string>; extra?: Record<string, unknown> }): void;
      setTag(k: string, v: string): void;
      flush(timeout?: number): Promise<boolean>;
    };
    let sentry: SentryModule | null = null;
    try {
      sentry = (await import(/* webpackIgnore: true */ moduleName)) as SentryModule;
    } catch {
      sentry = null;
    }
    if (!sentry) {
      logger.warn("@sentry/nextjs not installed; SENTRY_DSN is set but tracking is no-op");
      _client = null;
      return null;
    }
    sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? "development",
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.05),
      beforeSend(event: unknown) {
        return scrubPII(event);
      },
    });
    _client = {
      captureException: (err, hint) => sentry!.captureException(err, hint),
      setTag: (k, v) => sentry!.setTag(k, v),
      flush: (timeout) => sentry!.flush(timeout),
    } satisfies SentryClient;
    return _client;
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "Sentry init failed; continuing without remote error tracking",
    );
    _client = null;
    return null;
  }
}

/**
 * Wrap an async function so exceptions are captured with structured context.
 * Re-throws after capture so caller error handling still runs.
 */
export async function withErrorTracking<T>(
  name: string,
  fn: () => Promise<T>,
  context: Record<string, unknown> = {},
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const client = await maybeInit();
    logger.error(
      { err: err instanceof Error ? err.stack : String(err), name, ...context },
      "uncaught error",
    );
    if (client) {
      client.captureException(err, {
        tags: { component: name },
        extra: context,
      });
    }
    throw err;
  }
}

/**
 * Force-flush before process exit (useful for the worker shutdown path).
 */
export async function flushTracking(timeoutMs = 2000): Promise<void> {
  const client = await maybeInit();
  if (!client) return;
  try {
    await client.flush(timeoutMs);
  } catch {
    /* noop */
  }
}

/**
 * Scrub a Sentry event payload of any PII fields. Mirrors the pino redact paths.
 */
function scrubPII<T>(event: T): T {
  const SENSITIVE_KEYS = new Set([
    "email",
    "emails",
    "phoneNumber",
    "emergencyContactPhone",
    "emergencyContactName",
    "openEndedResponse",
    "openEnded",
    "body",
    "bodyEncrypted",
    "summary",
    "consultNotes",
    "password",
    "passwordHash",
    "token",
    "tokenHash",
    "codeHash",
    "authorization",
    "cookie",
    "set-cookie",
  ]);
  function walk(node: unknown): unknown {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        out[k] = SENSITIVE_KEYS.has(k) ? "[redacted]" : walk(v);
      }
      return out;
    }
    return node;
  }
  return walk(event) as T;
}
