/**
 * SSE stream for the clinical-lead escalation queue.
 *
 * Mirrors /api/coordinator/queue/stream but scoped by clinicalLead user id.
 */

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/security/api-auth";
import {
  subscribeToChannel,
  clinicalLeadChannel,
  type RealtimeEvent,
} from "@/lib/realtime/pubsub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withAuth(
  async (_req: NextRequest, ctx) => {
    if (ctx.role !== "CLINICAL_LEAD" && ctx.role !== "PROGRAM_MANAGER") {
      return new Response("forbidden", { status: 403 });
    }
    if (!ctx.organizationId) return new Response("no tenant", { status: 403 });
    const channel = clinicalLeadChannel(ctx.organizationId, ctx.userId);
    return openSseStream(channel);
  },
  { roles: ["CLINICAL_LEAD", "PROGRAM_MANAGER"] },
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
          controller.enqueue(encoder.encode(`event: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`));
        } catch { /* noop */ }
      });
      if (!handle) {
        controller.enqueue(encoder.encode(`event: degraded\ndata: {"reason":"realtime unavailable"}\n\n`));
      }
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keep-alive\n\n`));
        } catch { /* noop */ }
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
