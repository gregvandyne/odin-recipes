/**
 * Server-Sent Events stream for the live coordinator triage queue.
 *
 * The coordinator's open queue page subscribes here. The notification fan-out
 * worker publishes flag-arrival events to a per-coordinator Redis pubsub
 * channel. We forward those events as SSE messages.
 *
 * On disconnect (browser tab closed, network drop, navigation), the stream
 * is closed and the Redis subscriber connection is torn down.
 *
 * Falls back to a polite "subscription unavailable" message if Redis isn't
 * configured — the page falls back to polling.
 */

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/security/api-auth";
import {
  subscribeToChannel,
  coordinatorQueueChannel,
  type RealtimeEvent,
} from "@/lib/realtime/pubsub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withAuth(
  async (_req: NextRequest, ctx) => {
    if (ctx.role !== "COORDINATOR" && ctx.role !== "PROGRAM_MANAGER") {
      return new Response("forbidden", { status: 403 });
    }
    if (!ctx.organizationId) {
      return new Response("no tenant", { status: 403 });
    }
    const channel = coordinatorQueueChannel(ctx.organizationId, ctx.userId);
    return openSseStream(channel);
  },
  { roles: ["COORDINATOR", "PROGRAM_MANAGER"] },
);

function openSseStream(channel: string): Response {
  const encoder = new TextEncoder();

  let handle: { close: () => Promise<void> } | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Initial frame so EventSource fires `onopen` and clients know they're
      // connected.
      controller.enqueue(encoder.encode(`event: ready\ndata: {"ok":true}\n\n`));

      handle = subscribeToChannel(channel, (event: RealtimeEvent) => {
        const payload = `event: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Stream closed before write — ignore.
        }
      });

      if (!handle) {
        // Redis not configured. Send a heartbeat-only stream so the client
        // sees a healthy connection but no real-time updates. Falls back to
        // 30s polling on the client.
        controller.enqueue(
          encoder.encode(`event: degraded\ndata: {"reason":"realtime unavailable"}\n\n`),
        );
      }

      // 25s heartbeat to keep proxies + load balancers from killing the
      // connection. SSE comments are ignored by the browser.
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
      "X-Accel-Buffering": "no", // disable nginx buffering when proxied
    },
  });
}
