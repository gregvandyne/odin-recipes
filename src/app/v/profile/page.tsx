import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Shield, Bell, ScanLine } from "lucide-react";
import { auth } from "@/lib/auth/config";
import { withTenant } from "@/lib/db/tenant-context";
import { currentWeekNumber } from "@/lib/program/week";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/page-header";
import { SignOutButton } from "./sign-out-button";

/**
 * Veteran profile / settings landing page.
 *
 * Reached by tapping the avatar on the home screen. Shows the veteran's
 * basic info + a small set of self-service links: edit profile, manage
 * notification preferences, security, and sign out. The sign-out button is
 * a client component so it can call NextAuth's signOut helper.
 */
export default async function VeteranProfilePage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const organizationId = (session?.user as { organizationId?: string } | undefined)
    ?.organizationId;
  if (!userId || !organizationId) redirect("/auth/sign-in");

  const data = await withTenant(
    { organizationId, userId, userRole: "VETERAN", isOrgAdmin: false },
    async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { displayName: true, email: true, mfaEnabled: true },
      });
      const profile = await tx.veteranProfile.findUnique({
        where: { userId },
        select: {
          branchOfService: true,
          checkInDayOfWeek: true,
          checkInLocalTime: true,
          timezone: true,
          programStartDate: true,
        },
      });
      return { user, profile };
    },
  );

  const name = data.user?.displayName ?? data.user?.email ?? "You";
  const initials = name
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const week = data.profile ? currentWeekNumber(data.profile.programStartDate) : null;
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Account" title="Your profile" />

      <section className="rounded-lg border border-border bg-canvas-card p-5">
        <div className="flex items-start gap-3">
          <Avatar initials={initials} size="lg" />
          <div className="min-w-0">
            <p className="text-body font-semibold text-ink-primary">{name}</p>
            <p className="truncate text-caption text-ink-tertiary">{data.user?.email}</p>
            {week !== null && (
              <p className="mt-1 text-caption text-ink-tertiary">Week {week} of 52</p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-canvas-card p-5">
        <h2 className="text-body font-semibold text-ink-primary">Your check-in cadence</h2>
        {data.profile ? (
          <p className="mt-1 text-body text-ink-secondary">
            {days[data.profile.checkInDayOfWeek]} at {data.profile.checkInLocalTime}{" "}
            <span className="text-ink-tertiary">({data.profile.timezone})</span>
            {data.profile.branchOfService && (
              <>
                {" · "}
                {data.profile.branchOfService}
              </>
            )}
          </p>
        ) : (
          <p className="mt-1 text-body text-ink-secondary">
            <Link
              href="/v/onboarding/profile"
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              Finish setting up your profile
            </Link>{" "}
            so we know when to ask.
          </p>
        )}
        <Link
          href="/v/onboarding/profile"
          className="mt-3 inline-flex items-center gap-1 rounded text-caption font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Update your details <ChevronRight className="h-3 w-3" aria-hidden />
        </Link>
      </section>

      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-canvas-card">
        <ProfileLink
          href="/account/security"
          icon={<Shield className="h-4 w-4" aria-hidden />}
          title="Security"
          description={data.user?.mfaEnabled ? "Two-factor: on" : "Two-factor: off"}
        />
        <ProfileLink
          href="/v/insights"
          icon={<ScanLine className="h-4 w-4" aria-hidden />}
          title="What your coordinator sees"
          description="Plain language summary of recent check-ins"
        />
        <ProfileLink
          href="/account/ooo"
          icon={<Bell className="h-4 w-4" aria-hidden />}
          title="Notifications"
          description="Email + push preferences"
        />
      </ul>

      <SignOutButton />

      <p className="px-1 text-caption text-ink-tertiary">
        In a crisis, call{" "}
        <a href="tel:988" className="font-semibold text-crisis hover:underline">
          988
        </a>{" "}
        and press 1.
      </p>
    </div>
  );
}

function ProfileLink({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-canvas-banded focus-visible:bg-canvas-banded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="grid h-9 w-9 place-items-center rounded-md bg-canvas-banded text-ink-tertiary">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-body font-semibold text-ink-primary">{title}</div>
          <div className="truncate text-caption text-ink-tertiary">{description}</div>
        </div>
        <ChevronRight className="h-4 w-4 text-ink-tertiary" aria-hidden />
      </Link>
    </li>
  );
}
