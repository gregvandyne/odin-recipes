/**
 * POST /api/push/subscribe — register a Web Push subscription.
 *
 * The browser provides {endpoint, keys: {p256dh, auth}}. We store these per
 * user. Multiple subscriptions per user are allowed (phone + laptop).
 *
 * The upsert is keyed by `endpoint`, so the operation is intrinsically
 * idempotent at the DB layer. The header-based idempotency cache adds the
 * usual replay-safe response semantics on top.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withAuth } from "@/lib/security/api-auth";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";
import { withIdempotency } from "@/lib/idempotency/with-idempotency";

const Body = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(64),
  }),
});

export const POST = withAuth(
  async (req, ctx) => {
    return withIdempotency(req, ctx, "/api/push/subscribe", async (bodyText) => {
      let parsed: z.infer<typeof Body>;
      try {
        parsed = Body.parse(JSON.parse(bodyText));
      } catch {
        return { status: 400, payload: { error: "invalid body" }, skipCache: true };
      }
      const { endpoint, keys } = parsed;

      await prisma.pushSubscription.upsert({
        where: { endpoint },
        create: {
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          userAgent: ctx.userAgent.slice(0, 256),
        },
        update: {
          userId: ctx.userId,
          organizationId: ctx.organizationId,
          p256dh: keys.p256dh,
          auth: keys.auth,
          revokedAt: null,
          lastSeenAt: new Date(),
        },
      });

      await logAudit({
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        actorRole: ctx.role,
        action: AUDIT_ACTIONS.PUSH_SUBSCRIBE,
        resourceType: "PushSubscription",
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        correlationId: ctx.correlationId,
      });

      return { status: 200, payload: { ok: true } };
    });
  },
  { rateLimit: "api.push", requireOrganization: false },
);

export const DELETE = withAuth(
  async (req) => {
    const url = new URL(req.url);
    const endpoint = url.searchParams.get("endpoint");
    if (!endpoint) return NextResponse.json({ error: "endpoint required" }, { status: 400 });
    await prisma.pushSubscription.updateMany({
      where: { endpoint },
      data: { revokedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  },
  { rateLimit: "api.push", requireOrganization: false },
);
