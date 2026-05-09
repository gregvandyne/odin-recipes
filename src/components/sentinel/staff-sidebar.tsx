"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Inbox, Users, MessageSquare, BarChart3, Settings, ShieldAlert, LayoutDashboard } from "lucide-react";

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

export function StaffSidebar({ surface, surfaceLabel, user }: Props) {
  const pathname = usePathname();
  const items = NAV[surface] ?? [];

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-border bg-canvas-card lg:flex">
      <div className="flex h-12 items-center border-b border-border px-4">
        <Link href={items[0]?.href ?? "/"} className="text-body font-semibold text-ink-primary">
          Sentinel
        </Link>
        <span className="ml-2 text-caption text-ink-tertiary">· {surfaceLabel}</span>
      </div>

      <nav className="flex-1 px-2 py-3" aria-label="Primary">
        <ul className="space-y-0.5">
          {items.map(({ href, label, Icon }) => {
            const active = pathname === href || (href !== items[0]?.href && pathname.startsWith(href));
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-body transition-colors",
                    active
                      ? "bg-canvas-banded text-ink-primary"
                      : "text-ink-secondary hover:bg-canvas-banded hover:text-ink-primary",
                  )}
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
            {user.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
          </span>
          <div className="min-w-0">
            <div className="truncate text-caption font-semibold text-ink-primary">{user.name}</div>
            <div className="truncate text-caption text-ink-tertiary">{user.role}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
