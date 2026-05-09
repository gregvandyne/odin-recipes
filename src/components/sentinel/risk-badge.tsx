import { cn } from "@/lib/utils";
import { AlertCircle, AlertTriangle, CheckCircle, Circle } from "lucide-react";
import type { RiskLevel } from "@/lib/risk/types";

/**
 * Risk badge — coordinator-side ONLY. Never visible to veterans.
 *
 * Color is paired with text and icon. Color is never the sole indicator (a11y).
 * Optional `pulse` adds a subtle ring on RED only — honors prefers-reduced-motion.
 */
const config: Record<
  RiskLevel,
  { label: string; classes: string; Icon: typeof Circle; ariaLabel: string }
> = {
  GREEN: {
    label: "Stable",
    classes: "bg-risk-green/10 text-risk-green border-risk-green/30",
    Icon: CheckCircle,
    ariaLabel: "Risk level: stable",
  },
  YELLOW: {
    label: "Watch",
    classes: "bg-risk-yellow/10 text-risk-yellow border-risk-yellow/30",
    Icon: Circle,
    ariaLabel: "Risk level: watch",
  },
  ORANGE: {
    label: "Outreach",
    classes: "bg-risk-orange/10 text-risk-orange border-risk-orange/30",
    Icon: AlertTriangle,
    ariaLabel: "Risk level: outreach within 24 hours",
  },
  RED: {
    label: "Immediate",
    classes: "bg-risk-red/10 text-risk-red border-risk-red/30",
    Icon: AlertCircle,
    ariaLabel: "Risk level: immediate action required",
  },
};

export function RiskBadge({
  level,
  size = "default",
  className,
}: {
  level: RiskLevel;
  size?: "sm" | "default";
  className?: string;
}) {
  const { label, classes, Icon, ariaLabel } = config[level];
  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1.5 rounded border font-semibold",
        size === "sm" ? "px-2 py-0.5 text-caption" : "px-2.5 py-1 text-caption",
        classes,
        className,
      )}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />
      {label}
    </span>
  );
}
