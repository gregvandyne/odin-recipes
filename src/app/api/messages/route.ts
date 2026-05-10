/**
 * POST /api/messages  — send a message in a thread.
 *
 * Authorization:
 *   - Veteran can only post in their own thread.
 *   - Coordinator can only post in threads where they are assigned.
 *   - Clinical Lead read access is granted only during active escalation; they
 *     do not post via this endpoint.
 *
 * Idempotent: clients may send `Idempotency-Key`. A retry with the same body
 * replays the prior response instead of creating a duplicate Message row.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/db/tenant-context";
import { withAuth } from "@/lib/security/api-auth";
import { encryptField, messageAad } from "@/lib/security/encryption";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";
import { withIdempotency } from "@/lib/idempotency/with-idempotency";
import { publishEvent } from "@/lib/realtime/pubsub";

const Body = z.object({
  threadId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
  aiAssistedDraft: z.boolean().optional(),
  aiPromptVersion: z.string().optional(),
});

export const POST = withAuth(
  async (req, ctx) => {
    if (!ctx.organizationId) {
      return NextResponse.json({ error: "no tenant" }, { status: 403 });
    }
    const organizationId = ctx.organizationId;

    return withIdempotency(req, ctx, "/api/messages", async (bodyText) => {
      let parsed: z.infer<typeof Body>;
      try {
        parsed = Body.parse(JSON.parse(bodyText));
      } catch (err) {
        const issues = err instanceof z.ZodError ? err.issues : undefined;
        return { status: 400, payload: { error: "invalid body", issues }, skipCache: true };
      }
      const { threadId, body, aiAssistedDraft, aiPromptVersion } = parsed;

      const result = await withTenant(
        { organizationId, userId: ctx.userId, userRole: ctx.role, isOrgAdmin: ctx.isOrgAdmin },
        async (tx) => {
          const thread = await tx.messageThread.findUnique({
            where: { id: threadId },
            select: { id: true, veteranId: true, coordinatorId: true, organizationId: true, status: true },
          });
          if (!thread || thread.organizationId !== organizationId) {
            return { kind: "notFound" as const };
          }
          if (thread.status === "ARCHIVED") return { kind: "archived" as const };

          const senderRole =
            thread.veteranId === ctx.userId ? "VETERAN" :
            thread.coordinatorId === ctx.userId ? "COORDINATOR" : null;
          if (!senderRole) return { kind: "forbidden" as const };

          if (aiAssistedDraft && senderRole !== "COORDINATOR") {
            return { kind: "badAiFlag" as const };
          }

          const messageId = crypto.randomUUID();
          const aad = messageAad(organizationId, threadId, messageId);
          const cipher = encryptField(body, aad);

          const created = await tx.message.create({
            data: {
              id: messageId,
              organizationId,
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
              organizationId,
              actorId: ctx.userId,
              actorRole: ctx.role,
              action: AUDIT_ACTIONS.MESSAGE_SEND,
              resourceType: "Message",
              resourceId: messageId,
              ipAddress: ctx.ipAddress,
              userAgent: ctx.userAgent,
              correlationId: ctx.correlationId,
              metadata: { threadId, aiAssistedDraft: !!aiAssistedDraft },
            },
            tx,
          );

          return {
            kind: "ok" as const,
            messageId,
            sentAt: created.sentAt.toISOString(),
          };
        },
      );

      switch (result.kind) {
        case "notFound": return { status: 404, payload: { error: "thread not found" }, skipCache: true };
        case "archived": return { status: 410, payload: { error: "thread archived" }, skipCache: true };
        case "forbidden": return { status: 403, payload: { error: "not a participant" }, skipCache: true };
        case "badAiFlag": return { status: 400, payload: { error: "ai-assisted only for coordinator messages" }, skipCache: true };
        case "ok": {
          // Publish a realtime event so the other participant's open thread
          // refreshes without polling. Best-effort — durability is the DB
          // row itself.
          void publishEvent(`sentinel:thread:${organizationId}:${threadId}`, {
            kind: "message.created",
            organizationId,
            payload: {
              messageId: result.messageId,
              threadId,
              senderId: ctx.userId,
              sentAt: result.sentAt,
            },
            emittedAt: new Date().toISOString(),
          });
          return { status: 201, payload: { messageId: result.messageId, sentAt: result.sentAt } };
        }
      }
    });
  },
  { rateLimit: "api.message" },
);
