/**
 * POST /api/messages/draft — coordinator-only AI-assisted draft generation.
 *
 * Returns a draft for the coordinator to review and edit. Never sends.
 * Heavily rate-limited (cost cap + abuse prevention).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/security/api-auth";
import { prisma } from "@/lib/db/prisma";
import { draftCoordinatorReply } from "@/lib/ai/client";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";

const Body = z.object({
  threadId: z.string().uuid(),
  intent: z.string().trim().min(1).max(500),
});

export const POST = withAuth(
  async (req, ctx) => {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
    if (!ctx.organizationId) return NextResponse.json({ error: "no tenant" }, { status: 403 });

    const thread = await prisma.messageThread.findUnique({
      where: { id: parsed.data.threadId },
      select: { coordinatorId: true, veteranId: true, organizationId: true, veteran: { select: { displayName: true } } },
    });
    if (!thread || thread.organizationId !== ctx.organizationId) {
      return NextResponse.json({ error: "thread not found" }, { status: 404 });
    }
    if (thread.coordinatorId !== ctx.userId) {
      return NextResponse.json({ error: "not the assigned coordinator" }, { status: 403 });
    }

    // In production, hydrate context from recent messages + check-ins. The AI
    // client redacts PII before sending.
    const context = "Recent context unavailable in this demo path — production pulls last 4 weeks of check-ins and last 10 messages.";

    const { draft, log } = await draftCoordinatorReply({
      organizationId: ctx.organizationId,
      veteranId: thread.veteranId,
      veteranDisplayName: thread.veteran.displayName,
      coordinatorIntent: parsed.data.intent,
      context,
    });

    await logAudit({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      actorRole: ctx.role,
      action: AUDIT_ACTIONS.AI_CALL,
      resourceType: "MessageDraft",
      resourceId: parsed.data.threadId,
      metadata: {
        promptVersion: log.promptVersion,
        model: log.model,
        inputTokens: log.inputTokens,
        outputTokens: log.outputTokens,
        latencyMs: log.latencyMs,
      },
    });

    return NextResponse.json({ draft, promptVersion: log.promptVersion });
  },
  { roles: ["COORDINATOR"], rateLimit: "api.draft" },
);
