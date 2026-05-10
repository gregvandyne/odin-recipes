/**
 * Confirm MFA setup.
 *
 * POST /api/auth/mfa/confirm  body: { code }
 *
 * Verifies the supplied code against the freshly-stored (un-confirmed) secret.
 * On success: sets `mfaEnabled = true`, `mfaConfirmedAt = now`, and stamps
 * the current Session's `mfaCompletedAt` so the requireMfa gate immediately
 * lets through sensitive actions for the next 15 minutes.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/security/api-auth";
import { prisma } from "@/lib/db/prisma";
import { decryptField } from "@/lib/security/encryption";
import { verifyTotp } from "@/lib/auth/totp";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";

const Body = z.object({ code: z.string().min(6).max(10) });
const MFA_AAD = (userId: string) => `mfa-secret:${userId}`;

export const POST = withAuth(
  async (req, ctx) => {
    let parsed: z.infer<typeof Body>;
    try {
      parsed = Body.parse(await req.json());
    } catch {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { mfaSecretEncrypted: true },
    });
    if (!user?.mfaSecretEncrypted) {
      return NextResponse.json({ error: "no MFA setup in progress" }, { status: 400 });
    }
    const secretHex = decryptField(user.mfaSecretEncrypted, MFA_AAD(ctx.userId));
    const ok = verifyTotp(Buffer.from(secretHex, "hex"), parsed.code);
    if (!ok) {
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
        metadata: { stage: "confirm" },
      });
      return NextResponse.json({ error: "invalid code" }, { status: 400 });
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: ctx.userId },
        data: { mfaEnabled: true, mfaConfirmedAt: now },
      });
      // Stamp every active session for this user as MFA-fresh — the user
      // shouldn't get re-challenged after just confirming.
      await tx.session.updateMany({
        where: { userId: ctx.userId, revokedAt: null },
        data: { mfaCompletedAt: now },
      });
    });

    await logAudit({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      actorRole: ctx.role,
      action: AUDIT_ACTIONS.MFA_CONFIRM,
      resourceType: "User",
      resourceId: ctx.userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      correlationId: ctx.correlationId,
    });

    return NextResponse.json({ ok: true, mfaConfirmedAt: now.toISOString() });
  },
  { rateLimit: "auth.password" },
);
