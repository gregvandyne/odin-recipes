import { DomainSparkline } from "@/components/sentinel/domain-sparkline";
import type { DomainCode } from "@/lib/risk/types";

/**
 * Veteran's own trends. Transparent — they see what we see (minus the
 * coordinator-side risk badge / flag colors).
 */
const sample: { domain: DomainCode; values: (number | null)[] }[] = [
  { domain: "SLEEP",        values: [40, 50, 35, 45, 30, 35, 25] },
  { domain: "MOOD",         values: [50, 45, 50, 55, 60, 55, 50] },
  { domain: "CONNECTION",   values: [70, 60, 55, 60, 50, 45, 40] },
  { domain: "PURPOSE",      values: [40, 40, 50, 45, 50, 40, 45] },
  { domain: "FINANCE",      values: [60, 55, 50, 55, 50, 50, 45] },
  { domain: "SUBSTANCE",    values: [10, 10, 15, 10, 10, 15, 10] },
  { domain: "PAIN",         values: [30, 25, 30, 35, 30, 30, 25] },
  { domain: "RELATIONSHIP", values: [40, 35, 30, 35, 40, 30, 30] },
  { domain: "HOUSING",      values: [10, 10, 10, 10, 10, 10, 10] },
];

export default function VeteranTrends() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-caption text-ink-tertiary">Your trends</p>
        <h1 className="mt-1 text-heading font-semibold text-ink-primary">
          The last 7 weeks
        </h1>
        <p className="mt-2 text-body text-ink-secondary">
          This is what you see, and what your coordinator sees. Lower lines are calmer weeks.
        </p>
      </header>

      <div className="rounded-lg border border-border bg-canvas-card p-6 space-y-3">
        {sample.map((row) => (
          <DomainSparkline key={row.domain} domain={row.domain} values={row.values} />
        ))}
      </div>
    </div>
  );
}
