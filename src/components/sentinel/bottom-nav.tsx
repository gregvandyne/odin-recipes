"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageSquare, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Veteran-app bottom nav. Three tabs only — Home, Messages, Resources.
 * Profile lives behind avatar tap on the home screen.
 *
 * Notification badge counts intentionally NOT shown to veterans (per design
 * spec: "no notification badge counts visible to veterans"). The dot indicator
 * for unread messages is a quiet single dot, not a count.
 */
const TABS = [
  { href: "/v",          label: "Home",      Icon: Home },
  { href: "/v/messages", label: "Messages",  Icon: MessageSquare },
  { href: "/v/resources",label: "Resources", Icon: BookOpen },
] as const;

export function BottomNav({ unreadMessages = false }: { unreadMessages?: boolean }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-canvas-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="container flex h-14 max-w-2xl items-stretch justify-around">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== "/v" && pathname.startsWith(href));
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-0.5 text-caption transition-colors",
                  active ? "text-ink-primary" : "text-ink-tertiary hover:text-ink-secondary",
                )}
                aria-current={active ? "page" : undefined}
              >
                <span className="relative">
                  <Icon className="h-5 w-5" aria-hidden />
                  {label === "Messages" && unreadMessages && (
                    <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-primary" aria-label="unread" />
                  )}
                </span>
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
