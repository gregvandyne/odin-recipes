import Link from "next/link";
import { CrisisResourceBanner } from "@/components/sentinel/crisis-resource-banner";
import { Button } from "@/components/ui/button";

/**
 * Onboarding & consent — the single most important screen.
 * One concept per screen. Plain language. Eighth-grade reading level.
 * Generous pacing. Trust signals throughout.
 */
const STEPS = [
  { slug: "welcome",    title: "Welcome" },
  { slug: "team",       title: "Your team" },
  { slug: "preview",    title: "What we'll ask" },
  { slug: "data",       title: "Where it goes" },
  { slug: "crisis",     title: "If you're in crisis" },
  { slug: "emergency",  title: "Emergency contact" },
  { slug: "consent",    title: "Consent" },
];

export default function OnboardingIntro() {
  return (
    <div className="space-y-6">
      <p className="text-caption text-ink-tertiary">Sentinel · Setup</p>
      <h1 className="text-balance text-display font-semibold text-ink-primary">
        A quiet, weekly check-in. A real human on the other end.
      </h1>
      <p className="text-body-lg text-ink-secondary">
        We take about ten minutes to walk you through how this works, what we
        collect, who sees it, and what happens if something looks off. You can
        stop and pick up where you left off whenever you want.
      </p>

      <ol className="space-y-2 rounded-lg border border-border bg-canvas-card p-4">
        {STEPS.map((s, i) => (
          <li key={s.slug} className="flex items-center gap-3">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-canvas-banded text-caption text-ink-secondary">
              {i + 1}
            </span>
            <span className="text-body text-ink-primary">{s.title}</span>
          </li>
        ))}
      </ol>

      <Button asChild size="lg">
        <Link href="/v/onboarding/team">Start</Link>
      </Button>

      <CrisisResourceBanner variant="full" />
    </div>
  );
}
