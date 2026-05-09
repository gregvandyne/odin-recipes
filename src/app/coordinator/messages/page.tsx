import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { RiskBadge } from "@/components/sentinel/risk-badge";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import type { RiskLevel } from "@/lib/risk/types";

const threads = [
  { id: "t1", veteran: "Sgt. M. Alvarez", initials: "MA", riskLevel: "RED" as RiskLevel,    last: "Help, I don't know who else to text", lastAt: new Date(Date.now() - 25 * 60 * 1000),       unread: true,  weekNumber: 9 },
  { id: "t2", veteran: "PO2 J. Reed",     initials: "JR", riskLevel: "ORANGE" as RiskLevel, last: "Yeah. Thursday afternoon would work.", lastAt: new Date(Date.now() - 90 * 60 * 1000),     unread: false, weekNumber: 9 },
  { id: "t3", veteran: "SPC R. Park",     initials: "RP", riskLevel: "ORANGE" as RiskLevel, last: "I missed last week, sorry — was traveling for the funeral.", lastAt: new Date(Date.now() - 6 * 60 * 60 * 1000), unread: true, weekNumber: 12 },
  { id: "t4", veteran: "Cpl. D. Nguyen",  initials: "DN", riskLevel: "YELLOW" as RiskLevel, last: "Thanks. Will look at the link tonight.", lastAt: new Date(Date.now() - 23 * 60 * 60 * 1000), unread: false, weekNumber: 22 },
];

export default function CoordinatorMessages() {
  return (
    <div className="px-6 py-6 space-y-6">
      <header>
        <p className="text-caption uppercase tracking-wide text-ink-tertiary">Messages</p>
        <h1 className="mt-1 text-display font-semibold text-ink-primary">Threads</h1>
        <p className="mt-2 text-body text-ink-secondary">
          {threads.filter((t) => t.unread).length} unread · {threads.length} active
        </p>
      </header>

      <div className="overflow-hidden rounded-lg border border-border bg-canvas-card shadow-soft">
        {threads.map((t) => (
          <Link
            key={t.id}
            href={`/coordinator/messages/${t.id}`}
            className="flex items-start gap-3 border-b border-border px-4 py-3 transition-colors last:border-0 hover:bg-canvas-banded"
          >
            <Avatar initials={t.initials} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {t.unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="unread" />}
                  <span className="truncate text-body font-semibold text-ink-primary">{t.veteran}</span>
                  <Badge variant="outline">Wk {t.weekNumber}</Badge>
                </div>
                <span className="shrink-0 text-caption text-ink-tertiary">
                  {formatDistanceToNow(t.lastAt, { addSuffix: true })}
                </span>
              </div>
              <p className="mt-0.5 truncate text-body text-ink-secondary">{t.last}</p>
              <div className="mt-1.5">
                <RiskBadge level={t.riskLevel} size="sm" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
