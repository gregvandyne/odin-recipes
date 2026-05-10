import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { withTenant } from "@/lib/db/tenant-context";
import { ProfileForm } from "./profile-form";

/**
 * Veteran profile completion. Required before the first check-in. Captures
 * timezone, check-in cadence, separation date, branch, emergency contact.
 */
export default async function VeteranOnboardingProfilePage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const organizationId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!userId || !organizationId) redirect("/auth/sign-in");

  const profile = await withTenant(
    { organizationId, userId, userRole: "VETERAN", isOrgAdmin: false },
    async (tx) =>
      tx.veteranProfile.findUnique({
        where: { userId },
        select: {
          timezone: true,
          checkInDayOfWeek: true,
          checkInLocalTime: true,
          separationDate: true,
          branchOfService: true,
          yearsOfService: true,
          emergencyContactName: true,
          emergencyContactPhone: true,
          emergencyContactConsent: true,
          localVAFacility: true,
        },
      }),
  );

  return (
    <div className="space-y-6">
      <header>
        <p className="text-caption uppercase tracking-wide text-ink-tertiary">Set up</p>
        <h1 className="mt-2 text-display font-semibold text-ink-primary">A few quick details.</h1>
        <p className="mt-2 text-body text-ink-secondary">
          We use these to time your weekly check-in and to know who to call if you ever need one of us.
          You can change anything here later.
        </p>
      </header>

      <ProfileForm
        initial={profile ?? null}
        defaultTimezone={Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York"}
      />
    </div>
  );
}
