"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Live queue subscriber.
 *
 * Subscribes to /api/coordinator/queue/stream via EventSource. When a
 * `flag.created` event arrives, calls `router.refresh()` so the server
 * component re-renders with the new flag prepended.
 *
 * Falls back to a 30s polling refresh if SSE drops or the server reports
 * `degraded` (Redis unavailable).
 */
export function QueueLiveClient() {
  const router = useRouter();
  const [status, setStatus] = useState<"connecting" | "live" | "polling">("connecting");

  useEffect(() => {
    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    function startPolling() {
      if (pollTimer) return;
      setStatus("polling");
      pollTimer = setInterval(() => {
        router.refresh();
      }, 30_000);
    }

    try {
      es = new EventSource("/api/coordinator/queue/stream");
      es.addEventListener("ready", () => setStatus("live"));
      es.addEventListener("degraded", () => startPolling());
      es.addEventListener("flag.created", () => router.refresh());
      es.addEventListener("flag.acknowledged", () => router.refresh());
      es.addEventListener("flag.resolved", () => router.refresh());
      es.onerror = () => {
        es?.close();
        es = null;
        startPolling();
      };
    } catch {
      startPolling();
    }

    return () => {
      es?.close();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [router]);

  return (
    <p className="mb-2 text-caption text-ink-tertiary" aria-live="polite">
      {status === "connecting" && "Connecting…"}
      {status === "live" && "Live"}
      {status === "polling" && "Polling every 30s"}
    </p>
  );
}
