/**
 * Idempotency cache.
 *
 * Every state-changing route accepts an `Idempotency-Key` header. The cache
 * is keyed by `(key)` (UUID minted client-side per submit attempt) and stores
 * the response body + status code with a 24h TTL.
 *
 * If the same key arrives again with the same request payload hash, the
 * cached response is returned. If the same key arrives with a DIFFERENT
 * payload hash, we return 409 — that signals the client mutated mid-retry.
 *
 * Storage backend: Postgres `IdempotencyRecord` table (RLS-scoped).
 */

import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/security/api-auth";
import { logger } from "@/lib/logging/log";

export const IDEMPOTENCY_HEADER = "idempotency-key";
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1_000;

const KEY_RE = /^[a-zA-Z0-9_-]{8,128}$/;

export interface IdempotencyHit {
  hit: true;
  response: NextResponse;
}
export interface IdempotencyMiss {
  hit: false;
  key: string;
  requestHash: string;
}
export type IdempotencyResult = IdempotencyHit | IdempotencyMiss | null;

export function readKey(req: NextRequest): string | null {
  const raw = req.headers.get(IDEMPOTENCY_HEADER) ?? req.headers.get("Idempotency-Key");
  if (!raw) return null;
  if (!KEY_RE.test(raw)) return null;
  return raw;
}

export function hashBody(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

/**
 * Look up a prior response for `key`. Returns:
 *   - { hit: true } if we have a prior 2xx response with matching request hash → replay
 *   - 409 if key is reused with a different request body
 *   - { hit: false, key, requestHash } if we should proceed with the handler
 *
 * The caller must invoke `recordResponse` after the handler completes.
 */
export async function lookup(
  ctx: AuthContext,
  route: string,
  key: string,
  bodyText: string,
): Promise<IdempotencyResult> {
  const requestHash = hashBody(bodyText);
  const existing = await prisma.idempotencyRecord.findUnique({ where: { key } });
  if (!existing) return { hit: false, key, requestHash };
  if (existing.expiresAt < new Date()) {
    // Stale — drop and let the handler run fresh.
    await prisma.idempotencyRecord.delete({ where: { key } }).catch(() => undefined);
    return { hit: false, key, requestHash };
  }
  if (existing.userId !== ctx.userId) {
    logger.warn(
      { key, expectedUserId: existing.userId, actualUserId: ctx.userId },
      "idempotency-key reuse across users — refusing replay",
    );
    return {
      hit: true,
      response: NextResponse.json({ error: "idempotency key collision" }, { status: 409 }),
    };
  }
  if (existing.route !== route) {
    return {
      hit: true,
      response: NextResponse.json({ error: "idempotency key reused on different route" }, { status: 409 }),
    };
  }
  if (existing.requestHash !== requestHash) {
    return {
      hit: true,
      response: NextResponse.json(
        { error: "idempotency key reused with different request body" },
        { status: 409 },
      ),
    };
  }
  return {
    hit: true,
    response: NextResponse.json(existing.response, { status: existing.statusCode }),
  };
}

/**
 * Persist a response under an idempotency key. Should only be called for
 * 2xx responses; non-2xx responses are not cached (so a transient error can
 * be retried without confusion).
 */
export async function recordResponse(
  ctx: AuthContext,
  route: string,
  key: string,
  requestHash: string,
  statusCode: number,
  payload: unknown,
): Promise<void> {
  if (statusCode < 200 || statusCode >= 300) return;
  await prisma.idempotencyRecord
    .upsert({
      where: { key },
      create: {
        key,
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        route,
        requestHash,
        response: payload as object,
        statusCode,
        expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
      },
      update: {
        response: payload as object,
        statusCode,
        expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
      },
    })
    .catch((err) => {
      logger.warn({ err: err?.message, key, route }, "failed to persist idempotency record");
    });
}
