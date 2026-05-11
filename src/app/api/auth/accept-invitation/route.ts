/**
 * Accept an invitation.
 *
 * POST /api/auth/accept-invitation
 *   body: { token, displayName?, password?, consentVersion }
 *
 * Validates the token (hash match + not expired + not already accepted).
 * In a single transaction:
 *   - Marks the Invitation ACCEPTED.
 *   - Sets User.accountState = ACTIVE for the matching email.
 *   - Creates a ConsentRecord row.
 *   - Optionally creates a PasswordCredential (only if the user supplied a
 *     password and the role is staff).
 *
 * Sign-in itself happens via NextAuth's standard flow afterward. This route
 * is the data-side acceptance.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { hashToken } from "@/lib/auth/invitation";
import { hashPassword, checkHibpBreach, PASSWORD_MIN_LENGTH } from "@/lib/auth/password";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";
import { consume, ipFromRequest } from "@/lib/security/rate-limit";
import { logger } from "@/lib/logging/log";

const Body = z.object({
  token: z.string().min(20).max(100),
  displayName: z.string().min(1).max(80).optional(),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(256).optional(),
  consentVersion: z.string().min(1),
});

const CONSENT_DOCUMENT_BY_VERSION: Record<string, string> = {
  "1.0.0":
    "Sentinel Veteran Consent v1.0.0 — weekly check-in, AI-pattern analysis (no replies, no diagnosis), human outreach when patterns shift, data not sold.",
};

export async function POST(req: Request) {
  const headers = new Headers(req.headers);
  const ip = ipFromRequest(headers);
  const limit = await consume("auth.invitation", `accept:${ip}`);
  if (!limit.allowed) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const docText = CONSENT_DOCUMENT_BY_VERSION[parsed.consentVersion];
  if (!docText) {
    return NextResponse.json({ error: "unknown consent version" }, { status: 400 });
  }
  const docHash = createHash("sha256").update(docText).digest("hex");
  const tokenHash = hashToken(parsed.token);

  const inv = await prisma.invitation.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      email: true,
      role: true,
      isOrgAdmin: true,
      organizationId: true,
      expiresAt: true,
      status: true,
    },
  });
  if (!inv) {
    return NextResponse.json({ error: "invalid token" }, { status: 404 });
  }
  if (inv.expiresAt < new Date() || inv.status === "EXPIRED" || inv.status === "REVOKED") {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }
  if (inv.status === "ACCEPTED") {
    return NextResponse.json({ error: "already accepted" }, { status: 409 });
  }

  // If a backup password was supplied (staff only), check it against the
  // Have-I-Been-Pwned k-anonymity range API before accepting. Set-time
  // rejection is the right place — failing later at sign-in would mean a
  // staff member walks around with a credential we know is breached.
  // We only spend the HIBP call after token + role validation so an
  // attacker can't use this as an oracle on arbitrary passwords.
  if (parsed.password && inv.role !== "VETERAN") {
    try {
      const breached = await checkHibpBreach(parsed.password);
      if (breached) {
        return NextResponse.json(
          {
            error: "password_breached",
            message:
              "That password has appeared in a known breach. Pick a different one — or skip the password and use the magic-link sign-in.",
          },
          { status: 400 },
        );
      }
    } catch (err) {
      // HIBP unreachable — fail open. Log so we notice if the third party
      // is consistently down (e.g. their CA chain changed and we missed
      // it); never block a legitimate accept on a third-party hiccup.
      logger.warn(
        {
          err: err instanceof Error ? err.message : String(err),
          invitationId: inv.id,
        },
        "hibp lookup failed; accepting invitation without breach check",
      );
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    // Find the existing User row created at invitation time, or create a new one.
    const user = await tx.user.findFirst({
      where: { email: inv.email, organizationId: inv.organizationId },
      select: { id: true, role: true },
    });
    let userId: string;
    if (user) {
      userId = user.id;
    } else {
      const created = await tx.user.create({
        data: {
          email: inv.email,
          organizationId: inv.organizationId,
          role: inv.role,
          isOrgAdmin: inv.isOrgAdmin,
          accountState: "ACTIVE",
          displayName: parsed.displayName ?? null,
          emailVerifiedAt: new Date(),
          accountStateChangedAt: new Date(),
          accountStateReason: "invitation accepted",
        },
        select: { id: true },
      });
      userId = created.id;
    }

    // Update existing user (if found) state + display name.
    if (user) {
      await tx.user.update({
        where: { id: user.id },
        data: {
          accountState: "ACTIVE",
          accountStateChangedAt: new Date(),
          accountStateReason: "invitation accepted",
          emailVerifiedAt: new Date(),
          displayName: parsed.displayName ?? undefined,
        },
      });
    }

    if (parsed.password && inv.role !== "VETERAN") {
      const hash = await hashPassword(parsed.password);
      await tx.passwordCredential.upsert({
        where: { userId },
        create: { userId, passwordHash: hash },
        update: { passwordHash: hash },
      });
    }

    await tx.consentRecord.create({
      data: {
        userId,
        organizationId: inv.organizationId,
        consentVersion: parsed.consentVersion,
        consentDocumentHash: docHash,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        consentVersion: parsed.consentVersion,
        consentSignedAt: new Date(),
      },
    });

    await tx.invitation.update({
      where: { id: inv.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });

    await logAudit(
      {
        organizationId: inv.organizationId,
        actorId: userId,
        actorRole: inv.role,
        action: AUDIT_ACTIONS.INVITATION_ACCEPT,
        resourceType: "Invitation",
        resourceId: inv.id,
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") ?? "",
        metadata: { role: inv.role, hasPassword: !!parsed.password },
      },
      tx,
    );

    return { userId, role: inv.role };
  });

  return NextResponse.json({
    ok: true,
    userId: result.userId,
    role: result.role,
    requiresMfaSetup: result.role !== "VETERAN",
  });
}
