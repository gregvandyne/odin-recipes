import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { withTenant } from "@/lib/db/tenant-context";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollText } from "lucide-react";
import { ExportAuditButton } from "./export-button";

/**
 * Audit log browser. Read-only paginated view of recent AuditLog rows in
 * the current organization. Filters: action substring + date window.
 *
 * Sensitive — only PROGRAM_MANAGER and SUPER_ADMIN reach this surface
 * (the layout-level role check + the export endpoint's requireMfa gate
 * provide the second layer).
 */
const PAGE_SIZE = 50;

interface SearchParams {
  action?: string;
  from?: string;
  to?: string;
  cursor?: string;
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const organizationId = (session?.user as { organizationId?: string } | undefined)
    ?.organizationId;
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!userId || !organizationId) redirect("/auth/sign-in");
  if (role !== "PROGRAM_MANAGER" && role !== "SUPER_ADMIN") redirect("/admin");

  const from = searchParams.from ? new Date(searchParams.from) : new Date(Date.now() - 7 * 86_400_000);
  const to = searchParams.to ? new Date(searchParams.to) : new Date();

  const rows = await withTenant(
    { organizationId, userId, userRole: role, isOrgAdmin: false },
    async (tx) =>
      tx.auditLog.findMany({
        where: {
          organizationId,
          timestamp: { gte: from, lte: to },
          ...(searchParams.action ? { action: { contains: searchParams.action } } : {}),
        },
        orderBy: { timestamp: "desc" },
        take: PAGE_SIZE,
        select: {
          id: true,
          timestamp: true,
          action: true,
          actorRole: true,
          resourceType: true,
          resourceId: true,
          ipAddress: true,
          metadata: true,
        },
      }),
  );

  return (
    <div className="space-y-6 px-6 py-6">
      <PageHeader
        eyebrow="Compliance"
        title="Audit log"
        description="Append-only record of every state-changing action. Export the full window for regulator review."
        actions={
          <ExportAuditButton
            from={from.toISOString()}
            to={to.toISOString()}
            action={searchParams.action ?? null}
          />
        }
      />

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-canvas-card p-4" method="get">
        <label className="flex flex-col">
          <span className="text-caption font-semibold uppercase tracking-wide text-ink-secondary">
            Action contains
          </span>
          <input
            type="text"
            name="action"
            defaultValue={searchParams.action ?? ""}
            placeholder="e.g. flag.resolve"
            className="mt-1 h-10 rounded-md border border-border bg-canvas-card px-3 text-body"
          />
        </label>
        <label className="flex flex-col">
          <span className="text-caption font-semibold uppercase tracking-wide text-ink-secondary">
            From
          </span>
          <input
            type="date"
            name="from"
            defaultValue={from.toISOString().slice(0, 10)}
            className="mt-1 h-10 rounded-md border border-border bg-canvas-card px-3 text-body"
          />
        </label>
        <label className="flex flex-col">
          <span className="text-caption font-semibold uppercase tracking-wide text-ink-secondary">
            To
          </span>
          <input
            type="date"
            name="to"
            defaultValue={to.toISOString().slice(0, 10)}
            className="mt-1 h-10 rounded-md border border-border bg-canvas-card px-3 text-body"
          />
        </label>
        <button
          type="submit"
          className="h-10 rounded-md bg-primary px-4 text-body font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Filter
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-5 w-5" aria-hidden />}
          title="No matching events."
          description="Adjust the action filter or expand the date window."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-canvas-card">
          <table className="w-full text-body">
            <thead className="border-b border-border bg-canvas-banded">
              <tr className="text-caption uppercase tracking-wide text-ink-tertiary">
                <th className="px-3 py-2 text-left font-semibold">When</th>
                <th className="px-3 py-2 text-left font-semibold">Action</th>
                <th className="px-3 py-2 text-left font-semibold">Actor</th>
                <th className="px-3 py-2 text-left font-semibold">Resource</th>
                <th className="px-3 py-2 text-left font-semibold">IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-caption text-ink-secondary">
                    {r.timestamp.toISOString().replace("T", " ").slice(0, 19)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">{r.action}</Badge>
                  </td>
                  <td className="px-3 py-2 text-caption text-ink-secondary">{r.actorRole}</td>
                  <td className="px-3 py-2 text-caption text-ink-secondary">
                    {r.resourceType}
                    {r.resourceId && (
                      <span className="ml-1 font-mono text-ink-tertiary">
                        {r.resourceId.slice(0, 8)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-caption text-ink-tertiary">
                    {r.ipAddress ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
