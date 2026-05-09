import Link from "next/link";
import { ArrowRight, ShieldCheck, Activity, Lock } from "lucide-react";
import { ThemeToggle } from "@/components/sentinel/theme-toggle";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas-veteran">
      {/* Soft, restrained background. Single muted gradient at low opacity.
          Calm, not marketing. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[60vh] opacity-50"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(59, 91, 126, 0.12), transparent 60%)",
        }}
      />

      <header className="relative z-10">
        <div className="container flex h-14 items-center justify-between">
          <span className="text-body font-semibold text-ink-primary">Sentinel</span>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/v" className="text-body text-ink-secondary hover:text-ink-primary">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="container relative z-10 max-w-3xl pt-20 pb-16">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-canvas-card/70 px-3 py-1 text-caption text-ink-secondary backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-risk-green" /> Built for the first year after separation
        </span>

        <h1 className="mt-6 text-balance text-[40px] font-semibold leading-[1.1] tracking-tight text-ink-primary sm:text-[52px]">
          A quiet, proactive line of support for veterans in their first year after separation.
        </h1>

        <p className="mt-6 max-w-2xl text-pretty text-body-lg text-ink-secondary">
          Five-minute weekly check-ins. Pattern recognition across stressor domains.
          A trained human reaches out when something shifts — before a crisis, not after.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/v"
            className="group inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-6 text-body font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Veteran sign-in
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
          <Link
            href="/coordinator"
            className="inline-flex h-12 items-center justify-center rounded-md border border-border bg-canvas-card px-6 text-body font-semibold text-ink-primary hover:bg-canvas-banded"
          >
            Coordinator sign-in
          </Link>
        </div>

        <div className="mt-20 grid gap-8 border-t border-border pt-12 sm:grid-cols-3">
          <Principle
            Icon={ShieldCheck}
            title="AI points. Humans solve."
            body="The system surfaces patterns. It never replies to veterans, never makes clinical decisions."
          />
          <Principle
            Icon={Activity}
            title="Trajectory over snapshot."
            body="Sudden change matters more than current state. Silence is also a signal."
          />
          <Principle
            Icon={Lock}
            title="Privacy is sacred."
            body="No advertising. No data sales. The veteran is never the product. Ever."
          />
        </div>
      </main>

      <footer className="relative z-10 border-t border-border">
        <div className="container flex flex-col items-start justify-between gap-2 py-6 sm:flex-row sm:items-center">
          <p className="text-caption text-ink-tertiary">© Sentinel. Operated under documented data-processing agreements.</p>
          <p className="text-caption text-ink-tertiary">
            In crisis?{" "}
            <a href="tel:988" className="font-semibold text-crisis hover:underline">
              Call 988, press 1
            </a>{" "}
            — Veterans Crisis Line, 24/7.
          </p>
        </div>
      </footer>
    </div>
  );
}

function Principle({
  Icon,
  title,
  body,
}: {
  Icon: typeof ShieldCheck;
  title: string;
  body: string;
}) {
  return (
    <div>
      <Icon className="h-5 w-5 text-ink-secondary" aria-hidden />
      <h2 className="mt-3 text-body-lg font-semibold text-ink-primary">{title}</h2>
      <p className="mt-2 text-body text-ink-secondary">{body}</p>
    </div>
  );
}
