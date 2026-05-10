/**
 * Veteran "this isn't the full picture" feedback.
 *
 * POSTed from /v/insights when the veteran wants to add context to a
 * specific check-in. Doesn't override the engine — it's structured input
 * the coordinator must acknowledge on the per-veteran timeline.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/security/api-auth";
import { withTenant } from "@/lib/db/tenant-context";
import { logAudit } from "@/lib/audit/log";

const Body = z.object({
  body: z.string().min(1).max(2000),
});

export const POST = withAuth(
  async (req: NextRequest, ctx) => {
    if (ctx.role !== "VETERAN" || !ctx.organizationId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const url = new URL(req.url);
    const checkInId = url.pathname.split("/").filter(Boolean).at(-2);
    if (!checkInId) return NextResponse.json({ error: "missing id" }, { status: 400 });

    let parsed: z.infer<typeof Body>;
    try {
      parsed = Body.parse(await req.json());
    } catch {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }

    const result = await withTenant(
      {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        userRole: "VETERAN",
        isOrgAdmin: false,
      },
      async (tx) => {
        const checkIn = await tx.checkIn.findUnique({
          where: { id: checkInId },
          select: { veteranId: true, organizationId: true },
        });
        if (!checkIn || checkIn.veteranId !== ctx.userId) {
          return { status: 404 as const };
        }

        const fb = await tx.checkInFeedback.create({
          data: {
            organizationId: ctx.organizationId!,
            checkInId,
            veteranId: ctx.userId,
            body: parsed.body,
          },
        });

        await logAudit(
          {
            organizationId: ctx.organizationId,
            actorId: ctx.userId,
            actorRole: "VETERAN",
            action: "checkin.feedback",
            resourceType: "CheckIn",
            resourceId: checkInId,
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
            correlationId: ctx.correlationId,
          },
          tx,
        );

        return { status: 200 as const, feedbackId: fb.id };
      },
    );

    if (result.status === 404) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true, feedbackId: result.feedbackId });
  },
  { roles: ["VETERAN"], rateLimit: "api.feedback" },
);
