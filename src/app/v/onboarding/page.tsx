import Link from "next/link";
import { CrisisResourceBanner } from "@/components/sentinel/crisis-resource-banner";
import { Button } from "@/components/ui/button";

/**
 * Onboarding intro.
 *
 * Two real steps after this screen: consent (per-decision, versioned) and
 * profile (timezone, cadence, branch, optional emergency contact). The
 * layout-level gate in src/app/v/layout.tsx routes a veteran to whichever
 * step they haven't completed yet — so this index is informational only.
 */
const STEPS = [
  {
    n: 1,
    title: "Read each consent — one decision at a time.",
    body: "What we collect, how we use it, who sees it. Four explicit yes-or-no choices, not a wall of legal text.",
  },
  {
    n: 2,
    title: "Tell us when to ask.",
    body: "Pick your weekly check-in time and day. Add an emergency contact only if you want — it's optional.",
  },
  {
    n: 3,
    title: "Take your first check-in when you're ready.",
    body: "About five minutes. Six short questions. Skip anything. Drafts auto-save so you can stop and come back.",
  },
];

export default function OnboardingIntro() {
  return (
    <div className="space-y-6">
      <p className="text-caption uppercase tracking-wide text-ink-tertiary">Sentinel · Setup</p>
      <h1 className="text-balance text-display font-semibold text-ink-primary">
        A quiet, weekly check-in. A real human on the other end.
      </h1>
      <p className="text-body-lg text-ink-secondary">
        Setup takes about ten minutes. Stop whenever — we save your spot.
      </p>

      <ol className="space-y-3 rounded-lg border border-border bg-canvas-card p-5">
        {STEPS.map((s) => (
          <li key={s.n} className="flex items-start gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-canvas-banded text-caption font-semibold text-ink-secondary">
              {s.n}
            </span>
            <div>
              <h2 className="text-body font-semibold text-ink-primary">{s.title}</h2>
              <p className="mt-0.5 text-body text-ink-secondary">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <Button asChild size="lg" className="w-full justify-center sm:w-auto">
        <Link href="/v/onboarding/consent">Start</Link>
      </Button>

      <CrisisResourceBanner variant="full" />
    </div>
  );
}
