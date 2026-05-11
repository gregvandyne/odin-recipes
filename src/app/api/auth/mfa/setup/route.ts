/**
 * Begin MFA setup.
 *
 * POST /api/auth/mfa/setup → returns { otpauthUrl, base32Secret, recoveryCodes }
 *
 * The secret is generated, encrypted with AAD `mfa-secret:${userId}`, and
 * stored on `User.mfaSecretEncrypted`. `mfaConfirmedAt` stays null until the
 * user posts a working code via /confirm.
 *
 * Recovery codes are returned ONCE (the user copies them to a safe place);
 * we store hashed copies in `MfaRecoveryCode`.
 */

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/security/api-auth";
import { prisma } from "@/lib/db/prisma";
import { encryptField } from "@/lib/security/encryption";
import {
  generateSecret,
  toBase32,
  otpauthUrl,
  generateRecoveryCodes,
  hashRecoveryCode,
} from "@/lib/auth/totp";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";

const MFA_AAD = (userId: string) => `mfa-secret:${userId}`;

export const POST = withAuth(
  async (_req, ctx) => {
    // Refuse to overwrite a confirmed MFA secret. The "happy path" for
    // setup is a one-shot from the wizard; if a user with MFA already
    // configured hits this route (browser back button, second-tab,
    // attacker with a stolen session) we'd otherwise wipe their TOTP
    // secret and leave them with mfaEnabled=false until they walk through
    // the wizard again. Require an explicit `/api/auth/mfa/disable` first
    // (which itself requires `requireMfa: true`).
    const existing = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { mfaConfirmedAt: true },
    });
    if (existing?.mfaConfirmedAt) {
      return NextResponse.json(
        { error: "mfa_already_configured", message: "Disable MFA first before setting it up again." },
        { status: 409 },
      );
    }

    const secretBytes = generateSecret(20);
    const enc = encryptField(secretBytes.toString("hex"), MFA_AAD(ctx.userId));

    // Generate recovery codes; replace any prior batch.
    const codes = generateRecoveryCodes(10);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: ctx.userId },
        data: {
          mfaSecretEncrypted: enc,
          mfaConfirmedAt: null,
          mfaEnabled: false,
        },
      });
      await tx.mfaRecoveryCode.deleteMany({ where: { userId: ctx.userId } });
      await tx.mfaRecoveryCode.createMany({
        data: codes.map((c) => ({
          userId: ctx.userId,
          codeHash: hashRecoveryCode(c),
        })),
      });
    });

    await logAudit({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      actorRole: ctx.role,
      action: AUDIT_ACTIONS.MFA_SETUP,
      resourceType: "User",
      resourceId: ctx.userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      correlationId: ctx.correlationId,
    });

    const issuer = process.env.AUTH_ISSUER ?? "Sentinel";
    const url = otpauthUrl({
      issuer,
      account: ctx.email || ctx.userId,
      secret: secretBytes,
    });
    return NextResponse.json({
      otpauthUrl: url,
      base32Secret: toBase32(secretBytes).replace(/=+$/g, ""),
      recoveryCodes: codes,
    });
  },
  { rateLimit: "auth.password" },
);
