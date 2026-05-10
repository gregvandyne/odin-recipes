import { redirect } from "next/navigation";
import Link from "next/link";
import { Users } from "lucide-react";
import { auth } from "@/lib/auth/config";
import { withTenant } from "@/lib/db/tenant-context";
import { loadCoordinatorHealth } from "@/lib/metrics/program";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";

/**
 * Program-Manager view of every coordinator in the org.
 *
 * Shows caseload size, open-flag count, median ORANGE response time,
 * and the share of flags resolved within SLA. Used to spot caseload
 * imbalance and to time reassignments.
 */
export default async function CoordinatorsPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const organizationId = (session?.user as { organizationId?: string } | undefined)
    ?.organizationId;
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!userId || !organizationId) redirect("/auth/sign-in");
  if (role !== "PROGRAM_MANAGER" && role !== "SUPER_ADMIN") redirect("/admin");

  const rows = await withTenant(
    { organizationId, userId, userRole: role, isOrgAdmin: false },
    async (tx) => loadCoordinatorHealth(tx, organizationId),
  );

  return (
    <div className="space-y-6 px-6 py-6">
      <PageHeader
        eyebrow="People"
        title="Coordinators"
        description="Caseload size and response health, refreshed each request."
        actions={
          <Link
            href="/admin/caseload/reassign"
            className="inline-flex h-10 items-center rounded-md border border-border bg-canvas-card px-4 text-body font-semibold text-ink-primary hover:bg-canvas-banded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Reassign caseload
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" aria-hidden />}
          title="No coordinators yet."
          description="Invite a coordinator from the cohort settings page to start assigning veterans."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-canvas-card">
          <table className="w-full text-body">
            <thead className="border-b border-border bg-canvas-banded">
              <tr className="text-caption uppercase tracking-wide text-ink-tertiary">
                <th className="px-3 py-2 text-left font-semibold">Coordinator</th>
                <th className="px-3 py-2 text-right font-semibold">Caseload</th>
                <th className="px-3 py-2 text-right font-semibold">Open flags</th>
                <th className="px-3 py-2 text-right font-semibold">ORANGE response (med.)</th>
                <th className="px-3 py-2 text-right font-semibold">Resolved on SLA</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const initials = row.name
                  .split(/\s+/)
                  .map((s) => s[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <tr key={row.coordinatorId} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Avatar initials={initials} size="sm" />
                        <span className="text-ink-primary">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{row.caseload}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{row.unresolvedFlags}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {row.medianResponseHours !== null
                        ? `${row.medianResponseHours.toFixed(1)}h`
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {row.resolvedSlaPct !== null ? `${row.resolvedSlaPct}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
