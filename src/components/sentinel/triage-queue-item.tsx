import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { RiskBadge } from "./risk-badge";
import type { RiskLevel } from "@/lib/risk/types";
import { formatDistanceToNow } from "date-fns";
import { SlaCountdown } from "./sla-countdown";

/**
 * TriageQueueItem — coordinator queue row.
 *
 * Two layouts driven by viewport:
 *   sm+ : dense single-line row with fixed-width columns (Linear-style).
 *   <sm : stacked card with name + risk badge on top, summary below, time +
 *         SLA on the bottom-right. Optimized for thumb-scrolling on a
 *         tablet or phone.
 *
 * Critical state is the leftmost color band on every viewport.
 */
interface Props {
  veteranId: string;
  veteranName: string;
  weekNumber: number;
  riskLevel: RiskLevel;
  flagSummary: string;
  recommendedAction: string;
  flaggedAt: Date;
  isFocused?: boolean;
  /** SLA budget in hours. Used to render the live countdown. */
  slaHours?: number;
  /** Acknowledged flags drop down in the queue but aren't hidden. */
  acknowledged?: boolean;
}

const bandColor: Record<RiskLevel, string> = {
  GREEN: "bg-risk-green",
  YELLOW: "bg-risk-yellow",
  ORANGE: "bg-risk-orange",
  RED: "bg-risk-red",
};

export function TriageQueueItem({
  veteranId,
  veteranName,
  weekNumber,
  riskLevel,
  flagSummary,
  recommendedAction,
  flaggedAt,
  isFocused,
  slaHours,
  acknowledged,
}: Props) {
  return (
    <Link
      href={`/coordinator/veteran/${veteranId}`}
      data-veteran-id={veteranId}
      data-queue-row="true"
      role="listitem"
      className={cn(
        "group relative flex flex-col gap-2 border-b border-border bg-canvas-card px-4 py-3 transition-colors hover:bg-canvas-banded focus-visible:bg-canvas-banded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        // sm+: single horizontal row.
        "sm:flex-row sm:items-center sm:gap-4 sm:py-2.5",
        isFocused && "bg-canvas-banded",
        acknowledged && "opacity-70",
      )}
      tabIndex={0}
    >
      <span aria-hidden className={cn("absolute left-0 top-0 h-full w-1", bandColor[riskLevel])} />

      {/* Top row on mobile — name + week + risk badge inline. */}
      <div className="ml-2 flex items-center gap-2 sm:w-44 sm:shrink-0 sm:flex-col sm:items-start sm:gap-0">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-body font-semibold text-ink-primary sm:flex-none">
          <span className="truncate">{veteranName}</span>
          {acknowledged && (
            <span
              className="rounded-full border border-border px-1.5 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-ink-tertiary"
              aria-label="Acknowledged"
            >
              Ack
            </span>
          )}
        </div>
        <div className="text-caption text-ink-tertiary sm:mt-0.5">Week {weekNumber}</div>
        <span className="ml-auto sm:hidden">
          <RiskBadge level={riskLevel} size="sm" />
        </span>
      </div>

      {/* Risk badge column — sm+ only (mobile shows it inline above). */}
      <div className="hidden w-24 shrink-0 sm:block">
        <RiskBadge level={riskLevel} size="sm" />
      </div>

      {/* Summary + recommended action. */}
      <div className="ml-2 min-w-0 flex-1 sm:ml-0">
        <div className="line-clamp-2 text-body text-ink-primary sm:truncate">{flagSummary}</div>
        <div className="line-clamp-1 text-caption text-ink-secondary">{recommendedAction}</div>
      </div>

      {/* Time + SLA — bottom-right on mobile, fixed column on desktop. */}
      <div className="ml-2 flex items-center justify-between gap-2 text-caption sm:ml-0 sm:w-32 sm:shrink-0 sm:flex-col sm:items-end sm:justify-start sm:gap-0">
        <div className="text-ink-tertiary">
          {formatDistanceToNow(flaggedAt, { addSuffix: true })}
        </div>
        {slaHours && <SlaCountdown flaggedAt={flaggedAt.toISOString()} slaHours={slaHours} />}
      </div>

      <ChevronRight
        className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary group-hover:text-ink-primary sm:static sm:translate-y-0"
        aria-hidden
      />
    </Link>
  );
}
