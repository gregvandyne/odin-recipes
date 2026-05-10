"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

/**
 * Live queue client.
 *   1. Subscribes to /api/coordinator/queue/stream (SSE) and refreshes the
 *      server component on flag.created / flag.acknowledged / flag.resolved.
 *      Falls back to a 30s poll on disconnect.
 *   2. Wires keyboard nav for the rendered TriageQueueItem rows: j/↓ moves
 *      focus down, k/↑ up, Enter opens, ? toggles a small help panel.
 *
 * Status is shown as a small dot with an accessible label.
 */

type Status = "connecting" | "live" | "polling" | "degraded";

const STATUS_DOT: Record<Status, string> = {
  connecting: "bg-ink-tertiary animate-pulse",
  live: "bg-risk-green",
  polling: "bg-risk-yellow",
  degraded: "bg-ink-tertiary",
};

const STATUS_LABEL: Record<Status, string> = {
  connecting: "Connecting…",
  live: "Live",
  polling: "Updating every 30s",
  degraded: "Real-time unavailable",
};

const STATUS_HINT: Record<Status, string> = {
  connecting: "Setting up real-time updates.",
  live: "New flags arrive instantly.",
  polling:
    "We couldn't open a real-time connection. The queue refreshes every 30 seconds instead.",
  degraded: "Real-time updates aren't configured. Refresh manually for now.",
};

export function QueueLiveClient() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("connecting");
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    function startPolling(reason: "fallback" | "degraded") {
      if (pollTimer) return;
      setStatus(reason === "degraded" ? "degraded" : "polling");
      pollTimer = setInterval(() => {
        router.refresh();
      }, 30_000);
    }

    try {
      es = new EventSource("/api/coordinator/queue/stream");
      es.addEventListener("ready", () => setStatus("live"));
      es.addEventListener("degraded", () => startPolling("degraded"));
      es.addEventListener("flag.created", () => {
        toast.message("New flag arrived");
        router.refresh();
      });
      es.addEventListener("flag.acknowledged", () => router.refresh());
      es.addEventListener("flag.resolved", () => router.refresh());
      es.onerror = () => {
        es?.close();
        es = null;
        startPolling("fallback");
      };
    } catch {
      startPolling("fallback");
    }

    return () => {
      es?.close();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [router]);

  useEffect(() => {
    function rows(): HTMLAnchorElement[] {
      return Array.from(
        document.querySelectorAll<HTMLAnchorElement>('a[data-queue-row="true"]'),
      );
    }
    function focusedIdx(list: HTMLAnchorElement[]): number {
      return list.findIndex((el) => el === document.activeElement);
    }
    function move(delta: number) {
      const list = rows();
      if (list.length === 0) return;
      const cur = focusedIdx(list);
      const next = cur === -1 ? 0 : Math.max(0, Math.min(list.length - 1, cur + delta));
      list[next]?.focus();
    }

    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable) {
          return;
        }
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        move(1);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        move(-1);
      } else if (e.key === "Enter") {
        const list = rows();
        const idx = focusedIdx(list);
        if (idx >= 0) list[idx]?.click();
      } else if (e.key === "?" || e.key === "/") {
        e.preventDefault();
        setHelpOpen((s) => !s);
      } else if (e.key === "Escape") {
        setHelpOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <div className="mb-3 flex items-center gap-2 text-caption">
        <span
          className={cn("inline-block h-2 w-2 rounded-full", STATUS_DOT[status])}
          aria-hidden
        />
        <span className="text-ink-secondary">
          <span className="font-semibold">{STATUS_LABEL[status]}</span>
          <span className="ml-1.5 text-ink-tertiary">{STATUS_HINT[status]}</span>
        </span>
        <button
          type="button"
          onClick={() => setHelpOpen((s) => !s)}
          className="ml-auto rounded px-2 py-1 text-ink-tertiary underline-offset-4 hover:text-ink-secondary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={helpOpen}
        >
          ⌘ Shortcuts
        </button>
      </div>
      {helpOpen && (
        <div
          role="region"
          aria-label="Keyboard shortcuts"
          className="mb-3 rounded-lg border border-border bg-canvas-card p-4"
        >
          <ul className="grid grid-cols-2 gap-2 text-caption text-ink-secondary sm:grid-cols-4">
            <Shortcut keys={["j", "↓"]} label="Next row" />
            <Shortcut keys={["k", "↑"]} label="Previous row" />
            <Shortcut keys={["Enter"]} label="Open" />
            <Shortcut keys={["?"]} label="Toggle this help" />
          </ul>
        </div>
      )}
    </>
  );
}

function Shortcut({ keys, label }: { keys: string[]; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className="flex gap-1">
        {keys.map((k) => (
          <kbd
            key={k}
            className="inline-flex min-w-[1.5rem] items-center justify-center rounded border border-border bg-canvas-banded px-1.5 py-0.5 font-mono text-[0.6875rem] text-ink-primary"
          >
            {k}
          </kbd>
        ))}
      </span>
      <span>{label}</span>
    </li>
  );
}
