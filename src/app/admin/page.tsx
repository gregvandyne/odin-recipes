import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight } from "lucide-react";
import { auth } from "@/lib/auth/config";
import { withTenant } from "@/lib/db/tenant-context";
import { loadCohortHealth, loadCoordinatorHealth } from "@/lib/metrics/program";
import { redirect } from "next/navigation";

function Metric({
  label,
  value,
  delta,
  helperText,
}: {
  label: string;
  value: string;
  delta?: string;
  helperText?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="text-display font-semibold text-ink-primary">{value}</span>
          {delta && (
            <span className="inline-flex items-center gap-0.5 text-caption text-ink-secondary">
              <ArrowUpRight className="h-3 w-3" />
              {delta}
            </span>
          )}
        </div>
        {helperText && <p className="mt-2 text-caption text-ink-tertiary">{helperText}</p>}
      </CardContent>
    </Card>
  );
}

export default async function ProgramManagerDashboard() {
  const session = await auth();
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role ?? "PROGRAM_MANAGER";
  if (!orgId || !userId) redirect("/auth/sign-in");

  const data = await withTenant(
    { organizationId: orgId, userId, userRole: role, isOrgAdmin: false },
    async (tx) => {
      const [cohort, coordinators, overrides, org] = await Promise.all([
        loadCohortHealth(tx, orgId),
        loadCoordinatorHealth(tx, orgId),
        loadOverrides(tx),
        tx.organization.findUnique({ where: { id: orgId }, select: { name: true, status: true } }),
      ]);
      return { cohort, coordinators, overrides, org };
    },
  );

  return (
    <div className="px-6 py-6 space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-caption uppercase tracking-wide text-ink-tertiary">Cohort health</p>
          <h1 className="mt-1 text-display font-semibold text-ink-primary">{data.org?.name ?? "—"}</h1>
          <p className="mt-2 text-body text-ink-secondary">
            {data.cohort.activeVeterans} active veterans · {data.coordinators.length} coordinators
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant={data.org?.status === "ACTIVE" ? "primary" : "outline"}>
            {data.org?.status ?? "—"}
          </Badge>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Veterans active" value={String(data.cohort.activeVeterans)} />
        <Metric
          label="Check-in completion"
          value={`${data.cohort.checkInCompletionPct}%`}
          helperText="this week"
        />
        <Metric
          label="Median ORANGE response"
          value={
            data.cohort.medianOrangeResponseHours !== null
              ? `${data.cohort.medianOrangeResponseHours.toFixed(1)}h`
              : "—"
          }
          helperText="Target ≤ 24h"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-body-lg">Flag distribution · this week</CardTitle>
          <CardDescription>Unresolved flags grouped by severity.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <Stat color="text-risk-green" count={data.cohort.flagCounts.GREEN} label="Stable" />
            <Stat color="text-risk-yellow" count={data.cohort.flagCounts.YELLOW} label="Watch" />
            <Stat color="text-risk-orange" count={data.cohort.flagCounts.ORANGE} label="Outreach" />
            <Stat color="text-risk-red" count={data.cohort.flagCounts.RED} label="Immediate" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-body-lg">Clinical-Lead overrides · last 30 days</CardTitle>
          <CardDescription>
            Surfaced as data — not auto-tuned into the engine. Use these to inform threshold
            review, not to silently rewrite signal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.overrides.total === 0 ? (
            <p className="text-body text-ink-secondary">
              No overrides recorded in the last 30 days.
            </p>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-caption uppercase tracking-wide text-ink-tertiary">Total overrides</p>
                  <p className="mt-1 text-display font-semibold text-ink-primary">
                    {data.overrides.total}
                  </p>
                </div>
                <div>
                  <p className="text-caption uppercase tracking-wide text-ink-tertiary">Most common shift</p>
                  <ul className="mt-1 space-y-0.5 text-body text-ink-primary">
                    {data.overrides.buckets.slice(0, 4).map(([k, n]) => (
                      <li key={k}>
                        {k} <span className="text-ink-tertiary">× {n}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              {data.overrides.recentReasons.length > 0 && (
                <div className="mt-4">
                  <p className="text-caption uppercase tracking-wide text-ink-tertiary">Recent reasons</p>
                  <ul className="mt-1 space-y-1.5 text-body text-ink-secondary">
                    {data.overrides.recentReasons.map((r, i) => (
                      <li key={i} className="border-l-2 border-border pl-3">
                        <span className="text-ink-primary">{r.key}</span> · {r.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-body-lg">Coordinator caseload health</CardTitle>
          <CardDescription>Median ORANGE response and resolved-within-SLA share.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-body">
            <thead>
              <tr className="border-b border-border text-caption uppercase tracking-wide text-ink-tertiary">
                <th className="py-2 text-left font-semibold">Coordinator</th>
                <th className="py-2 text-right font-semibold">Caseload</th>
                <th className="py-2 text-right font-semibold">Open flags</th>
                <th className="py-2 text-right font-semibold">ORANGE response (med.)</th>
                <th className="py-2 text-right font-semibold">Resolved on SLA</th>
              </tr>
            </thead>
            <tbody>
              {data.coordinators.map((row) => (
                <tr key={row.coordinatorId} className="border-b border-border/60 last:border-0">
                  <td className="py-2.5 text-ink-primary">{row.name}</td>
                  <td className="py-2.5 text-right tabular-nums">{row.caseload}</td>
                  <td className="py-2.5 text-right tabular-nums">{row.unresolvedFlags}</td>
                  <td className="py-2.5 text-right tabular-nums">
                    {row.medianResponseHours !== null ? `${row.medianResponseHours.toFixed(1)}h` : "—"}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">
                    {row.resolvedSlaPct !== null ? `${row.resolvedSlaPct}%` : "—"}
                  </td>
                </tr>
              ))}
              {data.coordinators.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-body text-ink-tertiary">
                    No coordinators yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

async function loadOverrides(tx: import("@prisma/client").Prisma.TransactionClient) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await tx.flag.findMany({
    where: { severityOverrideAt: { gte: since } },
    select: {
      severityBeforeOverride: true,
      severity: true,
      severityOverrideReason: true,
      severityOverrideAt: true,
    },
  });
  const buckets = new Map<string, number>();
  for (const r of rows) {
    const k = `${r.severityBeforeOverride ?? "?"} → ${r.severity}`;
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  return {
    total: rows.length,
    buckets: [...buckets.entries()].sort((a, b) => b[1] - a[1]),
    recentReasons: rows
      .filter((r) => r.severityOverrideReason)
      .slice(0, 5)
      .map((r) => ({
        key: `${r.severityBeforeOverride ?? "?"} → ${r.severity}`,
        reason: r.severityOverrideReason!,
      })),
  };
}

function Stat({ color, count, label }: { color: string; count: number; label: string }) {
  return (
    <div>
      <div className={`text-display font-semibold ${color}`}>{count}</div>
      <div className="text-caption text-ink-secondary">{label}</div>
    </div>
  );
}
