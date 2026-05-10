/**
 * OOO management for the current coordinator.
 *
 * GET    /api/ooo               → list current + future OOO blocks for ctx.userId
 * POST   /api/ooo               → create a block
 * DELETE /api/ooo?id={blockId}  → cancel a block
 *
 * The notification fan-out worker checks active blocks at delivery time and
 * routes to coverage if set.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/security/api-auth";
import { withTenant } from "@/lib/db/tenant-context";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";

const Body = z.object({
  startAt: z.string().refine((s) => !Number.isNaN(Date.parse(s))),
  endAt: z.string().refine((s) => !Number.isNaN(Date.parse(s))),
  coverageCoordinatorId: z.string().uuid().optional(),
  autoReplyMessage: z.string().min(1).max(500),
});

export const GET = withAuth(
  async (_req, ctx) => {
    if (!ctx.organizationId) return NextResponse.json({ error: "no tenant" }, { status: 403 });
    const blocks = await withTenant(
      { organizationId: ctx.organizationId, userId: ctx.userId, userRole: ctx.role, isOrgAdmin: ctx.isOrgAdmin },
      async (tx) =>
        tx.coordinatorOOO.findMany({
          where: { coordinatorId: ctx.userId, endAt: { gte: new Date() } },
          orderBy: { startAt: "asc" },
        }),
    );
    return NextResponse.json({ blocks });
  },
  { roles: ["COORDINATOR", "CLINICAL_LEAD", "PROGRAM_MANAGER"] },
);

export const POST = withAuth(
  async (req, ctx) => {
    if (!ctx.organizationId) return NextResponse.json({ error: "no tenant" }, { status: 403 });
    let parsed: z.infer<typeof Body>;
    try {
      parsed = Body.parse(await req.json());
    } catch {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }
    const startAt = new Date(parsed.startAt);
    const endAt = new Date(parsed.endAt);
    if (endAt <= startAt) {
      return NextResponse.json({ error: "endAt must be after startAt" }, { status: 400 });
    }
    const result = await withTenant(
      { organizationId: ctx.organizationId, userId: ctx.userId, userRole: ctx.role, isOrgAdmin: ctx.isOrgAdmin },
      async (tx) => {
        const created = await tx.coordinatorOOO.create({
          data: {
            organizationId: ctx.organizationId!,
            coordinatorId: ctx.userId,
            startAt,
            endAt,
            coverageCoordinatorId: parsed.coverageCoordinatorId,
            autoReplyMessage: parsed.autoReplyMessage,
          },
          select: { id: true },
        });
        await logAudit(
          {
            organizationId: ctx.organizationId!,
            actorId: ctx.userId,
            actorRole: ctx.role,
            action: AUDIT_ACTIONS.OOO_SET,
            resourceType: "CoordinatorOOO",
            resourceId: created.id,
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
            correlationId: ctx.correlationId,
            metadata: {
              startAt: startAt.toISOString(),
              endAt: endAt.toISOString(),
              hasCoverage: !!parsed.coverageCoordinatorId,
            },
          },
          tx,
        );
        return created;
      },
    );
    return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
  },
  { roles: ["COORDINATOR", "CLINICAL_LEAD", "PROGRAM_MANAGER"], rateLimit: "api.message" },
);

export const DELETE = withAuth(
  async (req: NextRequest, ctx) => {
    if (!ctx.organizationId) return NextResponse.json({ error: "no tenant" }, { status: 403 });
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await withTenant(
      { organizationId: ctx.organizationId, userId: ctx.userId, userRole: ctx.role, isOrgAdmin: ctx.isOrgAdmin },
      async (tx) => {
        const block = await tx.coordinatorOOO.findUnique({
          where: { id },
          select: { coordinatorId: true, organizationId: true },
        });
        if (!block || block.organizationId !== ctx.organizationId) return;
        if (block.coordinatorId !== ctx.userId && ctx.role !== "PROGRAM_MANAGER") return;
        await tx.coordinatorOOO.delete({ where: { id } });
        await logAudit(
          {
            organizationId: ctx.organizationId!,
            actorId: ctx.userId,
            actorRole: ctx.role,
            action: AUDIT_ACTIONS.OOO_CLEARED,
            resourceType: "CoordinatorOOO",
            resourceId: id,
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
            correlationId: ctx.correlationId,
          },
          tx,
        );
      },
    );
    return NextResponse.json({ ok: true });
  },
  { roles: ["COORDINATOR", "CLINICAL_LEAD", "PROGRAM_MANAGER"], rateLimit: "api.message" },
);
