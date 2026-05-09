import { TriageQueueItem } from "@/components/sentinel/triage-queue-item";
import type { RiskLevel } from "@/lib/risk/types";

interface QueueItem {
  veteranId: string;
  veteranName: string;
  weekNumber: number;
  riskLevel: RiskLevel;
  flagSummary: string;
  recommendedAction: string;
  flaggedAt: Date;
}

const RANK: Record<RiskLevel, number> = { RED: 3, ORANGE: 2, YELLOW: 1, GREEN: 0 };

const sampleQueue: QueueItem[] = [
  { veteranId: "demo-1", veteranName: "Sgt. M. Alvarez",  weekNumber: 9,  riskLevel: "RED",
    flagSummary: "Explicit risk language detected in open-ended response.",
    recommendedAction: "Immediate outreach. Crisis protocol guidance available.",
    flaggedAt: new Date(Date.now() - 25 * 60 * 1000) },
  { veteranId: "demo-2", veteranName: "PO2 J. Reed",      weekNumber: 4,  riskLevel: "ORANGE",
    flagSummary: "Sleep + Mood + Connection all degraded together this week.",
    recommendedAction: "Contact within 24 hours. Review timeline before reaching out.",
    flaggedAt: new Date(Date.now() - 4 * 60 * 60 * 1000) },
  { veteranId: "demo-3", veteranName: "SPC R. Park",      weekNumber: 12, riskLevel: "ORANGE",
    flagSummary: "2 consecutive missed check-ins after a YELLOW week.",
    recommendedAction: "Contact within 24 hours.",
    flaggedAt: new Date(Date.now() - 8 * 60 * 60 * 1000) },
  { veteranId: "demo-4", veteranName: "MSgt. T. Williams", weekNumber: 19, riskLevel: "YELLOW",
    flagSummary: "Finance score 78/100 — high absolute concern.",
    recommendedAction: "Contact within 48 hours. Consider VA financial counseling referral.",
    flaggedAt: new Date(Date.now() - 18 * 60 * 60 * 1000) },
  { veteranId: "demo-5", veteranName: "Cpl. D. Nguyen",   weekNumber: 22, riskLevel: "YELLOW",
    flagSummary: "Mood worsened by 22 points vs. last 4 weeks.",
    recommendedAction: "Contact within 48 hours.",
    flaggedAt: new Date(Date.now() - 28 * 60 * 60 * 1000) },
];

export default function CoordinatorQueue() {
  const sorted = [...sampleQueue].sort((a, b) => {
    const r = RANK[b.riskLevel] - RANK[a.riskLevel];
    return r !== 0 ? r : a.flaggedAt.getTime() - b.flaggedAt.getTime();
  });

  const totals = sorted.reduce(
    (acc, q) => ((acc[q.riskLevel] += 1), acc),
    { RED: 0, ORANGE: 0, YELLOW: 0, GREEN: 0 } as Record<RiskLevel, number>,
  );

  return (
    <div className="px-6 py-6">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-caption uppercase tracking-wide text-ink-tertiary">Triage</p>
          <h1 className="mt-1 text-display font-semibold text-ink-primary">Today's queue</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <Pill tone="red"    count={totals.RED}    label="Immediate" />
          <Pill tone="orange" count={totals.ORANGE} label="Outreach" />
          <Pill tone="yellow" count={totals.YELLOW} label="Watch" />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-canvas-card shadow-soft">
        {sorted.map((item, i) => (
          <TriageQueueItem key={item.veteranId} {...item} isFocused={i === 0} />
        ))}
      </div>

      <p className="mt-3 text-caption text-ink-tertiary">
        Use ⌘K to search · j/k to move · Enter to open
      </p>
    </div>
  );
}

function Pill({ tone, count, label }: { tone: "red" | "orange" | "yellow"; count: number; label: string }) {
  const cls =
    tone === "red"    ? "border-risk-red/30 bg-risk-red/5 text-risk-red" :
    tone === "orange" ? "border-risk-orange/30 bg-risk-orange/5 text-risk-orange" :
                        "border-risk-yellow/30 bg-risk-yellow/5 text-risk-yellow";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-caption font-semibold ${cls}`}>
      <span className="text-body-lg">{count}</span>
      <span className="opacity-80">{label}</span>
    </span>
  );
}
