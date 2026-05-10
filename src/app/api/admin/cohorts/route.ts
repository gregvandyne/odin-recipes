/**
 * Cohort creation. PROGRAM_MANAGER scoped.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/security/api-auth";
import { withTenant } from "@/lib/db/tenant-context";
import { logAudit } from "@/lib/audit/log";

const Body = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  startDate: z.string().refine((s) => !Number.isNaN(Date.parse(s))),
  endDate: z.string().refine((s) => !Number.isNaN(Date.parse(s))),
  programManagerId: z.string().uuid().optional(),
});

export const POST = withAuth(
  async (req, ctx) => {
    if (!ctx.organizationId) return NextResponse.json({ error: "no tenant" }, { status: 403 });
    let parsed: z.infer<typeof Body>;
    try {
      parsed = Body.parse(await req.json());
    } catch {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }
    const cohort = await withTenant(
      { organizationId: ctx.organizationId, userId: ctx.userId, userRole: ctx.role, isOrgAdmin: ctx.isOrgAdmin },
      async (tx) => {
        const created = await tx.cohort.create({
          data: {
            organizationId: ctx.organizationId!,
            name: parsed.name,
            description: parsed.description,
            startDate: new Date(parsed.startDate),
            endDate: new Date(parsed.endDate),
            programManagerId: parsed.programManagerId ?? ctx.userId,
            status: "PLANNED",
          },
          select: { id: true },
        });
        await logAudit(
          {
            organizationId: ctx.organizationId!,
            actorId: ctx.userId,
            actorRole: ctx.role,
            action: "cohort.create",
            resourceType: "Cohort",
            resourceId: created.id,
            correlationId: ctx.correlationId,
          },
          tx,
        );
        return created;
      },
    );
    return NextResponse.json({ ok: true, cohortId: cohort.id }, { status: 201 });
  },
  { roles: ["PROGRAM_MANAGER"], rateLimit: "api.message" },
);
