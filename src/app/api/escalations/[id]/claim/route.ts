/**
 * Clinical lead claims an escalation. Sets `clinicalLeadId`, transitions to
 * IN_REVIEW. First-claim-wins.
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/security/api-auth";
import { withTenant } from "@/lib/db/tenant-context";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";

export const POST = withAuth(
  async (req: NextRequest, ctx) => {
    if (!ctx.organizationId) return NextResponse.json({ error: "no tenant" }, { status: 403 });
    const url = new URL(req.url);
    const escalationId = url.pathname.split("/").filter(Boolean).at(-2);
    if (!escalationId) return NextResponse.json({ error: "missing id" }, { status: 400 });

    const result = await withTenant(
      { organizationId: ctx.organizationId, userId: ctx.userId, userRole: ctx.role, isOrgAdmin: ctx.isOrgAdmin },
      async (tx) => {
        const updated = await tx.clinicalEscalation.updateMany({
          where: {
            id: escalationId,
            organizationId: ctx.organizationId!,
            clinicalLeadId: null,
            status: "PENDING",
          },
          data: { clinicalLeadId: ctx.userId, status: "IN_REVIEW" },
        });
        if (updated.count === 0) {
          return { kind: "raceLost" as const };
        }
        await logAudit(
          {
            organizationId: ctx.organizationId!,
            actorId: ctx.userId,
            actorRole: ctx.role,
            action: AUDIT_ACTIONS.ESCALATION_CLAIM,
            resourceType: "ClinicalEscalation",
            resourceId: escalationId,
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
            correlationId: ctx.correlationId,
          },
          tx,
        );
        return { kind: "ok" as const };
      },
    );
    if (result.kind === "raceLost") {
      return NextResponse.json({ error: "already claimed" }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  },
  { roles: ["CLINICAL_LEAD", "PROGRAM_MANAGER"], rateLimit: "api.message" },
);
