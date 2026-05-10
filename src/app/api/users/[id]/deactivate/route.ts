/**
 * Deactivate a user. Org-admin (or PROGRAM_MANAGER) action. Sets accountState
 * to DEACTIVATED, revokes all of the target user's sessions, audit-logged.
 *
 * Sensitive — requires fresh MFA.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/security/api-auth";
import { withTenant } from "@/lib/db/tenant-context";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";

const Body = z.object({
  reason: z.string().min(5).max(500),
});

export const POST = withAuth(
  async (req: NextRequest, ctx) => {
    if (!ctx.organizationId) return NextResponse.json({ error: "no tenant" }, { status: 403 });
    const url = new URL(req.url);
    const targetUserId = url.pathname.split("/").filter(Boolean).at(-2);
    if (!targetUserId) return NextResponse.json({ error: "missing id" }, { status: 400 });
    if (targetUserId === ctx.userId) {
      return NextResponse.json({ error: "cannot deactivate yourself" }, { status: 400 });
    }
    let parsed: z.infer<typeof Body>;
    try {
      parsed = Body.parse(await req.json());
    } catch {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }

    const result = await withTenant(
      { organizationId: ctx.organizationId, userId: ctx.userId, userRole: ctx.role, isOrgAdmin: ctx.isOrgAdmin },
      async (tx) => {
        const target = await tx.user.findUnique({
          where: { id: targetUserId },
          select: { id: true, organizationId: true, role: true, accountState: true },
        });
        if (!target || target.organizationId !== ctx.organizationId) {
          return { status: 404 as const };
        }
        if (target.accountState === "DEACTIVATED") {
          return { status: 200 as const, alreadyDeactivated: true };
        }

        await tx.user.update({
          where: { id: targetUserId },
          data: {
            accountState: "DEACTIVATED",
            accountStateChangedAt: new Date(),
            accountStateChangedById: ctx.userId,
            accountStateReason: parsed.reason,
            deactivatedAt: new Date(),
            deactivatedById: ctx.userId,
            deactivationReason: parsed.reason,
          },
        });
        await tx.session.updateMany({
          where: { userId: targetUserId, revokedAt: null },
          data: { revokedAt: new Date(), revokedReason: "user.deactivated" },
        });
        await logAudit(
          {
            organizationId: ctx.organizationId!,
            actorId: ctx.userId,
            actorRole: ctx.role,
            action: AUDIT_ACTIONS.USER_DEACTIVATE,
            resourceType: "User",
            resourceId: targetUserId,
            reason: parsed.reason,
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
            correlationId: ctx.correlationId,
            metadata: { targetRole: target.role },
          },
          tx,
        );
        return { status: 200 as const };
      },
    );

    if (result.status === 404) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true, alreadyDeactivated: !!result.alreadyDeactivated });
  },
  { roles: ["PROGRAM_MANAGER", "SUPER_ADMIN"], rateLimit: "auth.password", requireMfa: true },
);
