import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, History } from "lucide-react";
import { auth } from "@/lib/auth/config";
import { withTenant } from "@/lib/db/tenant-context";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

/**
 * Clinical-Lead recent escalations: a read-only history of cases this
 * lead has touched in the last 90 days. Useful for context when a
 * coordinator escalates a similar case again.
 */
export default async function ClinicalRecentPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const organizationId = (session?.user as { organizationId?: string } | undefined)
    ?.organizationId;
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!userId || !organizationId) redirect("/auth/sign-in");
  if (role !== "CLINICAL_LEAD" && role !== "PROGRAM_MANAGER" && role !== "SUPER_ADMIN") {
    redirect(role === "VETERAN" ? "/v" : "/coordinator");
  }

  const since = new Date(Date.now() - 90 * 86_400_000);

  const rows = await withTenant(
    { organizationId, userId, userRole: role, isOrgAdmin: false },
    async (tx) =>
      tx.clinicalEscalation.findMany({
        where: {
          organizationId,
          clinicalLeadId: userId,
          createdAt: { gte: since },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          status: true,
          createdAt: true,
          closedAt: true,
          veteranId: true,
        },
      }),
  );

  const veteranIds = [...new Set(rows.map((r) => r.veteranId))];
  const veterans = veteranIds.length
    ? await withTenant(
        { organizationId, userId, userRole: role, isOrgAdmin: false },
        async (tx) =>
          tx.user.findMany({
            where: { id: { in: veteranIds } },
            select: { id: true, displayName: true, email: true },
          }),
      )
    : [];
  const veteranById = new Map(veterans.map((v) => [v.id, v]));

  return (
    <div className="space-y-6 px-6 py-6">
      <PageHeader
        eyebrow="Clinical"
        title="Recent escalations"
        description="Last 90 days of cases you've claimed. Read-only history for context."
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<History className="h-5 w-5" aria-hidden />}
          title="Nothing in the last 90 days."
          description="When you claim or close an escalation, it'll show up here for context next time."
        />
      ) : (
        <ul
          className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-canvas-card"
          role="list"
        >
          {rows.map((row) => {
            const v = veteranById.get(row.veteranId);
            const name = v?.displayName ?? v?.email ?? "Unknown";
            const initials = name
              .split(/\s+/)
              .map((s) => s[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            return (
              <li key={row.id}>
                <Link
                  href={`/coordinator/veteran/${row.veteranId}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-canvas-banded focus-visible:bg-canvas-banded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <Avatar initials={initials} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-body font-semibold text-ink-primary">
                        {name}
                      </span>
                      <Badge variant="outline" className="shrink-0">
                        {row.status}
                      </Badge>
                    </div>
                    <div className="text-caption text-ink-tertiary">
                      Claimed{" "}
                      {row.createdAt.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {row.closedAt && (
                        <>
                          {" · closed "}
                          {row.closedAt.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </>
                      )}
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
