import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { auth } from "@/lib/auth/config";
import { withTenant } from "@/lib/db/tenant-context";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RiskBadge } from "@/components/sentinel/risk-badge";
import type { RiskLevel } from "@/lib/risk/types";

/**
 * Coordinator caseload — every veteran they're assigned to, ordered by
 * (current top severity, week ascending). Surfaces the most pressing
 * cases first without hiding the calm ones.
 *
 * Each row shows the veteran's name, week, current top-flag severity, and
 * last check-in time. Tapping a row opens the per-veteran timeline.
 */
const RANK: Record<RiskLevel, number> = { RED: 3, ORANGE: 2, YELLOW: 1, GREEN: 0 };

export default async function CoordinatorCaseload() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const organizationId = (session?.user as { organizationId?: string } | undefined)
    ?.organizationId;
  const role = (session?.user as { role?: string } | undefined)?.role ?? "COORDINATOR";
  if (!userId || !organizationId) redirect("/auth/sign-in");

  const isPM = role === "PROGRAM_MANAGER";

  const data = await withTenant(
    { organizationId, userId, userRole: role, isOrgAdmin: false },
    async (tx) => {
      const profiles = await tx.veteranProfile.findMany({
        where: {
          organizationId,
          ...(isPM ? {} : { assignedCoordinatorId: userId }),
          status: "ACTIVE",
        },
        select: {
          userId: true,
          programStartDate: true,
          user: { select: { displayName: true, email: true } },
        },
      });
      const userIds = profiles.map((p) => p.userId);
      const [topFlags, lastCheckIns] = await Promise.all([
        userIds.length
          ? tx.flag.findMany({
              where: { veteranId: { in: userIds }, resolvedAt: null },
              orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
              select: { veteranId: true, severity: true, createdAt: true },
            })
          : [],
        userIds.length
          ? tx.checkIn.findMany({
              where: { veteranId: { in: userIds } },
              orderBy: { submittedAt: "desc" },
              select: { veteranId: true, submittedAt: true, riskLevel: true },
            })
          : [],
      ]);
      const topByVet = new Map<string, { severity: RiskLevel; at: Date }>();
      for (const f of topFlags) {
        if (topByVet.has(f.veteranId)) continue;
        topByVet.set(f.veteranId, { severity: f.severity as RiskLevel, at: f.createdAt });
      }
      const lastByVet = new Map<string, { at: Date; level: RiskLevel | null }>();
      for (const c of lastCheckIns) {
        if (lastByVet.has(c.veteranId)) continue;
        lastByVet.set(c.veteranId, { at: c.submittedAt, level: c.riskLevel as RiskLevel | null });
      }
      return profiles.map((p) => ({
        veteranId: p.userId,
        name: p.user.displayName ?? p.user.email,
        week: Math.max(
          1,
          Math.floor((Date.now() - p.programStartDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1,
        ),
        top: topByVet.get(p.userId) ?? null,
        last: lastByVet.get(p.userId) ?? null,
      }));
    },
  );

  const sorted = data.slice().sort((a, b) => {
    const aRank = a.top ? RANK[a.top.severity] : -1;
    const bRank = b.top ? RANK[b.top.severity] : -1;
    if (aRank !== bRank) return bRank - aRank;
    return a.week - b.week;
  });

  return (
    <div className="space-y-6 px-6 py-6">
      <PageHeader
        eyebrow="Caseload"
        title={isPM ? "All veterans" : "Your caseload"}
        description={`${sorted.length} active`}
      />
      {sorted.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" aria-hidden />}
          title="No assigned veterans yet."
          description="When veterans are assigned to your caseload they'll appear here. Until then, the queue holds anything that needs your attention."
        />
      ) : (
        <ul
          className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-canvas-card"
          role="list"
        >
          {sorted.map((row) => {
            const initials = row.name
              .split(/\s+/)
              .map((s) => s[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            return (
              <li key={row.veteranId}>
                <Link
                  href={`/coordinator/veteran/${row.veteranId}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-canvas-banded focus-visible:bg-canvas-banded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <Avatar initials={initials} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-body font-semibold text-ink-primary">
                        {row.name}
                      </span>
                      <Badge variant="outline" className="shrink-0">
                        Wk {row.week}
                      </Badge>
                      {row.top && <RiskBadge level={row.top.severity} size="sm" />}
                    </div>
                    <div className="text-caption text-ink-tertiary">
                      {row.last
                        ? `Last check-in ${formatRelative(row.last.at)}`
                        : "No check-ins yet"}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-ink-tertiary" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function formatRelative(d: Date): string {
  const ms = Date.now() - d.getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
