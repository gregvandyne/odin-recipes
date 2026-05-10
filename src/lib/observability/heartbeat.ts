/**
 * Worker heartbeat. The worker process writes a Redis key with a TTL on a
 * regular interval. /api/readyz reads the key; a stale (missing) heartbeat
 * means the worker is wedged or down and the readiness probe should fail.
 *
 * Fail-open: if Redis is unreachable from the worker we log; from readyz we
 * still pass since the same downstream Redis check is already gating
 * readiness elsewhere.
 */

import { getRedis } from "@/lib/queue/redis";
import { logger } from "@/lib/logging/log";

const PREFIX = "sentinel:hb";

export interface HeartbeatOpts {
  /** TTL in ms before the heartbeat key is treated as stale. */
  ttlMs: number;
  /** Optional metadata stored alongside the timestamp. */
  metadata?: Record<string, unknown>;
}

export async function writeHeartbeat(name: string, opts: HeartbeatOpts): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  const value = JSON.stringify({
    timestamp: Date.now(),
    metadata: opts.metadata ?? {},
  });
  try {
    await redis.set(`${PREFIX}:${name}`, value, "PX", opts.ttlMs);
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err), name },
      "heartbeat write failed",
    );
  }
}

export interface HeartbeatStatus {
  name: string;
  alive: boolean;
  lastSeenMs: number | null;
  ageMs: number | null;
}

export async function readHeartbeat(name: string): Promise<HeartbeatStatus> {
  const redis = getRedis();
  if (!redis) {
    return { name, alive: false, lastSeenMs: null, ageMs: null };
  }
  try {
    const raw = await redis.get(`${PREFIX}:${name}`);
    if (!raw) return { name, alive: false, lastSeenMs: null, ageMs: null };
    const parsed = JSON.parse(raw) as { timestamp: number };
    const ageMs = Date.now() - parsed.timestamp;
    return { name, alive: true, lastSeenMs: parsed.timestamp, ageMs };
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err), name },
      "heartbeat read failed",
    );
    return { name, alive: false, lastSeenMs: null, ageMs: null };
  }
}
