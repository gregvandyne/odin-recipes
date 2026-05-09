"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command as CommandPrimitive } from "cmdk";
import { Inbox, MessageSquare, Users, ShieldAlert, BarChart3, Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/**
 * ⌘K command palette. Linear/Superhuman pattern. Keyboard-first navigation.
 */
const COMMANDS = [
  { id: "queue",       label: "Today's queue",         href: "/coordinator",          Icon: Inbox },
  { id: "messages",    label: "Messages",              href: "/coordinator/messages", Icon: MessageSquare },
  { id: "caseload",    label: "My caseload",           href: "/coordinator/caseload", Icon: Users },
  { id: "escalations", label: "Clinical escalations",  href: "/clinical",             Icon: ShieldAlert },
  { id: "cohort",      label: "Cohort dashboard",      href: "/admin",                Icon: BarChart3 },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
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
    router.push(href);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <CommandPrimitive className="flex flex-col" loop>
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Search className="h-4 w-4 text-ink-tertiary" aria-hidden />
            <CommandPrimitive.Input
              placeholder="Search cases, queues, settings…"
              className="flex-1 bg-transparent text-body outline-none placeholder:text-ink-tertiary"
            />
            <kbd className="rounded border border-border bg-canvas-banded px-1.5 py-0.5 text-caption text-ink-tertiary">esc</kbd>
          </div>

          <CommandPrimitive.List className="max-h-80 overflow-y-auto p-2">
            <CommandPrimitive.Empty className="px-3 py-6 text-center text-caption text-ink-tertiary">
              Nothing matches.
            </CommandPrimitive.Empty>

            <CommandPrimitive.Group heading="Go to" className="px-1 text-caption text-ink-tertiary">
              {COMMANDS.map((c) => (
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
