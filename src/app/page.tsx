import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-canvas-veteran">
      <div className="container max-w-3xl py-24">
        <p className="text-caption uppercase tracking-wide text-ink-tertiary">Sentinel</p>
        <h1 className="mt-3 text-balance text-display font-semibold text-ink-primary">
          A quiet, proactive line of support for veterans in their first year after separation.
        </h1>
        <p className="mt-6 text-body-lg text-ink-secondary">
          Five-minute weekly check-ins. Pattern recognition across stressor domains.
          A trained human reaches out when something shifts — before a crisis, not after.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/v"
            className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-6 text-body font-semibold text-primary-foreground hover:bg-primary-hover"
          >
            Veteran sign-in
          </Link>
          <Link
            href="/coordinator"
            className="inline-flex h-12 items-center justify-center rounded-md border border-border px-6 text-body font-semibold text-ink-primary hover:bg-canvas-banded"
          >
            Coordinator sign-in
          </Link>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          <Principle
            title="AI points. Humans solve."
            body="The system surfaces patterns. It never replies to veterans, never makes clinical decisions."
          />
          <Principle
            title="Trajectory over snapshot."
            body="Sudden change matters more than current state. Silence is also a signal."
          />
          <Principle
            title="Privacy is sacred."
            body="No advertising. No data sales. The veteran is never the product. Ever."
          />
        </div>

        <p className="mt-16 text-caption text-ink-tertiary">
          In crisis?{" "}
          <a href="tel:988" className="font-semibold text-crisis hover:underline">
            Call 988, press 1
          </a>{" "}
          — Veterans Crisis Line, available 24/7.
        </p>
      </div>
    </main>
  );
}

function Principle({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h2 className="text-body-lg font-semibold text-ink-primary">{title}</h2>
      <p className="mt-2 text-body text-ink-secondary">{body}</p>
    </div>
  );
}
