import Link from "next/link";
import { ArrowRight, Phone } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

/**
 * Veteran home. One primary action per screen: this week's check-in.
 * No notification badge counts. No streaks. No celebratory chrome.
 */
export default function VeteranHome() {
  // In production, these come from session + DB.
  const veteran = { displayName: "Jordan", weekNumber: 7, checkInPending: true };
  const coordinator = { displayName: "Sam Kim", initials: "SK" };
  const minutes = 5;

  // Subtle progress dot for the year. Quiet, not gamified.
  const dotsTotal = 52;
  const dotsFilled = veteran.weekNumber;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-caption text-ink-tertiary">Week {veteran.weekNumber} of 52</p>
          <h1 className="mt-1 text-display font-semibold text-ink-primary">
            Hi, {veteran.displayName}.
          </h1>
        </div>
        <Link href="/v/profile" aria-label="Profile">
          <Avatar initials="JL" />
        </Link>
      </header>

      {/* Year-progress strip — quiet, calm, not gamified */}
      <div className="flex items-center gap-1" aria-hidden>
        {Array.from({ length: dotsTotal }).map((_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full ${i < dotsFilled ? "bg-ink-secondary/60" : "bg-border"}`}
          />
        ))}
      </div>

      {veteran.checkInPending && (
        <Link
          href="/v/check-in"
          className="group block rounded-xl border border-border bg-canvas-card p-6 transition-colors hover:bg-canvas-banded"
        >
          <p className="text-caption uppercase tracking-wide text-ink-tertiary">This week's check-in</p>
          <h2 className="mt-2 text-balance text-heading font-semibold text-ink-primary">
            About {minutes} minutes. Skip what you want.
          </h2>
          <p className="mt-2 text-body text-ink-secondary">
            Six short questions. You can stop anytime — what you've answered is saved.
          </p>
          <span className="mt-4 inline-flex items-center gap-2 text-body font-semibold text-primary">
            Start
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </Link>
      )}

      <Link
        href="/v/messages"
        className="flex items-center gap-3 rounded-lg border border-border bg-canvas-card p-4 hover:bg-canvas-banded"
      >
        <Avatar initials={coordinator.initials} size="md" />
        <div className="flex-1 min-w-0">
          <div className="text-body font-semibold text-ink-primary">{coordinator.displayName}</div>
          <div className="text-caption text-ink-tertiary">Your coordinator · usually replies same day</div>
        </div>
        <ArrowRight className="h-4 w-4 text-ink-tertiary" aria-hidden />
      </Link>

      <div className="rounded-lg border border-border bg-canvas-card p-4">
        <p className="text-caption uppercase tracking-wide text-ink-tertiary">If you need someone right now</p>
        <a
          href="tel:988"
          className="mt-2 inline-flex items-center gap-2 text-body-lg font-semibold text-crisis hover:underline"
        >
          <Phone className="h-4 w-4" aria-hidden />
          Call 988, press 1
        </a>
        <p className="mt-1 text-caption text-ink-secondary">
          Veterans Crisis Line · 24/7. You don't have to be in crisis to call.
        </p>
      </div>
    </div>
  );
}
