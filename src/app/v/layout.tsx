import { CrisisResourceBanner } from "@/components/sentinel/crisis-resource-banner";
import { BottomNav } from "@/components/sentinel/bottom-nav";
import { InstallPrompt } from "@/components/sentinel/install-prompt";

/**
 * Veteran-app layout (mobile-first PWA shell).
 *
 * Bottom nav is the primary navigation. Crisis banner is always one tap away.
 * Generous bottom padding to clear both the nav and the banner.
 */
export default function VeteranLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas-veteran pb-32">
      <InstallPrompt />
      <main className="container max-w-2xl py-6">{children}</main>
      <BottomNav />
      <CrisisResourceBanner variant="compact" className="bottom-14" />
    </div>
  );
}
