/**
 * Disable MFA for the current user.
 *
 * Requires a fresh MFA step-up so a stolen session cookie can't disable MFA
 * silently. The audit entry surfaces the action to the org admin.
 */

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/security/api-auth";
import { prisma } from "@/lib/db/prisma";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";

export const POST = withAuth(
  async (_req, ctx) => {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: ctx.userId },
        data: { mfaEnabled: false, mfaSecretEncrypted: null, mfaConfirmedAt: null },
      });
      await tx.mfaRecoveryCode.deleteMany({ where: { userId: ctx.userId } });
    });
    await logAudit({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      actorRole: ctx.role,
      action: AUDIT_ACTIONS.MFA_DISABLE,
      resourceType: "User",
      resourceId: ctx.userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      correlationId: ctx.correlationId,
    });
    return NextResponse.json({ ok: true });
  },
  { rateLimit: "auth.password", requireMfa: true },
);
