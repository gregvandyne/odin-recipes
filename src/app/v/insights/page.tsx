import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { withTenant } from "@/lib/db/tenant-context";
import { buildVeteranNarrative } from "@/lib/transparency/veteran-narrative";
import { DisagreeButton } from "./disagree-button";

/**
 * Veteran-side transparency.
 *
 * The veteran sees what their coordinator was concerned about — in plain
 * language, never as risk-level letters or AI marker names — alongside what
 * the coordinator did about it (contact metadata only, never notes).
 *
 * They can also disagree with how a week was interpreted. That's structured
 * input the coordinator must acknowledge — it doesn't override the engine.
 */
export default async function VeteranInsightsPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const organizationId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!userId || !organizationId) redirect("/auth/sign-in");

  const data = await withTenant(
    { organizationId, userId, userRole: "VETERAN", isOrgAdmin: false },
    async (tx) => {
      const checkIns = await tx.checkIn.findMany({
        where: { veteranId: userId },
        orderBy: { submittedAt: "desc" },
        take: 12,
        select: { id: true, weekNumber: true, submittedAt: true },
      });
      const flags = await tx.flag.findMany({
        where: { veteranId: userId, checkInId: { in: checkIns.map((c) => c.id) } },
        select: {
          id: true,
          checkInId: true,
          flagType: true,
          severity: true,
          domainsInvolved: true,
          createdAt: true,
          acknowledgedAt: true,
        },
      });
      const contacts = await tx.contact.findMany({
        where: { veteranId: userId },
        orderBy: { createdAt: "desc" },
        take: 24,
        select: {
          contactType: true,
          direction: true,
          createdAt: true,
          coordinator: { select: { displayName: true } },
        },
      });
      const feedback = await tx.checkInFeedback.findMany({
        where: { veteranId: userId },
        select: { checkInId: true, createdAt: true },
      });
      return {
        checkIns,
        flags,
        contacts: contacts.map((k) => ({
          contactType: k.contactType,
          direction: k.direction,
          createdAt: k.createdAt,
          coordinatorName: k.coordinator.displayName,
        })),
        existingFeedbackByCheckIn: new Set(feedback.map((f) => f.checkInId)),
      };
    },
  );

  const flagsByCheckIn = new Map<string, typeof data.flags>();
  for (const f of data.flags) {
    if (!f.checkInId) continue;
    const arr = flagsByCheckIn.get(f.checkInId) ?? [];
    arr.push(f);
    flagsByCheckIn.set(f.checkInId, arr);
  }

  const rows = buildVeteranNarrative({
    checkIns: data.checkIns,
    flagsByCheckIn,
    contacts: data.contacts,
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-caption text-ink-tertiary">What your coordinator sees</p>
        <h1 className="mt-1 text-heading font-semibold text-ink-primary">
          Plain language, no surprises
        </h1>
        <p className="mt-2 text-body text-ink-secondary">
          You can disagree with anything here. Your context goes back to your coordinator and
          they'll acknowledge it.
        </p>
      </header>

      {rows.length === 0 && (
        <div className="rounded-lg border border-border bg-canvas-card px-6 py-10 text-center">
          <p className="text-body text-ink-secondary">
            You haven't done a check-in yet. Once you do, this is where you'll see what your
            coordinator sees — in plain language.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {rows.map((row) => {
          const alreadyDisagreed = data.existingFeedbackByCheckIn.has(row.checkInId);
          const showDisagreeAffordance = row.flagIds.length > 0;
          return (
            <article
              key={row.checkInId}
              className="rounded-lg border border-border bg-canvas-card p-5"
            >
              <header className="flex items-baseline justify-between gap-3">
                <p className="text-caption uppercase tracking-wide text-ink-tertiary">
                  Week {row.weekNumber}
                </p>
                <p className="text-caption text-ink-tertiary">
                  {row.submittedAt.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </header>
              <p className="mt-2 text-body text-ink-primary">{row.prose}</p>
              {row.outreachProse && (
                <p className="mt-1 text-body text-ink-secondary">{row.outreachProse}</p>
              )}
              {showDisagreeAffordance && !alreadyDisagreed && (
                <DisagreeButton checkInId={row.checkInId} />
              )}
              {showDisagreeAffordance && alreadyDisagreed && (
                <p className="mt-3 text-caption text-ink-tertiary">
                  Thanks for adding context. Your coordinator can see it.
                </p>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
