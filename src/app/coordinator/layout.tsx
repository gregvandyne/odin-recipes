import { StaffSidebar } from "@/components/sentinel/staff-sidebar";
import { CommandPaletteHost } from "@/components/sentinel/command-palette-host";
import { ThemeToggle } from "@/components/sentinel/theme-toggle";
import { requireActiveSession } from "@/lib/auth/require-session";
import { prisma } from "@/lib/db/prisma";

/**
 * Coordinator-app layout.
 *
 * Authenticated. Gates: any non-ACTIVE account is bounced to
 * /auth/account-suspended; veterans are redirected to /v.
 *
 * Desktop-first; collapses to a hamburger drawer on tablet/phone via
 * StaffSidebar's built-in mobile mode. The desktop top bar (⌘K hint +
 * ThemeToggle) is hidden below `lg` because StaffSidebar renders its own
 * mobile bar at that breakpoint.
 */
export default async function CoordinatorLayout({ children }: { children: React.ReactNode }) {
  const u = await requireActiveSession();
  // Look up the coordinator's display name once so the sidebar shows their
  // real identity (was previously hardcoded "Sam Kim").
  const profile = await prisma.user.findUnique({
    where: { id: u.id },
    select: { displayName: true, email: true, role: true },
  });
  const name = profile?.displayName ?? profile?.email ?? "Coordinator";
  const role = u.role === "PROGRAM_MANAGER" ? "Program Manager" : "Coordinator";

  return (
    <div className="min-h-screen bg-canvas-staff">
      <StaffSidebar
        surface="coordinator"
        surfaceLabel="Coordinator"
        user={{ name, role }}
      />
      <div className="lg:pl-56">
        <header className="hidden border-b border-border bg-canvas-card lg:block">
          <div className="flex h-12 items-center justify-end gap-2 px-4">
            <kbd className="rounded border border-border bg-canvas-banded px-1.5 py-0.5 text-caption text-ink-tertiary">
              ⌘K
            </kbd>
            <ThemeToggle />
          </div>
        </header>
        <main id="main">{children}</main>
      </div>
      <CommandPaletteHost />
    </div>
  );
}
