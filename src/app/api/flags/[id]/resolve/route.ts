/**
 * Resolve a flag. Sets `resolvedAt` and a structured `resolution` JSON the
 * coordinator selects from a small set: contacted, escalated, false_positive,
 * deferred. Resolved flags disappear from the active triage queue.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/security/api-auth";
import { withTenant } from "@/lib/db/tenant-context";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";
import { withIdempotency } from "@/lib/idempotency/with-idempotency";

const Body = z.object({
  outcome: z.enum(["contacted", "escalated", "false_positive", "deferred"]),
  notes: z.string().max(1000).optional(),
});

export const POST = withAuth(
  async (req: NextRequest, ctx) => {
    if (!ctx.organizationId) return NextResponse.json({ error: "no tenant" }, { status: 403 });
    const url = new URL(req.url);
    const flagId = url.pathname.split("/").filter(Boolean).at(-2);
    if (!flagId) return NextResponse.json({ error: "missing id" }, { status: 400 });

    return withIdempotency(req, ctx, `/api/flags/${flagId}/resolve`, async (bodyText) => {
      let parsed: z.infer<typeof Body>;
      try {
        parsed = Body.parse(JSON.parse(bodyText));
      } catch {
        return { status: 400, payload: { error: "invalid body" }, skipCache: true };
      }

      const result = await withTenant(
        { organizationId: ctx.organizationId!, userId: ctx.userId, userRole: ctx.role, isOrgAdmin: ctx.isOrgAdmin },
        async (tx) => {
          const flag = await tx.flag.findUnique({
            where: { id: flagId },
            select: { id: true, organizationId: true, resolvedAt: true, severity: true },
          });
          if (!flag || flag.organizationId !== ctx.organizationId) {
            return { kind: "notFound" as const };
          }
          await tx.flag.update({
            where: { id: flagId },
            data: {
              resolvedAt: flag.resolvedAt ?? new Date(),
              acknowledgedByCoordinatorId: ctx.userId,
              acknowledgedAt: new Date(),
              resolution: { outcome: parsed.outcome, notes: parsed.notes ?? null, resolvedById: ctx.userId },
            },
          });
          await logAudit(
            {
              organizationId: ctx.organizationId!,
              actorId: ctx.userId,
              actorRole: ctx.role,
              action: AUDIT_ACTIONS.FLAG_RESOLVE,
              resourceType: "Flag",
              resourceId: flagId,
              ipAddress: ctx.ipAddress,
              userAgent: ctx.userAgent,
              correlationId: ctx.correlationId,
              metadata: { outcome: parsed.outcome, severity: flag.severity },
            },
            tx,
          );
          return { kind: "ok" as const };
        },
      );

      if (result.kind === "notFound") {
        return { status: 404, payload: { error: "not found" }, skipCache: true };
      }
      return { status: 200, payload: { ok: true } };
    });
  },
  { roles: ["COORDINATOR", "CLINICAL_LEAD", "PROGRAM_MANAGER"], rateLimit: "api.message" },
);
