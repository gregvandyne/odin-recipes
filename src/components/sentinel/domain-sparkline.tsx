import { cn } from "@/lib/utils";
import type { DomainCode } from "@/lib/risk/types";

/**
 * DomainSparkline — small inline trend visualization for one domain over time.
 * Used in the coordinator timeline view.
 *
 * Higher value = more concerning. We render it as a downward trend visually so
 * coordinators read "going up = getting worse" — orient the y-axis explicitly.
 */
interface Props {
  domain: DomainCode;
  /** Most recent first. 0–100. Null = missed/no data that week. */
  values: (number | null)[];
  width?: number;
  height?: number;
  className?: string;
}

const DOMAIN_LABEL: Record<DomainCode, string> = {
  SLEEP: "Sleep",
  MOOD: "Mood",
  CONNECTION: "Connection",
  PURPOSE: "Purpose",
  FINANCE: "Finance",
  SUBSTANCE: "Substance",
  PAIN: "Pain",
  RELATIONSHIP: "Relationship",
  HOUSING: "Housing",
};

export function DomainSparkline({
  domain,
  values,
  width = 120,
  height = 32,
  className,
}: Props) {
  // Reverse so chronologically left → right
  const chrono = [...values].reverse();
  const padding = 2;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const stepX = chrono.length > 1 ? innerW / (chrono.length - 1) : 0;

  const points = chrono
    .map((v, i) => (v === null ? null : { x: padding + i * stepX, y: padding + (1 - v / 100) * innerH, v }))
    .filter((p): p is { x: number; y: number; v: number } => p !== null);

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  // Color intensifies if last value is high
  const last = chrono[chrono.length - 1];
  const tone = last == null ? "text-ink-tertiary" : last >= 70 ? "text-risk-orange" : last >= 50 ? "text-risk-yellow" : "text-risk-green";

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="w-24 shrink-0 text-caption text-ink-secondary">
        {DOMAIN_LABEL[domain]}
      </span>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${DOMAIN_LABEL[domain]} trend over the last ${chrono.length} weeks`}
        className={tone}
      >
        {points.length > 1 && (
          <path
            d={path}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={i === points.length - 1 ? 2.5 : 1.5}
            fill="currentColor"
          />
        ))}
        {/* missed-week ticks */}
        {chrono.map((v, i) =>
          v === null ? (
            <line
              key={`miss-${i}`}
              x1={padding + i * stepX}
              x2={padding + i * stepX}
              y1={height - padding - 3}
              y2={height - padding}
              stroke="currentColor"
              strokeWidth={0.5}
              strokeOpacity={0.4}
            />
          ) : null,
        )}
      </svg>
      <span className="w-8 text-right text-caption text-ink-secondary">
        {last == null ? "–" : Math.round(last)}
      </span>
    </div>
  );
}
