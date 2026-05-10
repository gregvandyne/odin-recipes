/**
 * Staff search.
 *
 * GET /api/search?q=jordan
 *
 * Returns up to 10 veteran matches scoped by tenant. Coordinators see only
 * the veterans assigned to them; PROGRAM_MANAGER + SUPER_ADMIN see all.
 *
 * The ranker is intentionally simple: case-insensitive contains over
 * displayName and email. Production-scale refinement (trigram + fuzzy)
 * is a future-roadmap item; today's caseload size makes this fine.
 */

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/security/api-auth";
import { withTenant } from "@/lib/db/tenant-context";
import { currentWeekNumber } from "@/lib/program/week";

export const GET = withAuth(
  async (req, ctx) => {
    if (!ctx.organizationId) return NextResponse.json({ error: "no tenant" }, { status: 403 });
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
    if (q.length < 2) {
      return NextResponse.json({ veterans: [] });
    }

    const isPM = ctx.role === "PROGRAM_MANAGER" || ctx.role === "SUPER_ADMIN";

    const veterans = await withTenant(
      { organizationId: ctx.organizationId, userId: ctx.userId, userRole: ctx.role, isOrgAdmin: ctx.isOrgAdmin },
      async (tx) =>
        tx.veteranProfile.findMany({
          where: {
            organizationId: ctx.organizationId!,
            status: "ACTIVE",
            ...(isPM ? {} : { assignedCoordinatorId: ctx.userId }),
            user: {
              is: {
                OR: [
                  { displayName: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                ],
              },
            },
          },
          select: {
            userId: true,
            programStartDate: true,
            user: { select: { displayName: true, email: true } },
          },
          take: 10,
        }),
    );

    return NextResponse.json({
      veterans: veterans.map((v) => ({
        id: v.userId,
        name: v.user.displayName ?? v.user.email,
        week: currentWeekNumber(v.programStartDate),
      })),
    });
  },
  { roles: ["COORDINATOR", "CLINICAL_LEAD", "PROGRAM_MANAGER", "SUPER_ADMIN"], rateLimit: "api.message" },
);
