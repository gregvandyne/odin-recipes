/**
 * Capture consent. Versioned, immutable, append-only.
 *
 * Each acceptance is a new ConsentRecord. The consent document itself is
 * versioned in source control; the hash is recorded so we can prove what the
 * user agreed to.
 *
 * Idempotent: clients may send `Idempotency-Key`. The same body re-sent under
 * the same key returns the cached response so a network retry doesn't create
 * duplicate ConsentRecord rows.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";
import { withTenant } from "@/lib/db/tenant-context";
import { withAuth } from "@/lib/security/api-auth";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";
import { withIdempotency } from "@/lib/idempotency/with-idempotency";

const Body = z.object({
  consentVersion: z.string().min(1),
});

const CONSENT_DOCUMENT_BY_VERSION: Record<string, string> = {
  "1.0.0":
    "Sentinel Veteran Consent v1.0.0 — weekly check-in, AI-pattern analysis (no replies, no diagnosis), human outreach when patterns shift, data not sold.",
};

export const POST = withAuth(
  async (req, ctx) => {
    if (!ctx.organizationId) {
      return NextResponse.json({ error: "no tenant" }, { status: 403 });
    }
    const organizationId = ctx.organizationId;

    return withIdempotency(req, ctx, "/api/consent", async (bodyText) => {
      let parsed: z.infer<typeof Body>;
      try {
        parsed = Body.parse(JSON.parse(bodyText));
      } catch {
        return { status: 400, payload: { error: "invalid body" }, skipCache: true };
      }

      const documentText = CONSENT_DOCUMENT_BY_VERSION[parsed.consentVersion];
      if (!documentText) {
        return { status: 400, payload: { error: "unknown consent version" }, skipCache: true };
      }
      const documentHash = createHash("sha256").update(documentText).digest("hex");

      await withTenant(
        { organizationId, userId: ctx.userId, userRole: ctx.role, isOrgAdmin: ctx.isOrgAdmin },
        async (tx) => {
          await tx.consentRecord.create({
            data: {
              userId: ctx.userId,
              organizationId,
              consentVersion: parsed.consentVersion,
              ipAddress: ctx.ipAddress,
              consentDocumentHash: documentHash,
            },
          });
          await tx.user.update({
            where: { id: ctx.userId },
            data: {
              consentVersion: parsed.consentVersion,
              consentSignedAt: new Date(),
            },
          });
          await logAudit(
            {
              organizationId,
              actorId: ctx.userId,
              actorRole: ctx.role,
              action: AUDIT_ACTIONS.CONSENT_SIGN,
              resourceType: "ConsentRecord",
              ipAddress: ctx.ipAddress,
              userAgent: ctx.userAgent,
              correlationId: ctx.correlationId,
              metadata: { consentVersion: parsed.consentVersion },
            },
            tx,
          );
        },
      );

      return { status: 200, payload: { ok: true } };
    });
  },
  {},
);
