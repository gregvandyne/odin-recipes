import { CrisisResourceBanner } from "@/components/sentinel/crisis-resource-banner";

/**
 * Veteran-app layout (mobile-first PWA shell).
 * Compact crisis banner persistent at the bottom of every screen.
 * Calm canvas, generous padding, no badge counts.
 */
export default function VeteranLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas-veteran pb-20">
      <main className="container max-w-2xl py-6">{children}</main>
      <CrisisResourceBanner variant="compact" />
    </div>
  );
}
