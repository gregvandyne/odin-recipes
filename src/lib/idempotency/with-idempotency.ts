/**
 * Higher-order helper that wraps a route body with Idempotency-Key handling.
 *
 * The handler receives the parsed body text and a typed AuthContext. It
 * returns either:
 *   - { status, payload }: the helper records the response under the key and
 *     replays it for future requests with the same key + same body.
 *   - { status, payload, skipCache: true }: response is sent but not cached
 *     (useful when the action partly succeeded and we'd rather have the
 *     client retry).
 *
 * Routes that don't supply an Idempotency-Key still execute normally; the
 * helper just bypasses the cache lookup/record steps. This keeps the header
 * optional for callers that don't need exactly-once semantics.
 */

import { NextRequest, NextResponse } from "next/server";
import type { AuthContext } from "@/lib/security/api-auth";
import {
  IDEMPOTENCY_HEADER,
  hashBody,
  lookup,
  readKey,
  recordResponse,
} from "./store";

export interface IdempotentResult {
  status: number;
  payload: unknown;
  /** When true, do not cache this response (allow client retry). */
  skipCache?: boolean;
  /** Optional extra response headers. */
  headers?: HeadersInit;
}

export async function withIdempotency(
  req: NextRequest,
  ctx: AuthContext,
  route: string,
  handler: (bodyText: string, key: string | null) => Promise<IdempotentResult>,
): Promise<NextResponse> {
  const bodyText = await req.text();
  const key = readKey(req);
  if (key) {
    const cached = await lookup(ctx, route, key, bodyText);
    if (cached?.hit) return cached.response;
  }

  const result = await handler(bodyText, key);

  const headers = new Headers(result.headers);
  if (key) headers.set(IDEMPOTENCY_HEADER, key);

  if (key && !result.skipCache) {
    await recordResponse(ctx, route, key, hashBody(bodyText), result.status, result.payload);
  }

  return NextResponse.json(result.payload, {
    status: result.status,
    headers,
  });
}
