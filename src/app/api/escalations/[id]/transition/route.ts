/**
 * Transition an escalation to ACTIONED or CLOSED.
 *
 * POST /api/escalations/[id]/transition
 *   body: { to: "ACTIONED" | "CLOSED" }
 *
 * Only the assigned clinical lead (or PM) can transition. Closing also
 * stamps `closedAt`.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/security/api-auth";
import { withTenant } from "@/lib/db/tenant-context";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";

const Body = z.object({ to: z.enum(["ACTIONED", "CLOSED"]) });

export const POST = withAuth(
  async (req: NextRequest, ctx) => {
    if (!ctx.organizationId) return NextResponse.json({ error: "no tenant" }, { status: 403 });
    const url = new URL(req.url);
    const escalationId = url.pathname.split("/").filter(Boolean).at(-2);
    if (!escalationId) return NextResponse.json({ error: "missing id" }, { status: 400 });
    let parsed: z.infer<typeof Body>;
    try {
      parsed = Body.parse(await req.json());
    } catch {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }

    const result = await withTenant(
      { organizationId: ctx.organizationId, userId: ctx.userId, userRole: ctx.role, isOrgAdmin: ctx.isOrgAdmin },
      async (tx) => {
        const escalation = await tx.clinicalEscalation.findUnique({
          where: { id: escalationId },
          select: { organizationId: true, clinicalLeadId: true, status: true },
        });
        if (!escalation || escalation.organizationId !== ctx.organizationId) {
          return { kind: "notFound" as const };
        }
        if (
          escalation.clinicalLeadId !== ctx.userId &&
          ctx.role !== "PROGRAM_MANAGER"
        ) {
          return { kind: "forbidden" as const };
        }
        await tx.clinicalEscalation.update({
          where: { id: escalationId },
          data: {
            status: parsed.to,
            closedAt: parsed.to === "CLOSED" ? new Date() : null,
          },
        });
        await logAudit(
          {
            organizationId: ctx.organizationId!,
            actorId: ctx.userId,
            actorRole: ctx.role,
            action: AUDIT_ACTIONS.ESCALATION_TRANSITION,
            resourceType: "ClinicalEscalation",
            resourceId: escalationId,
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
            correlationId: ctx.correlationId,
            metadata: { to: parsed.to, from: escalation.status },
          },
          tx,
        );
        return { kind: "ok" as const };
      },
    );
    if (result.kind === "notFound") return NextResponse.json({ error: "not found" }, { status: 404 });
    if (result.kind === "forbidden") return NextResponse.json({ error: "not your escalation" }, { status: 403 });
    return NextResponse.json({ ok: true });
  },
  { roles: ["CLINICAL_LEAD", "PROGRAM_MANAGER"], rateLimit: "api.message" },
);
