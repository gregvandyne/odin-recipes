"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Live SLA countdown.
 *
 * The triage queue is a server component, so this client child re-renders
 * locally on a tick to keep the countdown current — no full page refresh.
 * Updates every 30 seconds (well below the smallest SLA bucket the engine
 * produces, but fine-grained enough that a coordinator watching the queue
 * sees the time-left value tick down).
 *
 * Tone shifts:
 *   - ok        : > 25% of the SLA window remaining
 *   - warning   : ≤ 25% remaining
 *   - breached  : remainingMs < 0
 */
export function SlaCountdown({
  flaggedAt,
  slaHours,
  className,
}: {
  flaggedAt: string;
  slaHours: number;
  className?: string;
}) {
  const flaggedAtMs = React.useMemo(() => new Date(flaggedAt).getTime(), [flaggedAt]);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const info = computeSla(flaggedAtMs, slaHours, now);
  const live = info.tone === "warning" || info.tone === "breached";

  return (
    <div
      role={live ? "status" : undefined}
      aria-live={live ? "polite" : undefined}
      className={cn(
        "mt-0.5 font-semibold tabular-nums",
        info.tone === "breached"
          ? "text-risk-red"
          : info.tone === "warning"
          ? "text-risk-orange"
          : "text-ink-secondary",
        className,
      )}
    >
      {info.label}
    </div>
  );
}

interface SlaInfo {
  label: string;
  tone: "ok" | "warning" | "breached";
}

function computeSla(flaggedAtMs: number, slaHours: number, nowMs: number): SlaInfo {
  const deadline = flaggedAtMs + slaHours * 60 * 60 * 1000;
  const remainingMs = deadline - nowMs;
  if (remainingMs < 0) {
    const hoursOver = Math.floor(-remainingMs / (60 * 60 * 1000));
    return { label: hoursOver > 0 ? `${hoursOver}h overdue` : "SLA breached", tone: "breached" };
  }
  const hours = remainingMs / (60 * 60 * 1000);
  const warning = hours < slaHours * 0.25;
  const tone: "ok" | "warning" = warning ? "warning" : "ok";
  if (hours < 1) {
    const minutes = Math.max(1, Math.round(remainingMs / 60_000));
    return { label: `${minutes}m left`, tone };
  }
  if (hours < 24) {
    return { label: `${Math.round(hours)}h left`, tone };
  }
  return { label: `${Math.round(hours / 24)}d left`, tone };
}
