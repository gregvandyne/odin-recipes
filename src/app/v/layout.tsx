import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { CrisisResourceBanner } from "@/components/sentinel/crisis-resource-banner";
import { BottomNav } from "@/components/sentinel/bottom-nav";
import { InstallPrompt } from "@/components/sentinel/install-prompt";

/**
 * Veteran-app layout (mobile-first PWA shell).
 *
 * Bottom nav is the primary navigation. Crisis banner is always one tap away.
 * Generous bottom padding to clear both the nav and the banner.
 *
 * Onboarding gate: a veteran without a complete VeteranProfile is redirected
 * to /v/onboarding/profile (or /v/onboarding/consent if they haven't signed
 * the latest consent yet). Onboarding pages are exempt so we don't loop.
 */
export default async function VeteranLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (userId && role === "VETERAN") {
    const path = headers().get("x-pathname") ?? "";
    const onOnboarding = path.startsWith("/v/onboarding") || path.startsWith("/v/accept-invitation");
    if (!onOnboarding) {
      const u = await prisma.user.findUnique({
        where: { id: userId },
        select: { consentSignedAt: true, veteranProfile: { select: { branchOfService: true, timezone: true } } },
      });
      if (!u?.consentSignedAt) {
        redirect("/v/onboarding/consent");
      } else if (!u.veteranProfile?.branchOfService || !u.veteranProfile?.timezone) {
        redirect("/v/onboarding/profile");
      }
    }
  }

  return (
    <div className="min-h-screen bg-canvas-veteran pb-32">
      <InstallPrompt />
      <main id="main" className="container max-w-2xl py-6">{children}</main>
      <BottomNav />
      <CrisisResourceBanner variant="compact" className="bottom-14" />
    </div>
  );
}
