import { TriageQueueItem } from "@/components/sentinel/triage-queue-item";
import type { RiskLevel } from "@/lib/risk/types";
import { auth } from "@/lib/auth/config";
import { withTenant } from "@/lib/db/tenant-context";
import { redirect } from "next/navigation";
import { QueueLiveClient } from "./queue-live-client";

interface QueueItem {
  veteranId: string;
  veteranName: string;
  weekNumber: number;
  riskLevel: RiskLevel;
  flagSummary: string;
  recommendedAction: string;
  flaggedAt: Date;
  flagId: string;
  acknowledged: boolean;
}

const RANK: Record<RiskLevel, number> = { RED: 3, ORANGE: 2, YELLOW: 1, GREEN: 0 };

const SLA_HOURS_BY_LEVEL: Record<RiskLevel, number> = {
  RED: 1,
  ORANGE: 24,
  YELLOW: 48,
  GREEN: 168,
};

const ACTION_BY_LEVEL: Record<RiskLevel, string> = {
  RED: "Immediate outreach. Crisis protocol guidance available.",
  ORANGE: "Contact within 24 hours. Review timeline before reaching out.",
  YELLOW: "Contact within 48 hours. Acknowledge what they shared.",
  GREEN: "No action required.",
};

export default async function CoordinatorQueue() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const organizationId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!userId || !organizationId) redirect("/auth/sign-in");

  const isPM = role === "PROGRAM_MANAGER";

  const flags = await withTenant(
    { organizationId, userId, userRole: role ?? "COORDINATOR", isOrgAdmin: false },
    async (tx) => {
      // PM sees the whole queue; coordinators see only their assigned veterans.
      let veteranIdFilter: { veteranId: { in: string[] } } | undefined;
      if (!isPM) {
        const assigned = await tx.veteranProfile.findMany({
          where: { organizationId, assignedCoordinatorId: userId, status: "ACTIVE" },
          select: { userId: true },
        });
        if (assigned.length === 0) return [];
        veteranIdFilter = { veteranId: { in: assigned.map((v) => v.userId) } };
      }
      return tx.flag.findMany({
        where: {
          organizationId,
          resolvedAt: null,
          ...veteranIdFilter,
        },
        orderBy: [
          { acknowledgedAt: "asc" },
          { severity: "desc" },
          { createdAt: "asc" },
        ],
        take: 200,
        select: {
          id: true,
          veteranId: true,
          severity: true,
          explanation: true,
          createdAt: true,
          acknowledgedAt: true,
        },
      });
    },
  );

  // Hydrate veteran display info + week number outside the RLS scope (we
  // already filtered by organization above). Use a second RLS-scoped read.
  const veteranIds = [...new Set(flags.map((f) => f.veteranId))];
  const veterans = veteranIds.length === 0
    ? []
    : await withTenant(
        { organizationId, userId, userRole: role ?? "COORDINATOR", isOrgAdmin: false },
        async (tx) =>
          tx.veteranProfile.findMany({
            where: { userId: { in: veteranIds } },
            select: {
              userId: true,
              programStartDate: true,
              user: { select: { displayName: true, email: true } },
            },
          }),
      );

  const veteranById = new Map(veterans.map((v) => [v.userId, v]));

  const items: QueueItem[] = flags.map((f) => {
    const v = veteranById.get(f.veteranId);
    const weekNumber = v
      ? Math.max(
          1,
          Math.floor((Date.now() - v.programStartDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1,
        )
      : 0;
    return {
      veteranId: f.veteranId,
      veteranName: v?.user.displayName ?? v?.user.email ?? "Unknown",
      weekNumber,
      riskLevel: f.severity,
      flagSummary: f.explanation,
      recommendedAction: ACTION_BY_LEVEL[f.severity],
      flaggedAt: f.createdAt,
      flagId: f.id,
      acknowledged: !!f.acknowledgedAt,
    };
  });

  // Already ordered by SQL, but ensure stable client view.
  const sorted = items.slice().sort((a, b) => {
    if (a.acknowledged !== b.acknowledged) return a.acknowledged ? 1 : -1;
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
          <h1 className="mt-1 text-display font-semibold text-ink-primary">
            {isPM ? "All open flags" : "Your queue"}
          </h1>
        </div>
        <div className="flex items-center gap-1.5">
          <Pill tone="red" count={totals.RED} label="Immediate" />
          <Pill tone="orange" count={totals.ORANGE} label="Outreach" />
          <Pill tone="yellow" count={totals.YELLOW} label="Watch" />
        </div>
      </div>

      <QueueLiveClient />

      {sorted.length === 0 ? (
        <div className="rounded-lg border border-border bg-canvas-card p-8 text-center text-body text-ink-secondary">
          Nothing in your queue right now. Check back when a new flag arrives — this page will
          update live.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-canvas-card shadow-soft">
          {sorted.map((item, i) => (
            <TriageQueueItem
              key={item.flagId}
              veteranId={item.veteranId}
              veteranName={item.veteranName}
              weekNumber={item.weekNumber}
              riskLevel={item.riskLevel}
              flagSummary={item.flagSummary}
              recommendedAction={item.recommendedAction}
              flaggedAt={item.flaggedAt}
              isFocused={i === 0}
              slaHours={SLA_HOURS_BY_LEVEL[item.riskLevel]}
            />
          ))}
        </div>
      )}

      <p className="mt-3 text-caption text-ink-tertiary">
        Use ⌘K to search · j/k to move · Enter to open
      </p>
    </div>
  );
}

function Pill({ tone, count, label }: { tone: "red" | "orange" | "yellow"; count: number; label: string }) {
  const cls =
    tone === "red"
      ? "border-risk-red/30 bg-risk-red/5 text-risk-red"
      : tone === "orange"
      ? "border-risk-orange/30 bg-risk-orange/5 text-risk-orange"
      : "border-risk-yellow/30 bg-risk-yellow/5 text-risk-yellow";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-caption font-semibold ${cls}`}>
      <span className="text-body-lg">{count}</span>
      <span className="opacity-80">{label}</span>
    </span>
  );
}
