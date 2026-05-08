import Link from "next/link";
import { ArrowRight, MessageSquare, BookOpen } from "lucide-react";

/**
 * Veteran home. One primary action per screen: this week's check-in.
 * No notification badge counts. No streaks. No celebratory chrome.
 */
export default function VeteranHome() {
  // In a real implementation, these come from the session + DB.
  const veteran = { displayName: "Jordan", weekNumber: 7, checkInPending: true };
  const minutes = 5;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-caption text-ink-tertiary">Week {veteran.weekNumber} of 52</p>
        <h1 className="mt-1 text-display font-semibold text-ink-primary">
          Hi, {veteran.displayName}.
        </h1>
      </header>

      {veteran.checkInPending && (
        <Link
          href="/v/check-in"
          className="block rounded-lg border border-border bg-canvas-card p-6 transition-colors hover:bg-canvas-banded"
        >
          <p className="text-caption text-ink-tertiary">This week's check-in</p>
          <h2 className="mt-2 text-heading font-semibold text-ink-primary">
            About {minutes} minutes. Skip what you want.
          </h2>
          <p className="mt-2 text-body text-ink-secondary">
            Six short questions. You can stop anytime — what you've answered is saved.
          </p>
          <span className="mt-4 inline-flex items-center gap-2 text-body font-semibold text-primary">
            Start
            <ArrowRight className="h-4 w-4" aria-hidden />
          </span>
        </Link>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/v/messages"
          className="flex items-center gap-3 rounded-lg border border-border bg-canvas-card p-4 hover:bg-canvas-banded"
        >
          <MessageSquare className="h-5 w-5 text-ink-secondary" aria-hidden />
          <div>
            <div className="text-body font-semibold text-ink-primary">Messages</div>
            <div className="text-caption text-ink-tertiary">With your coordinator</div>
          </div>
        </Link>
        <Link
          href="/v/resources"
          className="flex items-center gap-3 rounded-lg border border-border bg-canvas-card p-4 hover:bg-canvas-banded"
        >
          <BookOpen className="h-5 w-5 text-ink-secondary" aria-hidden />
          <div>
            <div className="text-body font-semibold text-ink-primary">Resources</div>
            <div className="text-caption text-ink-tertiary">Local & national</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
