import Link from "next/link";
import { ArrowRight, Phone } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/tenant-context";
import { currentWeekNumber } from "@/lib/program/week";

/**
 * Veteran home. One primary action per screen: this week's check-in.
 *
 * Server component: pulls the veteran's actual program week and check-in
 * status. No mock data anywhere on this page.
 */
export default async function VeteranHome() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const organizationId = (session?.user as { organizationId?: string } | undefined)?.organizationId;

  // If unauthenticated or unscoped, fall back to the calm marketing-style
  // shell. The auth flow will redirect; this branch keeps the page renderable
  // for screenshot capture in CI.
  if (!userId || !organizationId) {
    return <UnscopedHome />;
  }

  const data = await withTenant(
    { organizationId, userId, userRole: "VETERAN", isOrgAdmin: false },
    async (tx) => {
      const profile = await tx.veteranProfile.findUnique({
        where: { userId },
        select: {
          programStartDate: true,
          timezone: true,
          assignedCoordinatorId: true,
          user: { select: { displayName: true } },
        },
      });
      if (!profile) return null;

      const week = currentWeekNumber(profile.programStartDate, new Date(), profile.timezone);

      // Has the veteran submitted a check-in for this week already?
      const hasCheckedInThisWeek = await tx.checkIn.count({
        where: { veteranId: userId, weekNumber: week },
      });

      const hasDraft = await tx.checkInDraft.count({
        where: { veteranId: userId, weekNumber: week },
      });

      const coordinator = profile.assignedCoordinatorId
        ? await tx.user.findUnique({
            where: { id: profile.assignedCoordinatorId },
            select: { displayName: true },
          })
        : null;

      return {
        displayName: profile.user.displayName ?? "there",
        weekNumber: week,
        checkInPending: hasCheckedInThisWeek === 0,
        hasDraft: hasDraft > 0,
        coordinatorName: coordinator?.displayName ?? "Your coordinator",
      };
    },
  );

  if (!data) return <UnscopedHome />;

  const dotsTotal = 52;
  const dotsFilled = data.weekNumber;
  const initials = data.displayName.split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  const coordinatorInitials = data.coordinatorName
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const minutes = 5;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-caption text-ink-tertiary">Week {data.weekNumber} of 52</p>
          <h1 className="mt-2 font-serif text-[36px] font-normal leading-[1.1] tracking-[-0.015em] text-ink-primary">
            Hi, {data.displayName.split(/\s+/)[0]}.
          </h1>
        </div>
        <Link href="/v/profile" aria-label="Profile">
          <Avatar initials={initials} />
        </Link>
      </header>

      <div className="flex items-center gap-1" aria-hidden>
        {Array.from({ length: dotsTotal }).map((_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full ${i < dotsFilled ? "bg-ink-secondary/60" : "bg-border"}`}
          />
        ))}
      </div>

      {data.checkInPending && (
        <Link
          href="/v/check-in"
          className="group block rounded-xl border border-border bg-canvas-card p-6 transition-colors hover:bg-canvas-banded"
        >
          <p className="text-caption uppercase tracking-wide text-ink-tertiary">This week's check-in</p>
          <h2 className="mt-2 text-balance text-heading font-semibold text-ink-primary">
            About {minutes} minutes. Skip what you want.
          </h2>
          <p className="mt-2 text-body text-ink-secondary">
            {data.hasDraft
              ? "You started this last time — pick up where you left off."
              : "Six short questions. You can stop anytime — what you've answered is saved."}
          </p>
          <span className="mt-4 inline-flex items-center gap-2 text-body font-semibold text-primary">
            {data.hasDraft ? "Continue" : "Start"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </Link>
      )}

      <Link
        href="/v/messages"
        className="flex items-center gap-3 rounded-lg border border-border bg-canvas-card p-4 hover:bg-canvas-banded"
      >
        <Avatar initials={coordinatorInitials} size="md" />
        <div className="flex-1 min-w-0">
          <div className="text-body font-semibold text-ink-primary">{data.coordinatorName}</div>
          <div className="text-caption text-ink-tertiary">Your coordinator · usually replies same day</div>
        </div>
        <ArrowRight className="h-4 w-4 text-ink-tertiary" aria-hidden />
      </Link>

      <Link
        href="/v/insights"
        className="flex items-center gap-3 rounded-lg border border-border bg-canvas-card p-4 hover:bg-canvas-banded"
      >
        <div className="flex-1 min-w-0">
          <div className="text-body font-semibold text-ink-primary">What your coordinator sees</div>
          <div className="text-caption text-ink-tertiary">
            Plain language. No surprises. You can disagree with anything.
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-ink-tertiary" aria-hidden />
      </Link>

      <div className="rounded-lg border border-border bg-canvas-card p-4">
        <p className="text-caption uppercase tracking-wide text-ink-tertiary">If you need someone right now</p>
        <a
          href="tel:988"
          className="mt-2 inline-flex items-center gap-2 text-body-lg font-semibold text-crisis hover:underline"
        >
          <Phone className="h-4 w-4" aria-hidden />
          Call 988, press 1
        </a>
        <p className="mt-1 text-caption text-ink-secondary">
          Veterans Crisis Line · 24/7. You don't have to be in crisis to call.
        </p>
      </div>
    </div>
  );
}

function UnscopedHome() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-[36px] font-normal leading-tight tracking-[-0.015em] text-ink-primary">Welcome back.</h1>
        <p className="mt-2 text-body text-ink-secondary">
          Sign in to see your check-in. Your trends and messages will load once we know who you are.
        </p>
      </header>
      <Link
        href="/auth/sign-in"
        className="inline-flex h-12 items-center rounded-md bg-primary px-6 text-body font-semibold text-primary-foreground hover:bg-primary-hover"
      >
        Sign in
      </Link>
    </div>
  );
}
