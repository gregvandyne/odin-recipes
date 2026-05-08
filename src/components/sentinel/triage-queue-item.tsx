import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { RiskBadge } from "./risk-badge";
import type { RiskLevel } from "@/lib/risk/types";
import { formatDistanceToNow } from "date-fns";

/**
 * TriageQueueItem — coordinator queue row.
 * Linear-style dense, scannable, keyboard-friendly.
 * Critical state lives in the leftmost column (color band + icon).
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
}: Props) {
  return (
    <Link
      href={`/coordinator/veteran/${veteranId}`}
      className={cn(
        "group relative flex items-center gap-4 border-b border-border bg-canvas-card px-4 py-2.5 transition-colors hover:bg-canvas-banded",
        isFocused && "bg-canvas-banded",
      )}
      tabIndex={0}
    >
      <span
        aria-hidden
        className={cn("absolute left-0 top-0 h-full w-1", bandColor[riskLevel])}
      />
      <div className="ml-2 w-44 shrink-0">
        <div className="text-body font-semibold text-ink-primary">{veteranName}</div>
        <div className="text-caption text-ink-tertiary">Week {weekNumber}</div>
      </div>
      <div className="w-24 shrink-0">
        <RiskBadge level={riskLevel} size="sm" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-body text-ink-primary">{flagSummary}</div>
        <div className="truncate text-caption text-ink-secondary">{recommendedAction}</div>
      </div>
      <div className="w-24 shrink-0 text-right text-caption text-ink-tertiary">
        {formatDistanceToNow(flaggedAt, { addSuffix: true })}
      </div>
      <ChevronRight className="h-4 w-4 text-ink-tertiary group-hover:text-ink-primary" aria-hidden />
    </Link>
  );
}
