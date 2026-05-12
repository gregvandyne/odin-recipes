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
  Eye,
  User as UserIcon,
  Heart,
  ClipboardList,
} from "lucide-react";
import { LaptopFrame, PhoneFrame } from "@/components/marketing/device-frame";
import { Reveal, CountUp } from "@/components/marketing/motion";
import { StickyNav, MobileBottomDock } from "@/components/marketing/sticky-nav";
import { ThemeToggle } from "@/components/sentinel/theme-toggle";

/**
 * Public landing page.
 *
 * Three explicit audiences — veterans, coordinators, military families —
 * each routed from the hero into its own deep-dive panel + FAQ. The
 * problem-statement and approach sections stay shared because the
 * underlying analysis applies to all three.
 *
 * No mock data. Every statistic resolves to a citation in the Sources
 * block; every cited source has an outbound link. Server-rendered; reads
 * no session state.
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

interface Audience {
  id: "veteran" | "coordinator" | "family";
  Icon: typeof UserIcon;
  eyebrow: string;
  title: string;
  body: string[];
  commitments: string[];
  ctaLabel: string;
  ctaHref: string;
}

const AUDIENCES: Audience[] = [
  {
    id: "veteran",
    Icon: UserIcon,
    eyebrow: "If you're a veteran",
    title: "Someone's watching. Quietly. On purpose.",
    body: [
      "Once a week, five minutes. Six short questions on a screen designed to leave you alone. Skip what you want. Stop when you want.",
      "If something in the pattern shifts — sleep, mood, money, the way you're describing things — a trained human reaches out. Not a bot. Not a hotline you have to call first. A coordinator who already knows what changed.",
      "Your answers are yours. We don't sell them, share them, or surface them to anyone except your assigned coordinator. Ever.",
    ],
    commitments: [
      "Five minutes a week, not five hours.",
      "A real human reaches out — never a chatbot.",
      "Nothing shared with the VA, an employer, or family unless you ask.",
      "988 is one tap away, anytime.",
    ],
    ctaLabel: "What it's like",
    ctaHref: "#veteran-faq",
  },
  {
    id: "coordinator",
    Icon: ClipboardList,
    eyebrow: "If you're a coordinator",
    title: "A queue that's already triaged.",
    body: [
      "You log in to a list ordered by SLA. The top is what genuinely needs you today — not a wall of low-signal data.",
      "Every row carries the context you'd otherwise have to assemble: trajectory across nine domains, recent contacts, what the veteran said in their own words, and a recommended action.",
      "The AI does pattern recognition. You make the calls. We don't think that order should ever reverse — and we've designed the product so it can't.",
    ],
    commitments: [
      "Built around a caseload of ~30 active veterans.",
      "Live queue with SLA countdowns; no manual re-checking.",
      "AI-assist for outbound drafts — never sends without your review.",
      "Out-of-office and coverage routing handled automatically.",
    ],
    ctaLabel: "Coordinator roles",
    ctaHref: "mailto:hello@sentinel.health?subject=Coordinator%20interest",
  },
  {
    id: "family",
    Icon: Heart,
    eyebrow: "If you're a military family member",
    title: "You see them more than anyone.",
    body: [
      "Spouses, parents, siblings — you're often the first to notice something's shifted. And you're often stuck between not wanting to overstep and not wanting to wait too long.",
      "Sentinel doesn't replace your role. It gives them a low-friction line to a trained human who isn't you, and gives you a way to know that line exists.",
      "If your veteran enrolls and consents, you can be designated as the person we reach out to if they go quiet during a flagged week. They control that. So do you.",
    ],
    commitments: [
      "You only see what they explicitly let you see.",
      "You can opt to be reached if something's escalating.",
      "A short reading list for what's normal post-separation — and what isn't.",
      "988 is for you too. You don't need to be in crisis to call.",
    ],
    ctaLabel: "How to get them in",
    ctaHref: "mailto:hello@sentinel.health?subject=Family%20member%20inquiry",
  },
];

interface FaqGroup {
  audience: Audience["id"];
  heading: string;
  items: { q: string; a: string }[];
}

const FAQS: FaqGroup[] = [
  {
    audience: "veteran",
    heading: "Veteran FAQ",
    items: [
      {
        q: "What's the catch?",
        a: "There isn't one. The partner organization running your program pays a flat per-cohort fee. You don't see ads, you don't pay anything, and your data is not the product.",
      },
      {
        q: "Who actually sees what I write?",
        a: "Your assigned coordinator. Nobody else by default. A clinical lead can read a thread only during an active escalation that you and your coordinator know about. Program managers see metrics, not your words.",
      },
      {
        q: "What if I skip a week?",
        a: "Missing one week is fine. After a missed check-in following a yellow week, your coordinator gets a gentle note to reach out. We don't punish skipping; we treat it as information.",
      },
      {
        q: "What if I want out?",
        a: "Withdraw any time from your account settings. Your VA benefits, employment, and any external care are not affected. We retain the audit trail of the withdrawal itself; everything else follows the org's retention policy.",
      },
      {
        q: "Is this clinical care?",
        a: "No. Sentinel is care navigation and proactive outreach. If something is clinical — therapy, medication, diagnosis — your coordinator helps you connect with the right person. That person is never an AI.",
      },
    ],
  },
  {
    audience: "coordinator",
    heading: "Coordinator FAQ",
    items: [
      {
        q: "What does a typical day look like?",
        a: "Open the queue. The top rows have countdown timers. Three to six outreach contacts during the shift — phone, text, or in-app message. Log each contact. Acknowledge or resolve flags as you go. Escalate to clinical when uncertain.",
      },
      {
        q: "What's the caseload?",
        a: "We size around 25–35 active veterans per full-time coordinator. Risk-stratified — high-touch cases get more weight than stable ones.",
      },
      {
        q: "Do I need a clinical license?",
        a: "Not for the coordinator role. Trained peer specialists are our preferred profile. Clinical leads (LCSW, LMFT, psychologist, psychiatrist) hold the escalation queue and provide consultation.",
      },
      {
        q: "What does the AI actually do?",
        a: "Three things. (1) Flag patterns in check-ins. (2) Summarize what's changed across your caseload at the start of your shift. (3) Draft outbound messages for your review. It does not send anything, ever, without you.",
      },
      {
        q: "What about OOO?",
        a: "Schedule it in /account/ooo. Coverage routing is automatic — new flags during your block go to the coordinator you designate, with a PM fallback if you didn't.",
      },
    ],
  },
  {
    audience: "family",
    heading: "Family-member FAQ",
    items: [
      {
        q: "I'm worried about a veteran right now. What do I do?",
        a: "Call 988 and press 1. That's the Veterans Crisis Line. They're trained for what you're carrying and will help you figure out the next step. You do not need to be in crisis yourself to call — concerned family members are explicitly welcomed.",
      },
      {
        q: "Can I enroll my veteran without them knowing?",
        a: "No. Sentinel is consent-based and the veteran has to enroll themselves. What you can do is point them at it — and at the partner program running the cohort in their region.",
      },
      {
        q: "What can I see if my veteran enrolls me as a family contact?",
        a: "The minimum: that they're enrolled, that there's a coordinator assigned, and the coordinator's name and contact info. You don't see check-in answers, flag history, or messages unless your veteran specifically chooses to share something.",
      },
      {
        q: "What happens if they go silent?",
        a: "If your veteran has designated you as the emergency contact and consented, we may reach out to you during a flagged silence window. They can change that designation at any time.",
      },
      {
        q: "Is there anything for the family member, too?",
        a: "A short, plain-language reading list on what's typical for the first year post-separation, when to be concerned, and what to do. We don't currently run a parallel program for family members; that's on the roadmap.",
      },
    ],
  },
];

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas-veteran">
      {/* Aurora — three overlapping radials, restrained, contained to the top
          third. The dark variant inherits darker amber tones via .dark .hero-aurora. */}
      <div
        aria-hidden
        className="hero-aurora pointer-events-none absolute inset-x-0 top-0 h-[680px]"
      />

      <StickyNav />

      <main className="relative z-10">
        {/* HERO */}
        <section className="hero-warm">
          <div className="container max-w-6xl px-6 pb-16 pt-12 sm:pt-16 lg:pb-24">
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              {/* LEFT — text */}
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-canvas-card/70 px-3 py-1 text-caption text-ink-secondary shadow-soft backdrop-blur">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-risk-green" />
                  Built for the first year after separation
                </span>

                <h1 className="mt-7 text-balance font-serif text-[42px] font-normal leading-[1.05] tracking-[-0.02em] text-ink-primary sm:text-[52px] lg:text-[56px]">
                  A quiet, proactive line of support for veterans in their first year after separation.
                </h1>

                <p className="mt-6 max-w-xl text-pretty text-body-lg text-ink-secondary">
                  Five-minute weekly check-ins. Pattern recognition across stressor domains. A trained
                  human reaches out when something shifts — before a crisis, not after.
                </p>

                <div className="mt-8 flex flex-wrap gap-2">
                  <AudienceChip href="#veteran" label="Veteran" dot="bg-risk-green" />
                  <AudienceChip href="#coordinator" label="Coordinator" dot="bg-primary" />
                  <AudienceChip href="#family" label="Family member" dot="bg-risk-yellow" />
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/auth/sign-in"
                    className="group inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-body font-semibold text-primary-foreground shadow-warm transition-all hover:-translate-y-px hover:bg-primary-hover hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    Sign in
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                  <Link
                    href="#approach"
                    className="inline-flex h-12 items-center justify-center rounded-lg border border-border bg-canvas-card/80 px-6 text-body font-semibold text-ink-primary backdrop-blur transition-all hover:-translate-y-px hover:border-border-strong hover:bg-canvas-card hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    See how it works
                  </Link>
                </div>
              </div>

              {/* RIGHT — composed product scene. No Reveal here so it renders
                  on first paint instead of waiting for IntersectionObserver. */}
              <div className="relative">
                {/* Laptop tilted slightly right to feel composed, not flat */}
                <div className="lg:translate-x-4">
                  <LaptopFrame
                    src="/marketing/product-coordinator-queue.png"
                    alt="Coordinator triage queue with one Outreach overdue and two Watch flags."
                    width={760}
                    priority
                  />
                </div>
                {/* Phone tucked in lower-left, overlapping the laptop. Hidden
                    on the narrowest screens because there's no room for it. */}
                <div className="pointer-events-none absolute -bottom-6 -left-4 hidden w-[180px] sm:block sm:-left-8 sm:w-[200px] lg:-left-10 lg:-bottom-10 lg:w-[224px]">
                  <PhoneFrame
                    src="/marketing/product-veteran-home.png"
                    alt="Veteran home screen showing 'Hi, Marcus. About 5 minutes.'"
                    width={224}
                    priority
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* THREE AUDIENCES */}
        <section id="audiences" className="border-t border-border bg-canvas-card/40">
          <div className="container max-w-6xl px-6 py-24">
            <p className="text-caption uppercase tracking-wide text-ink-tertiary">Who it's for</p>
            <h2 className="mt-3 max-w-3xl text-balance font-serif text-[28px] font-normal leading-[1.2] tracking-[-0.015em] text-ink-primary sm:text-[40px]">
              Three audiences. Three commitments. Same program.
            </h2>
            <p className="mt-3 max-w-3xl text-body text-ink-secondary">
              The same software shows up differently depending on which side of it you're on. Pick
              your angle.
            </p>

            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {AUDIENCES.map((a, i) => (
                <Reveal key={a.id} delay={i * 0.08}>
                <article
                  id={a.id}
                  className="flex h-full flex-col rounded-xl border border-border bg-canvas-card p-7 shadow-soft transition-all hover:-translate-y-1 hover:shadow-warm sm:p-8"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-canvas-banded text-ink-secondary ring-1 ring-border">
                    <a.Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <p className="mt-4 text-caption uppercase tracking-wide text-ink-tertiary">{a.eyebrow}</p>
                  <h3 className="mt-2 font-serif text-[22px] font-normal leading-tight text-ink-primary">{a.title}</h3>
                  <div className="mt-3 space-y-3 text-body text-ink-secondary">
                    {a.body.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                  <ul className="mt-5 space-y-1.5 border-t border-border pt-4 text-body text-ink-primary">
                    {a.commitments.map((c) => (
                      <li key={c} className="flex gap-2">
                        <span aria-hidden className="text-ink-tertiary">·</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6">
                    <a
                      href={a.ctaHref}
                      className="inline-flex items-center gap-1 text-body font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                    >
                      {a.ctaLabel}
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </a>
                  </div>
                </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* PROBLEM */}
        <section className="border-t border-border">
          <div className="container max-w-5xl px-6 py-24">
            <p className="text-caption uppercase tracking-wide text-ink-tertiary">The problem, in numbers</p>
            <h2 className="mt-3 max-w-3xl text-balance font-serif text-[28px] font-normal leading-[1.2] tracking-[-0.015em] text-ink-primary sm:text-[40px]">
              The transition from service is the loneliest point in many veterans' adult lives — and
              the existing safety net doesn't see most of them coming.
            </h2>

            <Reveal>
            <dl className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border shadow-soft sm:grid-cols-2">
              {STATS.map((s) => (
                <div key={s.figure} className="bg-canvas-card p-8">
                  <dt className="font-serif text-[40px] font-normal leading-[1.05] tracking-[-0.02em] text-ink-primary sm:text-[48px]">
                    <CountUp value={s.figure} />
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
            </Reveal>

            <p className="mt-8 max-w-3xl text-body text-ink-secondary">
              Two of those numbers stack with the third. A large share of veterans who die by
              suicide haven't been seen by VA mental-health services in the last year, which means
              the most well-resourced safety net in the country never gets a chance to act. The
              first year after separation is when the gap between "I'm fine" and "I'm not" is
              widest — and the shortest distance to a trained human is the most important variable.
            </p>
          </div>
        </section>

        {/* APPROACH */}
        <section id="approach" className="border-t border-border bg-canvas-card/40">
          <div className="container max-w-5xl px-6 py-24">
            <p className="text-caption uppercase tracking-wide text-ink-tertiary">Our approach</p>
            <h2 className="mt-3 max-w-3xl text-balance font-serif text-[28px] font-normal leading-[1.2] tracking-[-0.015em] text-ink-primary sm:text-[40px]">
              Six gaps in the current model. Six explicit design choices.
            </h2>

            <div className="mt-10 space-y-4">
              {GAPS.map((g, i) => (
                <Reveal key={g.title} delay={Math.min(i, 3) * 0.05}>
                <article className="rounded-xl border border-border bg-canvas-card p-7 shadow-soft transition-all hover:-translate-y-px hover:shadow-warm sm:p-8">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-canvas-banded text-ink-secondary ring-1 ring-border">
                      <g.Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <h3 className="font-serif text-[22px] font-normal leading-tight text-ink-primary">{g.title}</h3>
                  </div>
                  <div className="mt-5 grid gap-5 sm:grid-cols-2 sm:gap-8">
                    <div>
                      <p className="text-caption uppercase tracking-wide text-ink-tertiary">The gap</p>
                      <p className="mt-2 text-body text-ink-secondary">{g.problem}</p>
                    </div>
                    <div>
                      <p className="text-caption uppercase tracking-wide text-ink-tertiary">How we address it</p>
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
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* PRINCIPLES */}
        <section className="border-t border-border">
          <div className="container max-w-5xl px-6 py-24">
            <p className="text-caption uppercase tracking-wide text-ink-tertiary">Principles that don't bend</p>
            <h2 className="mt-3 max-w-3xl text-balance font-serif text-[28px] font-normal leading-[1.2] tracking-[-0.015em] text-ink-primary sm:text-[40px]">
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
        <section className="border-t border-border bg-canvas-card/40">
          <div className="container max-w-5xl px-6 py-24">
            <p className="text-caption uppercase tracking-wide text-ink-tertiary">How it works in 52 weeks</p>
            <h2 className="mt-3 max-w-3xl text-balance font-serif text-[28px] font-normal leading-[1.2] tracking-[-0.015em] text-ink-primary sm:text-[40px]">
              Boring on purpose.
            </h2>

            <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <Step n={1} title="Sign up once." body="Five minutes. Consent is per-decision, not all-or-nothing. The veteran controls what's shared." />
              <Step n={2} title="Weekly five-minute check-in." body="Six short questions on a calm, distraction-free screen. Skip anything. Stop anytime. Drafts auto-save." />
              <Step n={3} title="The system watches for pattern shifts." body="A risk engine weighs each check-in across nine domains against the veteran's own four-week baseline. Trajectory, not absolute scores." />
              <Step n={4} title="A trained human reaches out — quietly." body="The coordinator gets the right amount of context: what shifted, when, and a recommended action. No alarm-bell language. No clinical decisions made by software." />
            </ol>
          </div>
        </section>

        {/* PRODUCT GALLERY — show the real surfaces */}
        <section id="product" className="border-t border-border">
          <div className="container max-w-6xl px-6 py-24">
            <p className="text-caption uppercase tracking-wide text-ink-tertiary">A look at the product</p>
            <h2 className="mt-3 max-w-3xl text-balance font-serif text-[28px] font-normal leading-[1.2] tracking-[-0.015em] text-ink-primary sm:text-[40px]">
              The actual screens. No glossy mockups.
            </h2>
            <p className="mt-4 max-w-2xl text-body text-ink-secondary">
              Every shot below is the live product, captured from the same build a real cohort
              uses.
            </p>

            <div className="mt-12 grid items-end gap-10 sm:grid-cols-2 lg:grid-cols-3">
              <ProductCallout
                eyebrow="Veteran · weekly check-in"
                title="One question at a time."
                body="A calm screen, plain language, no scoring shown back. Skip what you want; stop anytime; drafts auto-save."
              >
                <PhoneFrame
                  src="/marketing/product-veteran-checkin.png"
                  alt="Check-in question: 'On most nights this week, about how many hours did you sleep?'"
                  width={260}
                />
              </ProductCallout>
              <ProductCallout
                eyebrow="Veteran · home"
                title="What this week is about."
                body="Your coordinator's name. The 988 line one tap away. A reminder of what they see — and what they don't."
              >
                <PhoneFrame
                  src="/marketing/product-veteran-home.png"
                  alt="Veteran home — week 10 of 52, 5-minute check-in card, coordinator card, crisis line card."
                  width={260}
                />
              </ProductCallout>
              <ProductCallout
                eyebrow="Veteran · trends"
                title="Trajectory, not a score."
                body="The same nine domains the engine watches — but read in plain words instead of numbers. You see what your coordinator sees."
              >
                <PhoneFrame
                  src="/marketing/product-veteran-trends.png"
                  alt="Veteran trends — domain readings with plain-language summaries."
                  width={260}
                />
              </ProductCallout>
            </div>

            <div className="mt-16 grid items-center gap-10 lg:grid-cols-2">
              <div>
                <p className="text-caption uppercase tracking-wide text-ink-tertiary">Coordinator · triage queue</p>
                <h3 className="mt-3 font-serif text-[26px] font-normal leading-tight text-ink-primary sm:text-[30px]">
                  A queue that already knows where to look.
                </h3>
                <p className="mt-4 text-body text-ink-secondary">
                  Veterans are ordered by SLA — the row at the top is the call to make next. Each
                  row carries the context a coordinator would otherwise have to assemble: which
                  domain shifted, when, what the veteran said in their own words, and the
                  recommended timeframe.
                </p>
                <ul className="mt-5 space-y-2 text-body text-ink-secondary">
                  <li className="flex gap-3">
                    <span aria-hidden className="mt-2 h-1.5 w-1.5 rounded-full bg-risk-orange" />
                    <span><strong className="text-ink-primary">Outreach</strong> — single-domain drift past the watch threshold. 24-hour window.</span>
                  </li>
                  <li className="flex gap-3">
                    <span aria-hidden className="mt-2 h-1.5 w-1.5 rounded-full bg-risk-yellow" />
                    <span><strong className="text-ink-primary">Watch</strong> — a softer flag with a longer window. Same context, more time.</span>
                  </li>
                  <li className="flex gap-3">
                    <span aria-hidden className="mt-2 h-1.5 w-1.5 rounded-full bg-risk-red" />
                    <span><strong className="text-ink-primary">Immediate</strong> — explicit risk language, or a compounding pattern. Same screen, top of the list.</span>
                  </li>
                </ul>
              </div>
              <LaptopFrame
                src="/marketing/product-coordinator-queue.png"
                alt="Coordinator queue with three veterans: one Outreach overdue, two Watch with hours remaining. Real-time updates indicator at the top."
                width={900}
              />
            </div>

            <div className="mt-16 grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              {/* Composed scene: coordinator laptop + the matching veteran
                  trends phone tucked into the corner. Same domains, two
                  viewpoints — what the coordinator sees vs. what the veteran
                  sees back. */}
              <div className="relative lg:order-1">
                <div className="lg:-translate-x-2">
                  <LaptopFrame
                    src="/marketing/product-coordinator-veteran.png"
                    alt="Per-veteran coordinator timeline showing domain sparklines, recent flags, recommended next action, contact log."
                    width={900}
                  />
                </div>
                <div className="pointer-events-none absolute -bottom-6 -right-2 hidden w-[170px] sm:block sm:-right-4 sm:w-[190px] lg:-bottom-10 lg:-right-6 lg:w-[210px]">
                  <PhoneFrame
                    src="/marketing/product-veteran-trends.png"
                    alt="Veteran trends view — the same nine domains in plain language on the veteran's own phone."
                    width={210}
                  />
                </div>
              </div>
              <div className="lg:order-2">
                <p className="text-caption uppercase tracking-wide text-ink-tertiary">Coordinator · per-veteran timeline</p>
                <h3 className="mt-3 font-serif text-[26px] font-normal leading-tight text-ink-primary sm:text-[30px]">
                  Twelve weeks at a glance. No clinical jargon.
                </h3>
                <p className="mt-4 text-body text-ink-secondary">
                  Nine domain sparklines side by side, the veteran's own words from recent
                  check-ins, every contact you've already logged, and the engine's recommended
                  next action — all on one screen. Built so a coordinator who just came back
                  from leave can be useful in under a minute.
                </p>
                <p className="mt-3 text-body text-ink-secondary">
                  The veteran sees the same domains in their own trends view — plain language,
                  no scoring. Same reality, two viewpoints.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ BY AUDIENCE */}
        <section className="border-t border-border">
          <div className="container max-w-5xl px-6 py-24">
            <p className="text-caption uppercase tracking-wide text-ink-tertiary">Frequently asked</p>
            <h2 className="mt-3 max-w-3xl text-balance font-serif text-[28px] font-normal leading-[1.2] tracking-[-0.015em] text-ink-primary sm:text-[40px]">
              The questions that come up most often — answered by audience.
            </h2>

            <div className="mt-10 space-y-12">
              {FAQS.map((group) => (
                <div key={group.audience} id={`${group.audience}-faq`}>
                  <h3 className="font-serif text-[22px] font-normal leading-tight text-ink-primary">{group.heading}</h3>
                  <dl className="mt-4 divide-y divide-border rounded-xl border border-border bg-canvas-card shadow-soft">
                    {group.items.map((it) => (
                      <details key={it.q} className="group p-5">
                        <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-body font-semibold text-ink-primary marker:hidden">
                          <span>{it.q}</span>
                          <span aria-hidden className="text-ink-tertiary transition-transform group-open:rotate-45">+</span>
                        </summary>
                        <p className="mt-3 text-body text-ink-secondary">{it.a}</p>
                      </details>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA — three audience paths */}
        <section className="border-t border-border bg-canvas-card/40">
          <div className="container max-w-5xl px-6 py-24">
            <p className="text-caption uppercase tracking-wide text-ink-tertiary">Get in touch</p>
            <h2 className="mt-3 max-w-3xl text-balance font-serif text-[28px] font-normal leading-[1.2] tracking-[-0.015em] text-ink-primary sm:text-[40px]">
              Pick the path that fits.
            </h2>

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              <CtaCard
                title="Veterans"
                body="If you've already been invited by a program, sign in. If you'd like to find out whether your transition program is partnered with us, ask your coordinator or write to us."
                actionLabel="Sign in"
                actionHref="/auth/sign-in"
                secondaryLabel="Ask if my program is partnered"
                secondaryHref="mailto:hello@sentinel.health?subject=Is%20my%20program%20partnered"
              />
              <CtaCard
                title="Coordinators"
                body="We're hiring trained peer specialists. If you've held a similar role at a VA, transition-assistance program, or veterans' nonprofit, we want to talk."
                actionLabel="Apply"
                actionHref="mailto:hello@sentinel.health?subject=Coordinator%20interest"
              />
              <CtaCard
                title="Family members"
                body="The single most useful thing you can do for a veteran you're worried about is hand them this page. We don't enroll people without their consent — and we don't pretend the answer is software alone."
                actionLabel="Share with my veteran"
                actionHref="mailto:?subject=Sentinel&body=Thought%20you%20might%20want%20to%20look%20at%20this:%20https%3A%2F%2Fsentinel.health%2F"
                secondaryLabel="Reach out directly"
                secondaryHref="mailto:hello@sentinel.health?subject=Family%20member%20inquiry"
              />
            </div>

            <div className="mt-12 rounded-xl border border-border bg-canvas-card p-7 shadow-soft transition-shadow hover:shadow-warm sm:p-8">
              <p className="text-caption uppercase tracking-wide text-ink-tertiary">
                For transition programs, clinics, and cohort sponsors
              </p>
              <p className="mt-2 text-body text-ink-primary">
                Sentinel runs as a multi-tenant program managed by your team, with your
                coordinators and your clinical leads. We charge a flat per-cohort fee.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <a
                  href="mailto:hello@sentinel.health?subject=Pilot%20interest"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-body font-semibold text-primary-foreground shadow-warm transition-all hover:bg-primary-hover hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Request a pilot
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </a>
                <Link
                  href="#approach"
                  className="inline-flex h-12 items-center justify-center rounded-lg border border-border bg-canvas-card px-6 text-body font-semibold text-ink-primary transition-all hover:border-border-strong hover:bg-canvas-banded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  See the approach
                </Link>
              </div>
            </div>
            <p className="mt-6 text-caption text-ink-tertiary">
              We do not sell, share, or monetize veteran data — under any circumstance.
            </p>
          </div>
        </section>

        {/* SOURCES */}
        <section id="sources" className="border-t border-border">
          <div className="container max-w-5xl px-6 py-24">
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

      <MobileBottomDock />
    </div>
  );
}

function AudienceChip({ href, label, dot }: { href: string; label: string; dot?: string }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2 rounded-full border border-border/60 bg-canvas-card/50 px-3.5 py-1.5 text-caption font-semibold text-ink-secondary backdrop-blur transition-all hover:-translate-y-px hover:border-border-strong hover:bg-canvas-card hover:text-ink-primary hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {dot && <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
      {label}
      <ArrowRight className="h-3 w-3 opacity-50 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden />
    </Link>
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
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-canvas-card text-primary shadow-soft ring-1 ring-border">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <h3 className="mt-4 font-serif text-[22px] font-normal leading-tight text-ink-primary">{title}</h3>
      <p className="mt-3 text-body text-ink-secondary">{body}</p>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="flex gap-4">
      <span
        aria-hidden
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-canvas-card font-serif text-body-lg font-normal text-ink-primary shadow-soft ring-1 ring-border"
      >
        {n}
      </span>
      <div>
        <h3 className="font-serif text-[20px] font-normal leading-tight text-ink-primary">{title}</h3>
        <p className="mt-2 text-body text-ink-secondary">{body}</p>
      </div>
    </li>
  );
}

function ProductCallout({
  eyebrow,
  title,
  body,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      {children}
      <p className="mt-6 text-caption uppercase tracking-wide text-ink-tertiary">{eyebrow}</p>
      <h3 className="mt-2 font-serif text-[22px] font-normal leading-tight text-ink-primary">{title}</h3>
      <p className="mt-2 max-w-xs text-body text-ink-secondary">{body}</p>
    </div>
  );
}

function CtaCard({
  title,
  body,
  actionLabel,
  actionHref,
  secondaryLabel,
  secondaryHref,
}: {
  title: string;
  body: string;
  actionLabel: string;
  actionHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-canvas-card p-7 shadow-soft transition-shadow hover:shadow-warm">
      <h3 className="font-serif text-[22px] font-normal leading-tight text-ink-primary">{title}</h3>
      <p className="mt-3 flex-1 text-body text-ink-secondary">{body}</p>
      <div className="mt-6 flex flex-col gap-2">
        <a
          href={actionHref}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-body font-semibold text-primary-foreground shadow-warm transition-all hover:bg-primary-hover hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {actionLabel}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </a>
        {secondaryLabel && secondaryHref && (
          <a
            href={secondaryHref}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-canvas-card px-4 text-caption font-semibold text-ink-secondary transition-all hover:bg-canvas-banded hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {secondaryLabel}
          </a>
        )}
      </div>
    </div>
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
