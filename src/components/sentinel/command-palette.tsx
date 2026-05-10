"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command as CommandPrimitive } from "cmdk";
import {
  Inbox,
  MessageSquare,
  Users,
  ShieldAlert,
  BarChart3,
  Search,
  User,
  Settings,
  ScrollText,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/**
 * ⌘K command palette.
 *
 * Two sections:
 *   - Static "Go to" pages.
 *   - Live "Veterans" search (debounced 200ms) hitting /api/search.
 *
 * Selecting a veteran row navigates to their timeline. The palette is
 * always mounted in staff layouts but only renders the Dialog when the
 * user opens it — empty cost when idle.
 */
const COMMANDS = [
  { id: "queue",       label: "Today's queue",         href: "/coordinator",          Icon: Inbox },
  { id: "messages",    label: "Messages",              href: "/coordinator/messages", Icon: MessageSquare },
  { id: "caseload",    label: "My caseload",           href: "/coordinator/caseload", Icon: Users },
  { id: "escalations", label: "Clinical escalations",  href: "/clinical",             Icon: ShieldAlert },
  { id: "cohort",      label: "Cohort dashboard",      href: "/admin",                Icon: BarChart3 },
  { id: "audit",       label: "Audit log",             href: "/admin/audit",          Icon: ScrollText },
  { id: "ooo",         label: "Out of office",         href: "/account/ooo",          Icon: Settings },
];

interface VeteranHit {
  id: string;
  name: string;
  week: number;
}

export function CommandPalette({ defaultOpen = false }: { defaultOpen?: boolean } = {}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(defaultOpen);
  const [query, setQuery] = React.useState("");
  const [veterans, setVeterans] = React.useState<VeteranHit[]>([]);
  const [searching, setSearching] = React.useState(false);

  // Debounced veteran search.
  React.useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setVeterans([]);
      return;
    }
    let cancelled = false;
    const id = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          // The route handler reads from the database; cache won't help.
          cache: "no-store",
        });
        if (!res.ok) return;
        const j = (await res.json()) as { veterans: VeteranHit[] };
        if (!cancelled) setVeterans(j.veterans);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [query, open]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <CommandPrimitive className="flex flex-col" loop shouldFilter={false}>
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Search className="h-4 w-4 text-ink-tertiary" aria-hidden />
            <CommandPrimitive.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search veterans, jump to a queue, settings…"
              className="flex-1 bg-transparent text-body outline-none placeholder:text-ink-tertiary"
            />
            <kbd className="rounded border border-border bg-canvas-banded px-1.5 py-0.5 text-caption text-ink-tertiary">
              esc
            </kbd>
          </div>

          <CommandPrimitive.List className="max-h-80 overflow-y-auto p-2">
            <CommandPrimitive.Empty className="px-3 py-6 text-center text-caption text-ink-tertiary">
              {searching ? "Searching…" : "Nothing matches."}
            </CommandPrimitive.Empty>

            {veterans.length > 0 && (
              <CommandPrimitive.Group
                heading="Veterans"
                className="px-1 text-caption text-ink-tertiary"
              >
                {veterans.map((v) => (
                  <CommandPrimitive.Item
                    key={`vet-${v.id}`}
                    value={`vet-${v.id}-${v.name}`}
                    onSelect={() => go(`/coordinator/veteran/${v.id}`)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-body text-ink-primary aria-selected:bg-canvas-banded"
                  >
                    <User className="h-4 w-4 text-ink-secondary" aria-hidden />
                    <span className="flex-1 truncate">{v.name}</span>
                    <span className="text-caption text-ink-tertiary">Wk {v.week}</span>
                  </CommandPrimitive.Item>
                ))}
              </CommandPrimitive.Group>
            )}

            <CommandPrimitive.Group heading="Go to" className="px-1 text-caption text-ink-tertiary">
              {COMMANDS.filter(
                (c) =>
                  query.trim().length === 0 ||
                  c.label.toLowerCase().includes(query.toLowerCase()),
              ).map((c) => (
                <CommandPrimitive.Item
                  key={c.id}
                  value={c.label}
                  onSelect={() => go(c.href)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-body text-ink-primary aria-selected:bg-canvas-banded"
                >
                  <c.Icon className="h-4 w-4 text-ink-secondary" aria-hidden />
                  {c.label}
                </CommandPrimitive.Item>
              ))}
            </CommandPrimitive.Group>
          </CommandPrimitive.List>
        </CommandPrimitive>
      </DialogContent>
    </Dialog>
  );
}
