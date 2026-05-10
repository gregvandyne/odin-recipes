/**
 * Redis pub/sub helper for per-tenant real-time broadcast.
 *
 * Channels:
 *   sentinel:queue:{organizationId}:{coordinatorId}    — new flag arrivals
 *   sentinel:clinical:{organizationId}:{leadUserId}    — new escalations
 *
 * Publishers (notification worker, escalations route) call `publishEvent`.
 * Subscribers (the SSE route handlers) call `subscribeToChannel` and stream
 * the messages over to the browser.
 *
 * Each subscriber gets its own ioredis connection — ioredis enforces that
 * a connection in subscribe mode can only execute SUBSCRIBE/UNSUBSCRIBE
 * commands.
 */

import IORedis, { type Redis } from "ioredis";
import { logger } from "@/lib/logging/log";

export interface RealtimeEvent {
  kind:
    | "flag.created"
    | "flag.acknowledged"
    | "flag.resolved"
    | "escalation.created"
    | "escalation.transitioned"
    | "message.created"
    | "message.read";
  organizationId: string;
  payload: Record<string, unknown>;
  emittedAt: string;
}

let publisher: Redis | null = null;

function publisherClient(): Redis | null {
  if (publisher) return publisher;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  publisher = new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  publisher.on("error", (err) => {
    logger.warn({ err: err.message, component: "realtime.publisher" }, "redis publisher error");
  });
  return publisher;
}

export function coordinatorQueueChannel(organizationId: string, coordinatorId: string): string {
  return `sentinel:queue:${organizationId}:${coordinatorId}`;
}

export function clinicalLeadChannel(organizationId: string, userId: string): string {
  return `sentinel:clinical:${organizationId}:${userId}`;
}

/**
 * Publish a real-time event to a channel. Returns the number of subscribers
 * that received the message; 0 means nobody had the queue open.
 *
 * Fail-open: if Redis is unavailable we log and return 0. Real-time delivery
 * is a UX nicety — email + push are the durable paths.
 */
export async function publishEvent(channel: string, event: RealtimeEvent): Promise<number> {
  const client = publisherClient();
  if (!client) return 0;
  try {
    return await client.publish(channel, JSON.stringify(event));
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err), channel },
      "publishEvent failed",
    );
    return 0;
  }
}

/**
 * Open a dedicated subscriber connection for a single channel. Returns a
 * close handle. Caller must call `close()` to free the connection (e.g. when
 * the SSE stream disconnects).
 */
export function subscribeToChannel(
  channel: string,
  onMessage: (event: RealtimeEvent) => void,
): { close: () => Promise<void> } | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  const sub = new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  sub.subscribe(channel).catch((err) => {
    logger.warn({ err: err?.message, channel }, "redis subscribe failed");
  });

  sub.on("message", (ch, payload) => {
    if (ch !== channel) return;
    try {
      const parsed = JSON.parse(payload) as RealtimeEvent;
      onMessage(parsed);
    } catch (err) {
      logger.warn({ err: err instanceof Error ? err.message : String(err) }, "subscriber parse failed");
    }
  });

  return {
    close: async () => {
      try {
        await sub.unsubscribe(channel);
      } catch {
        /* noop */
      }
      sub.disconnect();
    },
  };
}
