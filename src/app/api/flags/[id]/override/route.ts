/**
 * Clinical-Lead severity override.
 *
 * The engine produces a severity. The Clinical Lead sometimes determines —
 * with full clinical context — that the severity should be different. This
 * endpoint records the override + reason so:
 *   1. The flag's effective severity reflects clinical judgment.
 *   2. The Program Manager dashboard can aggregate overrides ("ORANGE → YELLOW
 *      32 times this month, 80% citing 'context: known stable plateau'") so
 *      threshold tuning can be evidence-based.
 *
 * Auto-tuning thresholds is intentionally NOT done here — clinical safety
 * means overrides surface data, not silently rewrite the engine.
 *
 * Idempotent: clients may send `Idempotency-Key`. Replay-safe.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/security/api-auth";
import { withTenant } from "@/lib/db/tenant-context";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";
import { withIdempotency } from "@/lib/idempotency/with-idempotency";

const Body = z.object({
  newSeverity: z.enum(["GREEN", "YELLOW", "ORANGE", "RED"]),
  reason: z.string().min(10).max(2000),
});

export const POST = withAuth(
  async (req: NextRequest, ctx) => {
    if (!ctx.organizationId) {
      return NextResponse.json({ error: "no tenant" }, { status: 403 });
    }
    const organizationId = ctx.organizationId;
    const url = new URL(req.url);
    const flagId = url.pathname.split("/").filter(Boolean).at(-2);
    if (!flagId) return NextResponse.json({ error: "missing id" }, { status: 400 });

    return withIdempotency(req, ctx, `/api/flags/${flagId}/override`, async (bodyText) => {
      let parsed: z.infer<typeof Body>;
      try {
        parsed = Body.parse(JSON.parse(bodyText));
      } catch {
        return { status: 400, payload: { error: "invalid body" }, skipCache: true };
      }

      const result = await withTenant(
        { organizationId, userId: ctx.userId, userRole: ctx.role, isOrgAdmin: ctx.isOrgAdmin },
        async (tx) => {
          const flag = await tx.flag.findUnique({
            where: { id: flagId },
            select: { id: true, organizationId: true, severity: true, severityBeforeOverride: true },
          });
          if (!flag || flag.organizationId !== organizationId) {
            return { kind: "notFound" as const };
          }

          const updated = await tx.flag.update({
            where: { id: flagId },
            data: {
              severity: parsed.newSeverity,
              severityOverrideById: ctx.userId,
              severityOverrideReason: parsed.reason,
              severityOverrideAt: new Date(),
              severityBeforeOverride: flag.severityBeforeOverride ?? flag.severity,
            },
            select: {
              id: true,
              severity: true,
              severityBeforeOverride: true,
              severityOverrideAt: true,
            },
          });

          await logAudit(
            {
              organizationId,
              actorId: ctx.userId,
              actorRole: ctx.role,
              action: AUDIT_ACTIONS.FLAG_OVERRIDE,
              resourceType: "Flag",
              resourceId: flagId,
              reason: parsed.reason,
              ipAddress: ctx.ipAddress,
              userAgent: ctx.userAgent,
              correlationId: ctx.correlationId,
              metadata: {
                priorSeverity: flag.severity,
                newSeverity: parsed.newSeverity,
              },
            },
            tx,
          );

          return { kind: "ok" as const, flag: updated };
        },
      );

      if (result.kind === "notFound") {
        return { status: 404, payload: { error: "not found" }, skipCache: true };
      }
      return { status: 200, payload: { ok: true, flag: result.flag } };
    });
  },
  { roles: ["CLINICAL_LEAD", "PROGRAM_MANAGER"], rateLimit: "api.flag.override" },
);
