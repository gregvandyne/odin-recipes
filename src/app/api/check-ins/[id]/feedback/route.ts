/**
 * Veteran "this isn't the full picture" feedback.
 *
 * POSTed from /v/insights when the veteran wants to add context to a
 * specific check-in. Doesn't override the engine — it's structured input
 * the coordinator must acknowledge on the per-veteran timeline.
 *
 * Idempotent: clients send `Idempotency-Key`. Replay-safe.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/security/api-auth";
import { withTenant } from "@/lib/db/tenant-context";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";
import { withIdempotency } from "@/lib/idempotency/with-idempotency";

const Body = z.object({
  body: z.string().min(1).max(2000),
});

export const POST = withAuth(
  async (req: NextRequest, ctx) => {
    if (ctx.role !== "VETERAN" || !ctx.organizationId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const organizationId = ctx.organizationId;
    const url = new URL(req.url);
    const checkInId = url.pathname.split("/").filter(Boolean).at(-2);
    if (!checkInId) return NextResponse.json({ error: "missing id" }, { status: 400 });

    return withIdempotency(req, ctx, `/api/check-ins/${checkInId}/feedback`, async (bodyText) => {
      let parsed: z.infer<typeof Body>;
      try {
        parsed = Body.parse(JSON.parse(bodyText));
      } catch {
        return { status: 400, payload: { error: "invalid body" }, skipCache: true };
      }

      const result = await withTenant(
        { organizationId, userId: ctx.userId, userRole: "VETERAN", isOrgAdmin: false },
        async (tx) => {
          const checkIn = await tx.checkIn.findUnique({
            where: { id: checkInId },
            select: { veteranId: true, organizationId: true },
          });
          if (!checkIn || checkIn.veteranId !== ctx.userId) {
            return { kind: "notFound" as const };
          }

          const fb = await tx.checkInFeedback.create({
            data: {
              organizationId,
              checkInId,
              veteranId: ctx.userId,
              body: parsed.body,
            },
          });

          await logAudit(
            {
              organizationId,
              actorId: ctx.userId,
              actorRole: "VETERAN",
              action: AUDIT_ACTIONS.CHECKIN_FEEDBACK,
              resourceType: "CheckIn",
              resourceId: checkInId,
              ipAddress: ctx.ipAddress,
              userAgent: ctx.userAgent,
              correlationId: ctx.correlationId,
            },
            tx,
          );

          return { kind: "ok" as const, feedbackId: fb.id };
        },
      );

      if (result.kind === "notFound") {
        return { status: 404, payload: { error: "not found" }, skipCache: true };
      }
      return { status: 200, payload: { ok: true, feedbackId: result.feedbackId } };
    });
  },
  { roles: ["VETERAN"], rateLimit: "api.feedback" },
);
