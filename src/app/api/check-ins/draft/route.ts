/**
 * Draft check-in API.
 *
 * GET  /api/check-ins/draft?week=N → return existing draft (or null) for the
 *   authenticated veteran's current program week.
 * PUT  /api/check-ins/draft        → upsert the draft. Debounced 800ms by the
 *   client. Idempotent by (veteranId, weekNumber).
 * DELETE /api/check-ins/draft      → discard the draft (e.g. veteran chose
 *   "start over").
 *
 * Drafts are mutable — the only mutable surface in the check-in pipeline.
 * On submit (`POST /api/check-ins`) the draft is deleted in the same
 * transaction that creates the immutable CheckIn.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/security/api-auth";
import { withTenant } from "@/lib/db/tenant-context";

const PutBody = z.object({
  weekNumber: z.number().int().min(1).max(52),
  responses: z.array(
    z.object({
      questionId: z.string(),
      value: z.union([z.number(), z.string(), z.null()]),
      skipped: z.boolean(),
    }),
  ),
  openEndedResponse: z.string().nullable(),
});

export const GET = withAuth(
  async (req: NextRequest, ctx) => {
    if (ctx.role !== "VETERAN" || !ctx.organizationId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const url = new URL(req.url);
    const week = parseInt(url.searchParams.get("week") ?? "", 10);
    if (!Number.isFinite(week) || week < 1 || week > 52) {
      return NextResponse.json({ error: "invalid week" }, { status: 400 });
    }
    const draft = await withTenant(
      { organizationId: ctx.organizationId, userId: ctx.userId, userRole: "VETERAN", isOrgAdmin: false },
      async (tx) =>
        tx.checkInDraft.findUnique({
          where: { veteranId_weekNumber: { veteranId: ctx.userId, weekNumber: week } },
          select: { responses: true, openEndedResponse: true, lastUpdatedAt: true },
        }),
    );
    return NextResponse.json({ draft });
  },
  { roles: ["VETERAN"], rateLimit: "api.checkin.draft" },
);

export const PUT = withAuth(
  async (req: NextRequest, ctx) => {
    if (ctx.role !== "VETERAN" || !ctx.organizationId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const organizationId = ctx.organizationId;
    let parsed: z.infer<typeof PutBody>;
    try {
      parsed = PutBody.parse(await req.json());
    } catch {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }

    const draft = await withTenant(
      { organizationId, userId: ctx.userId, userRole: "VETERAN", isOrgAdmin: false },
      async (tx) =>
        tx.checkInDraft.upsert({
          where: { veteranId_weekNumber: { veteranId: ctx.userId, weekNumber: parsed.weekNumber } },
          create: {
            organizationId,
            veteranId: ctx.userId,
            weekNumber: parsed.weekNumber,
            responses: parsed.responses as unknown as object,
            openEndedResponse: parsed.openEndedResponse,
          },
          update: {
            responses: parsed.responses as unknown as object,
            openEndedResponse: parsed.openEndedResponse,
          },
          select: { lastUpdatedAt: true },
        }),
    );
    return NextResponse.json({ ok: true, lastUpdatedAt: draft.lastUpdatedAt });
  },
  { roles: ["VETERAN"], rateLimit: "api.checkin.draft" },
);

export const DELETE = withAuth(
  async (req: NextRequest, ctx) => {
    if (ctx.role !== "VETERAN" || !ctx.organizationId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const url = new URL(req.url);
    const week = parseInt(url.searchParams.get("week") ?? "", 10);
    if (!Number.isFinite(week) || week < 1 || week > 52) {
      return NextResponse.json({ error: "invalid week" }, { status: 400 });
    }
    await withTenant(
      { organizationId: ctx.organizationId, userId: ctx.userId, userRole: "VETERAN", isOrgAdmin: false },
      async (tx) =>
        tx.checkInDraft.deleteMany({
          where: { veteranId: ctx.userId, weekNumber: week },
        }),
    );
    return NextResponse.json({ ok: true });
  },
  { roles: ["VETERAN"], rateLimit: "api.checkin.draft" },
);
