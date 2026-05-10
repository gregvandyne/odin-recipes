"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Inbox,
  Users,
  MessageSquare,
  BarChart3,
  Settings,
  ShieldAlert,
  LayoutDashboard,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  Icon: typeof Inbox;
}

const NAV: Record<string, NavItem[]> = {
  coordinator: [
    { href: "/coordinator",          label: "Queue",     Icon: Inbox },
    { href: "/coordinator/messages", label: "Messages",  Icon: MessageSquare },
    { href: "/coordinator/caseload", label: "Caseload",  Icon: Users },
  ],
  clinical: [
    { href: "/clinical",             label: "Escalations", Icon: ShieldAlert },
    { href: "/clinical/recent",      label: "Recent",      Icon: LayoutDashboard },
  ],
  admin: [
    { href: "/admin",                label: "Cohort",      Icon: BarChart3 },
    { href: "/admin/coordinators",   label: "Coordinators",Icon: Users },
    { href: "/admin/settings",       label: "Settings",    Icon: Settings },
  ],
};

interface Props {
  surface: keyof typeof NAV;
  surfaceLabel: string;
  user: { name: string; role: string };
}

/**
 * Staff sidebar.
 *
 * Desktop (lg+): permanently visible 56-unit fixed-position rail.
 * Mobile / tablet: hidden by default; the StaffMobileBar component renders a
 * hamburger button that opens the sidebar as a slide-in drawer with an
 * overlay. The drawer auto-closes on route change and on overlay click,
 * supports Escape, and traps focus within itself.
 */
export function StaffSidebar({ surface, surfaceLabel, user }: Props) {
  const pathname = usePathname();
  const items = NAV[surface] ?? [];
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // Close on route change.
  React.useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Escape-to-close + body scroll lock while open.
  React.useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  return (
    <>
      <StaffMobileBar
        surfaceLabel={surfaceLabel}
        onOpen={() => setDrawerOpen(true)}
      />

      {/* Desktop sidebar — always visible at lg+. */}
      <aside
        className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-border bg-canvas-card lg:flex"
        aria-label="Primary"
      >
        <SidebarBody
          surfaceLabel={surfaceLabel}
          items={items}
          pathname={pathname}
          user={user}
        />
      </aside>

      {/* Mobile drawer — slides in from the left. */}
      {drawerOpen && (
        <>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation"
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Primary navigation"
            className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80vw] flex-col border-r border-border bg-canvas-card shadow-soft lg:hidden"
          >
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close navigation"
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-md text-ink-tertiary hover:bg-canvas-banded hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarBody
              surfaceLabel={surfaceLabel}
              items={items}
              pathname={pathname}
              user={user}
            />
          </aside>
        </>
      )}
    </>
  );
}

function SidebarBody({
  surfaceLabel,
  items,
  pathname,
  user,
}: {
  surfaceLabel: string;
  items: NavItem[];
  pathname: string;
  user: { name: string; role: string };
}) {
  return (
    <>
      <div className="flex h-12 items-center border-b border-border px-4">
        <Link href={items[0]?.href ?? "/"} className="text-body font-semibold text-ink-primary">
          Sentinel
        </Link>
        <span className="ml-2 text-caption text-ink-tertiary">· {surfaceLabel}</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Primary">
        <ul className="space-y-0.5">
          {items.map(({ href, label, Icon }) => {
            const active =
              pathname === href || (href !== items[0]?.href && pathname.startsWith(href));
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-body transition-colors",
                    active
                      ? "bg-canvas-banded text-ink-primary"
                      : "text-ink-secondary hover:bg-canvas-banded hover:text-ink-primary",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-canvas-banded text-caption font-semibold text-ink-secondary">
            {user.name
              .split(" ")
              .map((p) => p[0])
              .join("")
              .slice(0, 2)}
          </span>
          <div className="min-w-0">
            <div className="truncate text-caption font-semibold text-ink-primary">
              {user.name}
            </div>
            <div className="truncate text-caption text-ink-tertiary">{user.role}</div>
          </div>
        </div>
      </div>
    </>
  );
}

function StaffMobileBar({
  surfaceLabel,
  onOpen,
}: {
  surfaceLabel: string;
  onOpen: () => void;
}) {
  return (
    <div className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border bg-canvas-card px-3 lg:hidden">
      <button
        type="button"
        onClick={onOpen}
        aria-label="Open navigation"
        className="grid h-9 w-9 place-items-center rounded-md text-ink-secondary hover:bg-canvas-banded hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Menu className="h-4 w-4" />
      </button>
      <Link href="/" className="text-body font-semibold text-ink-primary">
        Sentinel
      </Link>
      <span className="text-caption text-ink-tertiary">· {surfaceLabel}</span>
    </div>
  );
}
