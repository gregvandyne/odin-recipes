import { StaffSidebar } from "@/components/sentinel/staff-sidebar";
import { CommandPalette } from "@/components/sentinel/command-palette";
import { ThemeToggle } from "@/components/sentinel/theme-toggle";

/**
 * Coordinator-app layout.
 *
 * Desktop-first; collapses to a hamburger drawer on tablet/phone via
 * StaffSidebar's built-in mobile mode. The desktop top bar (⌘K hint +
 * ThemeToggle) is hidden below `lg` because StaffSidebar renders its own
 * mobile bar at that breakpoint.
 */
export default function CoordinatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas-staff">
      <StaffSidebar
        surface="coordinator"
        surfaceLabel="Coordinator"
        user={{ name: "Sam Kim", role: "Coordinator" }}
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
      <CommandPalette />
    </div>
  );
}
