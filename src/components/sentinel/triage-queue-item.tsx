import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { RiskBadge } from "./risk-badge";
import type { RiskLevel } from "@/lib/risk/types";
import { formatDistanceToNow } from "date-fns";
import { SlaCountdown } from "./sla-countdown";

/**
 * TriageQueueItem — coordinator queue row.
 * Linear-style dense, scannable, keyboard-friendly.
 * Critical state lives in the leftmost column (color band).
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
      className={cn(
        "group relative flex items-center gap-4 border-b border-border bg-canvas-card px-4 py-2.5 transition-colors hover:bg-canvas-banded focus-visible:bg-canvas-banded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        isFocused && "bg-canvas-banded",
        acknowledged && "opacity-70",
      )}
      tabIndex={0}
    >
      <span aria-hidden className={cn("absolute left-0 top-0 h-full w-1", bandColor[riskLevel])} />
      <div className="ml-2 w-44 shrink-0">
        <div className="flex items-center gap-1.5 text-body font-semibold text-ink-primary">
          {veteranName}
          {acknowledged && (
            <span
              className="rounded-full border border-border px-1.5 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-ink-tertiary"
              aria-label="Acknowledged"
            >
              Ack
            </span>
          )}
        </div>
        <div className="text-caption text-ink-tertiary">Week {weekNumber}</div>
      </div>
      <div className="w-24 shrink-0">
        <RiskBadge level={riskLevel} size="sm" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-body text-ink-primary">{flagSummary}</div>
        <div className="truncate text-caption text-ink-secondary">{recommendedAction}</div>
      </div>
      <div className="w-32 shrink-0 text-right text-caption">
        <div className="text-ink-tertiary">
          {formatDistanceToNow(flaggedAt, { addSuffix: true })}
        </div>
        {slaHours && <SlaCountdown flaggedAt={flaggedAt.toISOString()} slaHours={slaHours} />}
      </div>
      <ChevronRight
        className="h-4 w-4 text-ink-tertiary group-hover:text-ink-primary"
        aria-hidden
      />
    </Link>
  );
}
