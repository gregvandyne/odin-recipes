/**
 * Acknowledge a flag. The "I see this" coordinator action — distinct from
 * Resolve. Acknowledged flags drop in the queue order; resolved flags
 * disappear from the active view.
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/security/api-auth";
import { withTenant } from "@/lib/db/tenant-context";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";
import { withIdempotency } from "@/lib/idempotency/with-idempotency";

export const POST = withAuth(
  async (req: NextRequest, ctx) => {
    if (!ctx.organizationId) return NextResponse.json({ error: "no tenant" }, { status: 403 });
    const url = new URL(req.url);
    const flagId = url.pathname.split("/").filter(Boolean).at(-2);
    if (!flagId) return NextResponse.json({ error: "missing id" }, { status: 400 });

    return withIdempotency(req, ctx, `/api/flags/${flagId}/acknowledge`, async () => {
      const result = await withTenant(
        { organizationId: ctx.organizationId!, userId: ctx.userId, userRole: ctx.role, isOrgAdmin: ctx.isOrgAdmin },
        async (tx) => {
          const flag = await tx.flag.findUnique({
            where: { id: flagId },
            select: { id: true, organizationId: true, acknowledgedAt: true },
          });
          if (!flag || flag.organizationId !== ctx.organizationId) {
            return { kind: "notFound" as const };
          }
          if (flag.acknowledgedAt) {
            return { kind: "ok" as const, alreadyAcknowledged: true };
          }
          await tx.flag.update({
            where: { id: flagId },
            data: {
              acknowledgedByCoordinatorId: ctx.userId,
              acknowledgedAt: new Date(),
            },
          });
          await logAudit(
            {
              organizationId: ctx.organizationId!,
              actorId: ctx.userId,
              actorRole: ctx.role,
              action: AUDIT_ACTIONS.FLAG_ACK,
              resourceType: "Flag",
              resourceId: flagId,
              ipAddress: ctx.ipAddress,
              userAgent: ctx.userAgent,
              correlationId: ctx.correlationId,
            },
            tx,
          );
          return { kind: "ok" as const };
        },
      );
      if (result.kind === "notFound") {
        return { status: 404, payload: { error: "not found" }, skipCache: true };
      }
      return { status: 200, payload: { ok: true, alreadyAcknowledged: !!result.alreadyAcknowledged } };
    });
  },
  { roles: ["COORDINATOR", "CLINICAL_LEAD", "PROGRAM_MANAGER"], rateLimit: "api.message" },
);
