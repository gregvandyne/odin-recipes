/**
 * Capture consent. Versioned, immutable, append-only.
 *
 * Each acceptance is a new ConsentRecord. The consent document itself is
 * versioned in source control; the hash is recorded so we can prove what the
 * user agreed to.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/tenant-context";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";

const Body = z.object({
  consentVersion: z.string().min(1),
});

const CONSENT_DOCUMENT_BY_VERSION: Record<string, string> = {
  // The full text of consent v1.0.0. In production this lives in a versioned
  // CMS or document repository; the hash here proves what was shown.
  "1.0.0":
    "Sentinel Veteran Consent v1.0.0 — weekly check-in, AI-pattern analysis (no replies, no diagnosis), human outreach when patterns shift, data not sold.",
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const organizationId = (session.user as { organizationId?: string }).organizationId;
  if (!organizationId) return NextResponse.json({ error: "no tenant" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const documentText = CONSENT_DOCUMENT_BY_VERSION[parsed.data.consentVersion];
  if (!documentText) return NextResponse.json({ error: "unknown consent version" }, { status: 400 });
  const documentHash = createHash("sha256").update(documentText).digest("hex");

  await withTenant(
    { organizationId, userId, userRole: "VETERAN", isOrgAdmin: false },
    async (tx) => {
      await tx.consentRecord.create({
        data: {
          userId,
          organizationId,
          consentVersion: parsed.data.consentVersion,
          ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
          consentDocumentHash: documentHash,
        },
      });
      await tx.user.update({
        where: { id: userId },
        data: {
          consentVersion: parsed.data.consentVersion,
          consentSignedAt: new Date(),
        },
      });
      await logAudit(
        {
          organizationId,
          actorId: userId,
          actorRole: "VETERAN",
          action: AUDIT_ACTIONS.CONSENT_SIGN,
          resourceType: "ConsentRecord",
          metadata: { consentVersion: parsed.data.consentVersion },
        },
        tx,
      );
    },
  );

  return NextResponse.json({ ok: true });
}
