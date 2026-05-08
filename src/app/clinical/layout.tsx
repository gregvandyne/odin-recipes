import Link from "next/link";

export default function ClinicalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas-staff">
      <header className="border-b border-border bg-canvas-card">
        <div className="container flex h-12 items-center justify-between">
          <Link href="/clinical" className="text-body font-semibold text-ink-primary">
            Sentinel · Clinical
          </Link>
          <nav className="flex items-center gap-4 text-caption text-ink-secondary">
            <Link href="/clinical" className="hover:text-ink-primary">Escalations</Link>
            <Link href="/clinical/recent" className="hover:text-ink-primary">Recent activity</Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
