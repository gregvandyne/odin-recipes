import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { withTenant } from "@/lib/db/tenant-context";
import { computeDomainScores } from "@/lib/risk/engine";
import type { CheckInRecord, CheckInResponse, DomainCode } from "@/lib/risk/types";
import { DOMAIN_CODES } from "@/lib/risk/types";
import { DomainSparkline } from "@/components/sentinel/domain-sparkline";

/**
 * Veteran's own trends — real data from their own check-ins.
 *
 * Server component. Pulls the last 12 weeks of check-ins and runs them
 * through the same `computeDomainScores` the engine uses. The veteran sees
 * the same per-domain trajectory the coordinator sees, in the same shape,
 * minus risk-level letters and flag colors.
 */
export default async function VeteranTrends() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const organizationId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!userId || !organizationId) redirect("/auth/sign-in");

  const checkIns = await withTenant(
    { organizationId, userId, userRole: "VETERAN", isOrgAdmin: false },
    async (tx) =>
      tx.checkIn.findMany({
        where: { veteranId: userId },
        orderBy: { submittedAt: "desc" },
        take: 12,
        select: {
          id: true,
          weekNumber: true,
          submittedAt: true,
          responses: true,
        },
      }),
  );

  // Engine takes oldest→newest for the sparkline. DB returns newest first.
  const ordered = checkIns.slice().reverse();

  const series: { domain: DomainCode; values: (number | null)[] }[] = DOMAIN_CODES.map((d) => ({
    domain: d,
    values: ordered.map((c) => {
      const record: CheckInRecord = {
        id: c.id,
        weekNumber: c.weekNumber,
        submittedAt: c.submittedAt,
        responses: (c.responses as unknown as CheckInResponse[]) ?? [],
        openEndedResponse: null,
      };
      const scores = computeDomainScores(record);
      const ds = scores.find((s) => s.domain === d);
      if (!ds || ds.responseCount === 0) return null;
      return Math.round(ds.score);
    }),
  }));

  const weeksShown = ordered.length;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-caption text-ink-tertiary">Your trends</p>
        <h1 className="mt-1 text-heading font-semibold text-ink-primary">
          {weeksShown === 0
            ? "Nothing yet — your first check-in will start the trend."
            : `The last ${weeksShown} ${weeksShown === 1 ? "week" : "weeks"}`}
        </h1>
        <p className="mt-2 text-body text-ink-secondary">
          This is what you see, and what your coordinator sees. Lower lines are calmer weeks.
        </p>
      </header>

      {weeksShown > 0 && (
        <div className="rounded-lg border border-border bg-canvas-card p-6 space-y-3">
          {series.map((row) => (
            <DomainSparkline key={row.domain} domain={row.domain} values={row.values} />
          ))}
        </div>
      )}
    </div>
  );
}
