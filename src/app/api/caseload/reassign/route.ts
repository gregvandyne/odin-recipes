/**
 * Caseload reassignment.
 *
 * POST /api/caseload/reassign
 *   body: { fromCoordinatorId, toCoordinatorId, veteranIds[], reason }
 *
 * Creates a `CaseloadReassignment` row and enqueues the worker job that
 * actually moves the veterans. Worker dispatches notifications + audits.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/security/api-auth";
import { withTenant } from "@/lib/db/tenant-context";
import { withIdempotency } from "@/lib/idempotency/with-idempotency";
import { enqueueCaseloadReassignment } from "@/lib/queue/queues";

const Body = z.object({
  fromCoordinatorId: z.string().uuid(),
  toCoordinatorId: z.string().uuid(),
  veteranIds: z.array(z.string().uuid()).min(1).max(100),
  reason: z.string().min(5).max(500),
});

export const POST = withAuth(
  async (req, ctx) => {
    if (!ctx.organizationId) return NextResponse.json({ error: "no tenant" }, { status: 403 });
    const organizationId = ctx.organizationId;

    return withIdempotency(req, ctx, "/api/caseload/reassign", async (bodyText) => {
      let parsed: z.infer<typeof Body>;
      try {
        parsed = Body.parse(JSON.parse(bodyText));
      } catch {
        return { status: 400, payload: { error: "invalid body" }, skipCache: true };
      }
      if (parsed.fromCoordinatorId === parsed.toCoordinatorId) {
        return { status: 400, payload: { error: "from and to must differ" }, skipCache: true };
      }
      const reassignment = await withTenant(
        { organizationId, userId: ctx.userId, userRole: ctx.role, isOrgAdmin: ctx.isOrgAdmin },
        async (tx) =>
          tx.caseloadReassignment.create({
            data: {
              organizationId,
              fromCoordinatorId: parsed.fromCoordinatorId,
              toCoordinatorId: parsed.toCoordinatorId,
              veteranIds: parsed.veteranIds,
              reason: parsed.reason,
              initiatedById: ctx.userId,
            },
            select: { id: true },
          }),
      );
      void enqueueCaseloadReassignment({
        reassignmentId: reassignment.id,
        organizationId,
        correlationId: ctx.correlationId,
      });
      return { status: 202, payload: { ok: true, reassignmentId: reassignment.id } };
    });
  },
  { roles: ["PROGRAM_MANAGER"], rateLimit: "api.message", requireMfa: true },
);
