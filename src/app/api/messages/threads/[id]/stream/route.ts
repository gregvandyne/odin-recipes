/**
 * SSE stream for live message delivery in a single thread.
 *
 * GET /api/messages/threads/[id]/stream
 *
 * Subscribes to a per-thread Redis pubsub channel. /api/messages POST
 * publishes `message.created` events with the new message id; the client
 * thread component refetches (or applies the optimistic event payload)
 * when an event arrives.
 *
 * Same patterns as the coordinator/clinical streams — auto-fallback to
 * polling on the client when Redis isn't reachable.
 */

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/security/api-auth";
import { subscribeToChannel, type RealtimeEvent } from "@/lib/realtime/pubsub";
import { withTenant } from "@/lib/db/tenant-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function threadChannel(organizationId: string, threadId: string): string {
  return `sentinel:thread:${organizationId}:${threadId}`;
}

export const GET = withAuth(
  async (req: NextRequest, ctx) => {
    if (!ctx.organizationId) return new Response("no tenant", { status: 403 });
    const threadId = new URL(req.url).pathname.split("/").filter(Boolean).at(-2);
    if (!threadId) return new Response("missing id", { status: 400 });

    // Authorize: viewer must be a thread participant.
    const allowed = await withTenant(
      { organizationId: ctx.organizationId, userId: ctx.userId, userRole: ctx.role, isOrgAdmin: ctx.isOrgAdmin },
      async (tx) => {
        const t = await tx.messageThread.findUnique({
          where: { id: threadId },
          select: { veteranId: true, coordinatorId: true, organizationId: true },
        });
        if (!t || t.organizationId !== ctx.organizationId) return false;
        return t.veteranId === ctx.userId || t.coordinatorId === ctx.userId;
      },
    );
    if (!allowed) return new Response("forbidden", { status: 403 });

    const channel = threadChannel(ctx.organizationId, threadId);
    return openSseStream(channel);
  },
  { roles: ["VETERAN", "COORDINATOR", "PROGRAM_MANAGER"] },
);

function openSseStream(channel: string): Response {
  const encoder = new TextEncoder();
  let handle: { close: () => Promise<void> } | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`event: ready\ndata: {"ok":true}\n\n`));
      handle = subscribeToChannel(channel, (event: RealtimeEvent) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`),
          );
        } catch {
          /* noop */
        }
      });
      if (!handle) {
        controller.enqueue(
          encoder.encode(`event: degraded\ndata: {"reason":"realtime unavailable"}\n\n`),
        );
      }
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keep-alive\n\n`));
        } catch {
          /* noop */
        }
      }, 25_000);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      void handle?.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
