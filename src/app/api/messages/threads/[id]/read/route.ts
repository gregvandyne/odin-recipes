/**
 * Mark every unread message in a thread (sent by the *other* participant)
 * as read by the current viewer.
 *
 * POST /api/messages/threads/[id]/read
 *
 * Auth:
 *   - Veteran can only mark their own thread.
 *   - Coordinator can only mark threads they're assigned to.
 *
 * Idempotent at the DB level (updateMany with `readAt IS NULL`); safe to
 * call repeatedly when a thread re-renders.
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/security/api-auth";
import { withTenant } from "@/lib/db/tenant-context";

export const POST = withAuth(
  async (req: NextRequest, ctx) => {
    if (!ctx.organizationId) return NextResponse.json({ error: "no tenant" }, { status: 403 });
    const url = new URL(req.url);
    const threadId = url.pathname.split("/").filter(Boolean).at(-2);
    if (!threadId) return NextResponse.json({ error: "missing id" }, { status: 400 });

    const result = await withTenant(
      { organizationId: ctx.organizationId, userId: ctx.userId, userRole: ctx.role, isOrgAdmin: ctx.isOrgAdmin },
      async (tx) => {
        const thread = await tx.messageThread.findUnique({
          where: { id: threadId },
          select: { id: true, organizationId: true, veteranId: true, coordinatorId: true },
        });
        if (!thread || thread.organizationId !== ctx.organizationId) {
          return { kind: "notFound" as const };
        }
        const isParticipant =
          thread.veteranId === ctx.userId || thread.coordinatorId === ctx.userId;
        if (!isParticipant) return { kind: "forbidden" as const };

        // Mark every message NOT sent by the viewer + still unread.
        const updated = await tx.message.updateMany({
          where: {
            threadId,
            senderId: { not: ctx.userId },
            readAt: null,
          },
          data: { readAt: new Date() },
        });
        return { kind: "ok" as const, count: updated.count };
      },
    );

    if (result.kind === "notFound") return NextResponse.json({ error: "not found" }, { status: 404 });
    if (result.kind === "forbidden") return NextResponse.json({ error: "not a participant" }, { status: 403 });
    return NextResponse.json({ ok: true, marked: result.count });
  },
  { rateLimit: "api.message" },
);
