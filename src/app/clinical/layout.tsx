import { StaffSidebar } from "@/components/sentinel/staff-sidebar";
import { CommandPalette } from "@/components/sentinel/command-palette";
import { ThemeToggle } from "@/components/sentinel/theme-toggle";

export default function ClinicalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas-staff">
      <StaffSidebar surface="clinical" surfaceLabel="Clinical" user={{ name: "Dr. R. Mitchell", role: "Clinical Lead" }} />
      <div className="lg:pl-56">
        <header className="border-b border-border bg-canvas-card">
          <div className="flex h-12 items-center justify-end gap-2 px-4">
            <kbd className="rounded border border-border bg-canvas-banded px-1.5 py-0.5 text-caption text-ink-tertiary">⌘K</kbd>
            <ThemeToggle />
          </div>
        </header>
        <main>{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}
