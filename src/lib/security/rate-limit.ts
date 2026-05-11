/**
 * Token-bucket rate limiter.
 *
 * In-memory by default (per Node instance). For production, point at
 * Redis via `RATE_LIMIT_REDIS_URL` — same API, distributed bucket.
 *
 * Buckets are keyed by an arbitrary identifier (e.g. `auth:${ip}` or
 * `pwreset:${email}`). Limits are configured per bucket type.
 */

import Redis from "ioredis";

interface BucketConfig {
  /** Max tokens. */
  capacity: number;
  /** Tokens refilled per second. */
  refillPerSecond: number;
}

export const LIMITS = {
  // Auth surfaces. Tight on writes, looser on reads.
  "auth.login":      { capacity: 5,  refillPerSecond: 5 / 900 },     // 5 / 15 min
  "auth.password":   { capacity: 3,  refillPerSecond: 3 / 3600 },    // 3 / hour
  "auth.invitation": { capacity: 10, refillPerSecond: 10 / 3600 },   // 10 / hour
  // Application APIs.
  "api.checkin":     { capacity: 10, refillPerSecond: 10 / 600 },    // 10 / 10 min
  "api.checkin.draft": { capacity: 600, refillPerSecond: 600 / 3600 }, // 600 / hour (10 / minute, generous)
  "api.feedback":    { capacity: 5,  refillPerSecond: 5 / 3600 },    // 5 / hour
  "api.flag.override": { capacity: 30, refillPerSecond: 30 / 3600 }, // 30 / hour
  "api.message":     { capacity: 60, refillPerSecond: 60 / 600 },    // 60 / 10 min
  "api.draft":       { capacity: 30, refillPerSecond: 30 / 3600 },   // 30 / hour (AI cost cap)
  "api.push":        { capacity: 20, refillPerSecond: 20 / 600 },    // 20 / 10 min
  // Catch-all for unauthenticated edge.
  "edge.anon":       { capacity: 60, refillPerSecond: 1 },           // 60/min sustained
} as const satisfies Record<string, BucketConfig>;

export type LimitName = keyof typeof LIMITS;

interface MemoryBucket {
  tokens: number;
  updatedMs: number;
}

const memoryBuckets = new Map<string, MemoryBucket>();

let _redis: Redis | null = null;
function redis(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.RATE_LIMIT_REDIS_URL ?? process.env.REDIS_URL;
  if (!url) return null;
  _redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
  _redis.connect().catch(() => {});
  return _redis;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Try to consume one token. Returns whether the request should proceed.
 * Always allow if rate limiting is misconfigured — fail-open is intentional
 * here (denial of service via misconfigured limiter is worse than letting
 * a request through).
 */
export async function consume(limit: LimitName, identifier: string): Promise<RateLimitResult> {
  const cfg = LIMITS[limit];
  const key = `rl:${limit}:${identifier}`;
  const now = Date.now();

  const r = redis();
  if (r) {
    return consumeRedis(r, key, cfg, now);
  }
  return consumeMemory(key, cfg, now);
}

function consumeMemory(key: string, cfg: BucketConfig, now: number): RateLimitResult {
  const bucket = memoryBuckets.get(key) ?? { tokens: cfg.capacity, updatedMs: now };
  const elapsedSec = Math.max(0, (now - bucket.updatedMs) / 1000);
  const refilled = Math.min(cfg.capacity, bucket.tokens + elapsedSec * cfg.refillPerSecond);
  if (refilled < 1) {
    const retryMs = Math.ceil((1 - refilled) / cfg.refillPerSecond) * 1000;
    memoryBuckets.set(key, { tokens: refilled, updatedMs: now });
    return { allowed: false, remaining: 0, retryAfterMs: retryMs };
  }
  const tokens = refilled - 1;
  memoryBuckets.set(key, { tokens, updatedMs: now });
  return { allowed: true, remaining: Math.floor(tokens), retryAfterMs: 0 };
}

async function consumeRedis(
  r: Redis,
  key: string,
  cfg: BucketConfig,
  now: number,
): Promise<RateLimitResult> {
  // Lua script — atomic refill + consume.
  const script = `
    local key = KEYS[1]
    local cap = tonumber(ARGV[1])
    local rate = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    local data = redis.call("HMGET", key, "tokens", "ts")
    local tokens = tonumber(data[1]) or cap
    local ts = tonumber(data[2]) or now
    local elapsed = math.max(0, (now - ts) / 1000.0)
    tokens = math.min(cap, tokens + elapsed * rate)
    if tokens < 1 then
      redis.call("HMSET", key, "tokens", tokens, "ts", now)
      redis.call("PEXPIRE", key, math.ceil(cap / rate * 1000) + 1000)
      return {0, 0, math.ceil((1 - tokens) / rate * 1000)}
    end
    tokens = tokens - 1
    redis.call("HMSET", key, "tokens", tokens, "ts", now)
    redis.call("PEXPIRE", key, math.ceil(cap / rate * 1000) + 1000)
    return {1, math.floor(tokens), 0}
  `;
  try {
    const result = (await r.eval(
      script,
      1,
      key,
      String(cfg.capacity),
      String(cfg.refillPerSecond),
      String(now),
    )) as [number, number, number];
    return {
      allowed: result[0] === 1,
      remaining: result[1],
      retryAfterMs: result[2],
    };
  } catch {
    // Redis hiccup — fall back to memory bucket so we don't deny legit traffic.
    return consumeMemory(key, cfg, now);
  }
}

/**
 * Convenience: pull the requesting IP from a Next.js request.
 *
 * Trust model: production traffic always reaches Next.js through a
 * reverse proxy (Vercel edge, Cloudflare, nginx). The proxy sets
 * `x-forwarded-for` and/or `x-real-ip`; direct-to-origin requests are
 * blocked at the platform layer so a client cannot forge these.
 *
 * If neither header is present (true direct access from the client, only
 * possible in dev / behind no proxy), we return "unknown" rather than
 * blanket-keying everything to one bucket.
 *
 * The returned value is clamped to a sane length so a malicious client
 * can't grow Redis keys with arbitrarily long XFF chains.
 */
const MAX_IP_LEN = 64;

export function ipFromRequest(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]!.trim();
    return first.slice(0, MAX_IP_LEN);
  }
  const real = headers.get("x-real-ip");
  if (real) return real.slice(0, MAX_IP_LEN);
  return "unknown";
}
