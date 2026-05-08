import Link from "next/link";

/**
 * Coordinator-app layout. Desktop-first. Information dense but scannable.
 * Status indicators quiet by default. No real-time animations.
 */
export default function CoordinatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas-staff">
      <header className="border-b border-border bg-canvas-card">
        <div className="container flex h-12 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/coordinator" className="text-body font-semibold text-ink-primary">
              Sentinel
            </Link>
            <nav className="flex items-center gap-4 text-caption text-ink-secondary">
              <Link href="/coordinator" className="hover:text-ink-primary">
                Queue
              </Link>
              <Link href="/coordinator/messages" className="hover:text-ink-primary">
                Messages
              </Link>
              <Link href="/coordinator/caseload" className="hover:text-ink-primary">
                Caseload
              </Link>
            </nav>
          </div>
          <kbd className="rounded border border-border bg-canvas-banded px-1.5 py-0.5 text-caption text-ink-tertiary">
            ⌘K
          </kbd>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
