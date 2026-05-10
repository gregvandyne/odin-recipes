import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  Activity,
  Lock,
  CalendarClock,
  TrendingDown,
  Users,
  Stethoscope,
  Phone,
  Eye,
} from "lucide-react";
import { ThemeToggle } from "@/components/sentinel/theme-toggle";

/**
 * Public landing page.
 *
 * No mock data. Every statistic is attributed to a US Department of
 * Veterans Affairs or peer-reviewed source the reader can verify. Citation
 * marks resolve to the "Sources" block at the bottom of the page.
 *
 * The page is server-rendered and reads no session state. Above-the-fold
 * content is in the initial HTML so a poor-connection visitor sees real
 * value before any JavaScript hydrates.
 */

interface Stat {
  figure: string;
  reading: string;
  cite: string;
}

const STATS: Stat[] = [
  {
    figure: "17.6 / day",
    reading:
      "Average daily veteran suicides in the United States. After adjusting for age and sex, the veteran suicide rate is 57.3% higher than the non-veteran adult rate.",
    cite: "1",
  },
  {
    figure: "~200,000",
    reading:
      "Service members leave active duty each year. Most receive a few days of transition briefings — then little else.",
    cite: "2",
  },
  {
    figure: "First 12 months",
    reading:
      "Suicide risk is meaningfully elevated in the year following separation, and is highest in the first 90 days.",
    cite: "3",
  },
  {
    figure: "Many never seen",
    reading:
      "A large share of veterans who die by suicide had no recent VA health-care contact — meaning the existing safety net never gets the chance to act.",
    cite: "4",
  },
];

interface Gap {
  Icon: typeof Activity;
  title: string;
  problem: string;
  approach: string;
  cite?: string;
}

const GAPS: Gap[] = [
  {
    Icon: CalendarClock,
    title: "Help arrives after the crisis, not before it.",
    problem:
      "The dominant model is reactive: a veteran calls a hotline, walks into an ER, or asks for help. Many never do — stigma, distance from a VA, or simple uncertainty about whether what they're feeling 'counts.'",
    approach:
      "A five-minute weekly check-in. The veteran doesn't have to know they're in trouble for someone to notice a pattern shifting.",
  },
  {
    Icon: TrendingDown,
    title: "A point-in-time score misses what's actually happening.",
    problem:
      "Screening tools (PHQ-9, PCL-5) measure where someone is today. They miss the trajectory — and trajectory is what predicts harm.",
    approach:
      "Sentinel weighs change over time across nine domains (sleep, mood, connection, purpose, finance, relationships, housing, substance use, pain). A compound shift across two or three domains is a signal even when no single one is alarming.",
  },
  {
    Icon: Users,
    title: "AI tools speak directly to people — and shouldn't.",
    problem:
      "Plenty of mental-health products use a chatbot as the front line. For a veteran in distress, that's a category error.",
    approach:
      "Sentinel's AI never replies to veterans. It surfaces patterns to a trained human coordinator who decides what to do, when, and how.",
    cite: "5",
  },
  {
    Icon: Stethoscope,
    title: "Most clinical referrals come too late.",
    problem:
      "When a coordinator escalates to clinical care, the case has usually already grown teeth. Clinical leads waste capacity triaging instead of treating.",
    approach:
      "Coordinators see a real-time queue ordered by SLA, with explicit recommended actions. Clinical leads see only the cases coordinators couldn't resolve — with full context attached.",
  },
  {
    Icon: Eye,
    title: "Silence is also a signal.",
    problem:
      "Most check-in systems treat a missed week as a gap in data. It isn't — it's information about the veteran's life.",
    approach:
      "Two consecutive missed check-ins after a yellow week is a flag pattern in the engine. The system reaches out — quietly, by the veteran's preferred channel.",
  },
  {
    Icon: Lock,
    title: "Privacy isn't an afterthought.",
    problem:
      "Veterans have legitimate reasons to mistrust digital tools. Data sold to advertisers. Records shared with the wrong stakeholder. Reputational risk.",
    approach:
      "Field-level AES-256-GCM encryption on every PHI column. Postgres row-level security between organizations. Audit log on every state-changing action. No advertising. No data sales. Ever.",
  },
];

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas-veteran">
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
          <nav className="flex items-center gap-2" aria-label="Top">
            <Link
              href="#approach"
              className="hidden rounded px-2 py-1 text-body text-ink-secondary hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-block"
            >
              Approach
            </Link>
            <Link
              href="#sources"
              className="hidden rounded px-2 py-1 text-body text-ink-secondary hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-block"
            >
              Sources
            </Link>
            <ThemeToggle />
            <Link
              href="/auth/sign-in"
              className="rounded px-2 py-1 text-body text-ink-secondary hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        {/* HERO */}
        <section className="container max-w-3xl px-6 pb-16 pt-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-canvas-card/70 px-3 py-1 text-caption text-ink-secondary backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-risk-green" />
            Built for the first year after separation
          </span>

          <h1 className="mt-6 text-balance text-[40px] font-semibold leading-[1.1] tracking-tight text-ink-primary sm:text-[52px]">
            A quiet, proactive line of support for veterans in their first year after separation.
          </h1>

          <p className="mt-6 max-w-2xl text-pretty text-body-lg text-ink-secondary">
            Five-minute weekly check-ins. Pattern recognition across stressor domains. A trained
            human reaches out when something shifts — before a crisis, not after.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/auth/sign-in"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-6 text-body font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Sign in
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
            <Link
              href="#approach"
              className="inline-flex h-12 items-center justify-center rounded-md border border-border bg-canvas-card px-6 text-body font-semibold text-ink-primary hover:bg-canvas-banded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              See how it works
            </Link>
          </div>
        </section>

        {/* PROBLEM */}
        <section className="border-t border-border bg-canvas-card/40">
          <div className="container max-w-5xl px-6 py-16">
            <p className="text-caption uppercase tracking-wide text-ink-tertiary">
              The problem, in numbers
            </p>
            <h2 className="mt-2 max-w-3xl text-balance text-heading font-semibold text-ink-primary sm:text-[32px]">
              The transition from service is the loneliest point in many veterans' adult lives — and
              the existing safety net doesn't see most of them coming.
            </h2>

            <dl className="mt-10 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
              {STATS.map((s) => (
                <div key={s.figure} className="bg-canvas-card p-6">
                  <dt className="text-display font-semibold text-ink-primary">
                    {s.figure}
                    <sup className="ml-1 text-caption font-normal text-ink-tertiary">
                      <a
                        href={`#source-${s.cite}`}
                        className="rounded underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        [{s.cite}]
                      </a>
                    </sup>
                  </dt>
                  <dd className="mt-3 text-body text-ink-secondary">{s.reading}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-8 max-w-3xl text-body text-ink-secondary">
              Two of those numbers stack with the third. A large share of veterans who die by
              suicide haven't been seen by VA mental-health services in the last year, which means
              the most well-resourced safety net in the country never gets a chance to act. The
              first year after separation is when the gap between "I'm fine" and "I'm not" is
              widest — and the shortest distance to a trained human is the most important variable.
            </p>
          </div>
        </section>

        {/* APPROACH — six gaps, six design choices */}
        <section id="approach" className="border-t border-border">
          <div className="container max-w-5xl px-6 py-16">
            <p className="text-caption uppercase tracking-wide text-ink-tertiary">Our approach</p>
            <h2 className="mt-2 max-w-3xl text-balance text-heading font-semibold text-ink-primary sm:text-[32px]">
              Six gaps in the current model. Six explicit design choices.
            </h2>

            <div className="mt-10 space-y-4">
              {GAPS.map((g) => (
                <article
                  key={g.title}
                  className="rounded-lg border border-border bg-canvas-card p-6 sm:p-7"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-canvas-banded text-ink-secondary">
                      <g.Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <h3 className="text-body-lg font-semibold text-ink-primary">{g.title}</h3>
                  </div>
                  <div className="mt-5 grid gap-5 sm:grid-cols-2 sm:gap-8">
                    <div>
                      <p className="text-caption uppercase tracking-wide text-ink-tertiary">
                        The gap
                      </p>
                      <p className="mt-2 text-body text-ink-secondary">{g.problem}</p>
                    </div>
                    <div>
                      <p className="text-caption uppercase tracking-wide text-ink-tertiary">
                        How we address it
                      </p>
                      <p className="mt-2 text-body text-ink-primary">
                        {g.approach}
                        {g.cite && (
                          <sup className="ml-1 text-caption font-normal text-ink-tertiary">
                            <a
                              href={`#source-${g.cite}`}
                              className="rounded underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              [{g.cite}]
                            </a>
                          </sup>
                        )}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* PRINCIPLES */}
        <section className="border-t border-border bg-canvas-card/40">
          <div className="container max-w-5xl px-6 py-16">
            <p className="text-caption uppercase tracking-wide text-ink-tertiary">
              Principles that don't bend
            </p>
            <h2 className="mt-2 max-w-3xl text-balance text-heading font-semibold text-ink-primary sm:text-[32px]">
              The system is loud about what it won't do.
            </h2>
            <div className="mt-10 grid gap-8 sm:grid-cols-3">
              <Principle
                Icon={ShieldCheck}
                title="AI points. Humans solve."
                body="The system surfaces patterns. It never replies to veterans, never makes clinical decisions, never tries to be the person on the other end of the line."
              />
              <Principle
                Icon={Activity}
                title="Trajectory over snapshot."
                body="Sudden change matters more than current state. Silence is information. A missed check-in after a yellow week is a flag in the engine."
              />
              <Principle
                Icon={Lock}
                title="Privacy is sacred."
                body="Encrypted at the field level. Row-level security between organizations. Audit log on every action. No advertising. No data sales. Ever."
              />
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="border-t border-border">
          <div className="container max-w-5xl px-6 py-16">
            <p className="text-caption uppercase tracking-wide text-ink-tertiary">
              How it works in 52 weeks
            </p>
            <h2 className="mt-2 max-w-3xl text-balance text-heading font-semibold text-ink-primary sm:text-[32px]">
              Boring on purpose.
            </h2>

            <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <Step
                n={1}
                title="Sign up once."
                body="Five minutes. Consent is per-decision, not all-or-nothing. The veteran controls what's shared."
              />
              <Step
                n={2}
                title="Weekly five-minute check-in."
                body="Six short questions on a calm, distraction-free screen. Skip anything. Stop anytime. Drafts auto-save."
              />
              <Step
                n={3}
                title="The system watches for pattern shifts."
                body="A risk engine weighs each check-in across nine domains against the veteran's own four-week baseline. Trajectory, not absolute scores."
              />
              <Step
                n={4}
                title="A trained human reaches out — quietly."
                body="Their coordinator gets the right amount of context: what shifted, when, and a recommended action. No alarm-bell language. No clinical decisions made by software."
              />
            </ol>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border bg-canvas-card/40">
          <div className="container max-w-3xl px-6 py-16 text-center">
            <h2 className="text-balance text-heading font-semibold text-ink-primary sm:text-[32px]">
              If you run a transition program, a cohort, or a clinic — we want to hear from you.
            </h2>
            <p className="mt-4 text-body text-ink-secondary">
              Sentinel runs as a multi-tenant program managed by your team, with your coordinators
              and your clinical leads. We charge a flat per-cohort fee.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href="mailto:hello@sentinel.health?subject=Pilot%20interest"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-6 text-body font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Request a pilot
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
              <Link
                href="/auth/sign-in"
                className="inline-flex h-12 items-center justify-center rounded-md border border-border bg-canvas-card px-6 text-body font-semibold text-ink-primary hover:bg-canvas-banded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Sign in
              </Link>
            </div>
            <p className="mt-6 text-caption text-ink-tertiary">
              We do not sell, share, or monetize veteran data — under any circumstance.
            </p>
          </div>
        </section>

        {/* SOURCES */}
        <section id="sources" className="border-t border-border">
          <div className="container max-w-5xl px-6 py-16">
            <p className="text-caption uppercase tracking-wide text-ink-tertiary">Sources</p>
            <h2 className="mt-2 text-heading font-semibold text-ink-primary">
              Numbers we cite, and where they came from.
            </h2>
            <ol className="mt-8 space-y-4">
              <Source
                n={1}
                summary="17.6 daily veteran suicides; veteran rate 57.3% higher than non-veterans (age- and sex-adjusted)."
                citation="US Department of Veterans Affairs Office of Mental Health and Suicide Prevention, 2023 National Veteran Suicide Prevention Annual Report (data through 2021)."
                href="https://www.mentalhealth.va.gov/suicide_prevention/data.asp"
              />
              <Source
                n={2}
                summary="Approximately 200,000+ service members leave active duty annually."
                citation="US Department of Defense reporting; reflected in repeated US Government Accountability Office reviews of transition assistance."
                href="https://www.gao.gov/products/gao-22-104889"
              />
              <Source
                n={3}
                summary="Elevated suicide risk in the first year post-separation, highest in the first 90 days."
                citation="Shen et al., 'Time-Varying Associations of Suicide With Deployments, Mental Health Conditions, and Stressful Life Events Among Current and Former US Military Personnel,' JAMA Psychiatry, 2016; consistent with longitudinal VA cohort data."
                href="https://jamanetwork.com/journals/jamapsychiatry/fullarticle/2469545"
              />
              <Source
                n={4}
                summary="A large share of veterans who died by suicide had no recent VA health-care contact."
                citation="VA Office of Mental Health and Suicide Prevention, National Veteran Suicide Prevention Annual Reports (recurring finding across annual cohorts)."
                href="https://www.mentalhealth.va.gov/suicide_prevention/data.asp"
              />
              <Source
                n={5}
                summary="Limits and risks of consumer-facing mental-health chatbots."
                citation="American Psychological Association advisory framework on AI-mediated mental-health tools; see also De Choudhury et al. on the limits of conversational AI in mental-health settings."
                href="https://www.apa.org/practice/artificial-intelligence-mental-health-care"
              />
            </ol>
            <p className="mt-8 text-caption text-ink-tertiary">
              Numbers shift year to year; we update this page when the VA publishes a new annual
              report. The point isn't a single statistic — it's the shape of the gap.
            </p>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border">
        <div className="container flex flex-col items-start justify-between gap-2 px-6 py-6 sm:flex-row sm:items-center">
          <p className="text-caption text-ink-tertiary">
            © Sentinel. Operated under documented data-processing agreements.
          </p>
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
      <h3 className="mt-3 text-body-lg font-semibold text-ink-primary">{title}</h3>
      <p className="mt-2 text-body text-ink-secondary">{body}</p>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="flex gap-4">
      <span
        aria-hidden
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-canvas-card text-body font-semibold text-ink-primary"
      >
        {n}
      </span>
      <div>
        <h3 className="text-body-lg font-semibold text-ink-primary">{title}</h3>
        <p className="mt-1.5 text-body text-ink-secondary">{body}</p>
      </div>
    </li>
  );
}

function Source({
  n,
  summary,
  citation,
  href,
}: {
  n: number;
  summary: string;
  citation: string;
  href: string;
}) {
  return (
    <li id={`source-${n}`} className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
      <span className="font-mono text-caption text-ink-tertiary">[{n}]</span>
      <div className="text-body text-ink-secondary">
        <p className="text-ink-primary">{summary}</p>
        <p className="mt-1 text-caption">
          {citation}{" "}
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded text-ink-secondary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Source ↗
          </a>
        </p>
      </div>
    </li>
  );
}
