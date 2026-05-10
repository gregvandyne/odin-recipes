/**
 * Singleton Redis client for BullMQ + idempotency cache.
 *
 * BullMQ requires `maxRetriesPerRequest = null` and `enableReadyCheck = false`
 * on the connections used for queues/workers. This module returns a dedicated
 * connection per consumer (queue, worker, ad-hoc) since they cannot be shared.
 *
 * If REDIS_URL is unset we return null. Callers fall back to in-process paths
 * (synchronous AI for the dev loop, in-memory idempotency cache for tests).
 */

import IORedis, { type Redis, type RedisOptions } from "ioredis";

let sharedClient: Redis | null = null;

function buildOptions(overrides: RedisOptions = {}): RedisOptions {
  return {
    // BullMQ requirement: don't kill long-running blocking commands.
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
    ...overrides,
  };
}

/**
 * Get a shared Redis connection for ad-hoc operations (idempotency cache,
 * health check). Do NOT pass this to BullMQ workers — they need a dedicated
 * connection to avoid blocking-command starvation.
 */
export function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  if (sharedClient) return sharedClient;
  sharedClient = new IORedis(process.env.REDIS_URL, buildOptions());
  sharedClient.on("error", (err) => {
    // Avoid noisy reconnect spam — pino picks this up via the structured logger
    // in the worker boot file. Here we silently rely on ioredis auto-reconnect.
    if (process.env.NODE_ENV !== "production") {
      console.error("[redis] error", err.message);
    }
  });
  return sharedClient;
}

/**
 * Build a fresh connection for BullMQ. Each Queue, Worker, and QueueEvents
 * needs its own connection per BullMQ docs.
 */
export function buildQueueConnection(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  return new IORedis(process.env.REDIS_URL, buildOptions());
}
