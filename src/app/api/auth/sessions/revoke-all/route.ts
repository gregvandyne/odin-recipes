/**
 * Revoke all sessions for the current user. Sets `revokedAt` on every
 * active Session row so the next request on any device falls through to
 * sign-in.
 *
 * Available from /account/security.
 */

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/security/api-auth";
import { prisma } from "@/lib/db/prisma";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";

export const POST = withAuth(
  async (_req, ctx) => {
    const result = await prisma.session.updateMany({
      where: { userId: ctx.userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: "user.revoke-all" },
    });
    await logAudit({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      actorRole: ctx.role,
      action: AUDIT_ACTIONS.SESSION_REVOKED_ALL,
      resourceType: "User",
      resourceId: ctx.userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      correlationId: ctx.correlationId,
      metadata: { revoked: result.count },
    });
    return NextResponse.json({ ok: true, revoked: result.count });
  },
  { rateLimit: "auth.password" },
);
