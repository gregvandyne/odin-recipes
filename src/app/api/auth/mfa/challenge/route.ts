/**
 * MFA step-up challenge.
 *
 * POST /api/auth/mfa/challenge  body: { code, recoveryCode? }
 *
 * Verifies a TOTP code (or one-time recovery code) and stamps the active
 * session's `mfaCompletedAt`. The `requireMfa` gate accepts that timestamp
 * for 15 minutes after, allowing sensitive actions during the step-up window.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/security/api-auth";
import { prisma } from "@/lib/db/prisma";
import { decryptField } from "@/lib/security/encryption";
import { verifyTotp, hashRecoveryCode } from "@/lib/auth/totp";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";

const Body = z.object({
  code: z.string().min(4).max(20).optional(),
  recoveryCode: z.string().min(8).max(20).optional(),
});

const MFA_AAD = (userId: string) => `mfa-secret:${userId}`;

export const POST = withAuth(
  async (req, ctx) => {
    let parsed: z.infer<typeof Body>;
    try {
      parsed = Body.parse(await req.json());
    } catch {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }
    if (!parsed.code && !parsed.recoveryCode) {
      return NextResponse.json({ error: "code or recoveryCode required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { mfaSecretEncrypted: true, mfaEnabled: true },
    });
    if (!user?.mfaEnabled || !user.mfaSecretEncrypted) {
      return NextResponse.json({ error: "MFA not configured" }, { status: 400 });
    }

    let success = false;
    let path = "";
    if (parsed.code) {
      const secretHex = decryptField(user.mfaSecretEncrypted, MFA_AAD(ctx.userId));
      success = verifyTotp(Buffer.from(secretHex, "hex"), parsed.code);
      path = "totp";
    } else if (parsed.recoveryCode) {
      const codeHash = hashRecoveryCode(parsed.recoveryCode);
      const recovery = await prisma.mfaRecoveryCode.findFirst({
        where: { userId: ctx.userId, codeHash, usedAt: null },
        select: { id: true },
      });
      if (recovery) {
        success = true;
        path = "recovery";
        await prisma.mfaRecoveryCode.update({
          where: { id: recovery.id },
          data: { usedAt: new Date() },
        });
      }
    }

    if (!success) {
      await logAudit({
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        actorRole: ctx.role,
        action: AUDIT_ACTIONS.MFA_CHALLENGE_FAILURE,
        resourceType: "User",
        resourceId: ctx.userId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        correlationId: ctx.correlationId,
        metadata: { path },
      });
      return NextResponse.json({ error: "invalid code" }, { status: 401 });
    }

    const now = new Date();
    // Stamp ALL active sessions of this user as MFA-fresh — common case is
    // a single open session, but if the user has multiple they should not
    // be challenged again separately.
    await prisma.session.updateMany({
      where: { userId: ctx.userId, revokedAt: null },
      data: { mfaCompletedAt: now },
    });
    await logAudit({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      actorRole: ctx.role,
      action: AUDIT_ACTIONS.MFA_CHALLENGE_SUCCESS,
      resourceType: "User",
      resourceId: ctx.userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      correlationId: ctx.correlationId,
      metadata: { path },
    });
    return NextResponse.json({ ok: true, mfaCompletedAt: now.toISOString() });
  },
  { rateLimit: "auth.login" },
);
