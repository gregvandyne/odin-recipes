/**
 * Reactivate a previously deactivated user. Sensitive — requires fresh MFA.
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/security/api-auth";
import { withTenant } from "@/lib/db/tenant-context";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";

export const POST = withAuth(
  async (req: NextRequest, ctx) => {
    if (!ctx.organizationId) return NextResponse.json({ error: "no tenant" }, { status: 403 });
    const url = new URL(req.url);
    const targetUserId = url.pathname.split("/").filter(Boolean).at(-2);
    if (!targetUserId) return NextResponse.json({ error: "missing id" }, { status: 400 });
    const result = await withTenant(
      { organizationId: ctx.organizationId, userId: ctx.userId, userRole: ctx.role, isOrgAdmin: ctx.isOrgAdmin },
      async (tx) => {
        const target = await tx.user.findUnique({
          where: { id: targetUserId },
          select: { id: true, organizationId: true, accountState: true },
        });
        if (!target || target.organizationId !== ctx.organizationId) return { status: 404 as const };
        if (target.accountState === "ACTIVE") return { status: 200 as const, already: true };
        await tx.user.update({
          where: { id: targetUserId },
          data: {
            accountState: "ACTIVE",
            accountStateChangedAt: new Date(),
            accountStateChangedById: ctx.userId,
            accountStateReason: "reactivated",
            deactivatedAt: null,
            deactivatedById: null,
            deactivationReason: null,
          },
        });
        await logAudit(
          {
            organizationId: ctx.organizationId!,
            actorId: ctx.userId,
            actorRole: ctx.role,
            action: AUDIT_ACTIONS.USER_REACTIVATE,
            resourceType: "User",
            resourceId: targetUserId,
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
            correlationId: ctx.correlationId,
          },
          tx,
        );
        return { status: 200 as const };
      },
    );
    if (result.status === 404) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true, alreadyActive: !!result.already });
  },
  { roles: ["PROGRAM_MANAGER", "SUPER_ADMIN"], rateLimit: "auth.password", requireMfa: true },
);
