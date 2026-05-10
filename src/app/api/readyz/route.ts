/**
 * Readiness probe.
 *
 * Verifies the dependencies required to serve traffic:
 *   - Postgres reachable
 *   - Redis reachable (for BullMQ + idempotency)
 *
 * Returns 503 if any dependency is unreachable. Load balancers + the worker
 * process gate startup on this.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getRedis } from "@/lib/queue/redis";
import { logger } from "@/lib/logging/log";
import { readHeartbeat } from "@/lib/observability/heartbeat";

const WORKER_HEARTBEAT_MAX_AGE_MS = 90_000;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CheckResult {
  name: string;
  ok: boolean;
  detail?: string;
  durationMs: number;
}

async function check(name: string, fn: () => Promise<void>): Promise<CheckResult> {
  const start = Date.now();
  try {
    await fn();
    return { name, ok: true, durationMs: Date.now() - start };
  } catch (err) {
    return {
      name,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}

export async function GET() {
  const checks = await Promise.all([
    check("postgres", async () => {
      await prisma.$queryRawUnsafe("SELECT 1");
    }),
    check("redis", async () => {
      const client = getRedis();
      if (!client) throw new Error("redis not configured");
      const reply = await client.ping();
      if (reply !== "PONG") throw new Error(`unexpected redis ping reply: ${reply}`);
    }),
    // Worker heartbeat: stale heartbeat = wedged worker = readiness fail.
    // Skip this check entirely when REDIS_URL is unset (dev path) so the
    // probe doesn't double-fail for a missing dep.
    check("worker", async () => {
      if (!process.env.REDIS_URL) return; // dev mode
      const hb = await readHeartbeat("worker");
      if (!hb.alive || hb.ageMs === null) {
        throw new Error("worker heartbeat missing");
      }
      if (hb.ageMs > WORKER_HEARTBEAT_MAX_AGE_MS) {
        throw new Error(`worker heartbeat stale: ${hb.ageMs}ms`);
      }
    }),
  ]);

  const allOk = checks.every((c) => c.ok);
  if (!allOk) {
    logger.warn({ checks }, "readiness probe failed");
  }
  return NextResponse.json(
    {
      status: allOk ? "ready" : "not_ready",
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: allOk ? 200 : 503 },
  );
}
