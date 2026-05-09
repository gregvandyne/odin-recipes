/**
 * POST /api/messages  — send a message in a thread.
 *
 * Authorization:
 *   - Veteran can only post in their own thread.
 *   - Coordinator can only post in threads where they are assigned.
 *   - Clinical Lead read access is granted only during active escalation; they
 *     do not post via this endpoint.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/tenant-context";
import { withAuth } from "@/lib/security/api-auth";
import { encryptField, messageAad } from "@/lib/security/encryption";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";

const Body = z.object({
  threadId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
  aiAssistedDraft: z.boolean().optional(),
  aiPromptVersion: z.string().optional(),
});

export const POST = withAuth(
  async (req, ctx) => {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
    }

    if (!ctx.organizationId) {
      return NextResponse.json({ error: "no tenant" }, { status: 403 });
    }

    const { threadId, body, aiAssistedDraft, aiPromptVersion } = parsed.data;

    const result = await withTenant(
      { organizationId: ctx.organizationId, userId: ctx.userId, userRole: ctx.role, isOrgAdmin: ctx.isOrgAdmin },
      async (tx) => {
        const thread = await tx.messageThread.findUnique({
          where: { id: threadId },
          select: { id: true, veteranId: true, coordinatorId: true, organizationId: true, status: true },
        });
        if (!thread || thread.organizationId !== ctx.organizationId) {
          return { status: 404, error: "thread not found" };
        }
        if (thread.status === "ARCHIVED") {
          return { status: 410, error: "thread archived" };
        }

        const senderRole =
          thread.veteranId === ctx.userId ? "VETERAN" :
          thread.coordinatorId === ctx.userId ? "COORDINATOR" : null;
        if (!senderRole) return { status: 403, error: "not a participant" };

        // Coordinators cannot use the AI-draft flag without the corresponding role.
        if (aiAssistedDraft && senderRole !== "COORDINATOR") {
          return { status: 400, error: "ai-assisted only for coordinator messages" };
        }

        // Reserve an id so we can bind it into the AAD before encrypting.
        const messageId = crypto.randomUUID();
        const aad = messageAad(ctx.organizationId!, threadId, messageId);
        const cipher = encryptField(body, aad);

        const created = await tx.message.create({
          data: {
            id: messageId,
            organizationId: ctx.organizationId!,
            threadId,
            senderId: ctx.userId,
            senderRole,
            bodyEncrypted: cipher,
            aiAssistedDraft: !!aiAssistedDraft,
            aiPromptVersion: aiPromptVersion ?? null,
          },
        });

        await tx.messageThread.update({
          where: { id: threadId },
          data: { lastMessageAt: created.sentAt },
        });

        await logAudit(
          {
            organizationId: ctx.organizationId,
            actorId: ctx.userId,
            actorRole: ctx.role,
            action: AUDIT_ACTIONS.MESSAGE_SEND,
            resourceType: "Message",
            resourceId: messageId,
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
            metadata: { threadId, aiAssistedDraft: !!aiAssistedDraft },
          },
          tx,
        );

        return { status: 201, messageId, sentAt: created.sentAt.toISOString() };
      },
    );

    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result, { status: 201 });
  },
  { rateLimit: "api.message" },
);
