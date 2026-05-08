import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas-staff">
      <header className="border-b border-border bg-canvas-card">
        <div className="container flex h-12 items-center justify-between">
          <Link href="/admin" className="text-body font-semibold text-ink-primary">
            Sentinel · Program Manager
          </Link>
          <nav className="flex items-center gap-4 text-caption text-ink-secondary">
            <Link href="/admin" className="hover:text-ink-primary">Cohort</Link>
            <Link href="/admin/coordinators" className="hover:text-ink-primary">Coordinators</Link>
            <Link href="/admin/settings" className="hover:text-ink-primary">Settings</Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
