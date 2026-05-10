# Sentinel

A veteran first-year transition support platform. Reduces suicide and crisis events among service members during their first year after separation by combining lightweight weekly check-ins, AI-driven pattern recognition across known stressor domains, and a human response team that intervenes early — before crisis.

This is not a chatbot. This is not a self-help app. This is a triage platform that points trained human responders at the veterans who need them today.

## Core principles

1. **AI points at problems. Humans solve them.** AI surfaces patterns. It never replies to veterans, never makes clinical decisions, never diagnoses.
2. **Connection is the unit of value.** Not engagement. Not retention. Did this veteran feel seen this week.
3. **Trajectory matters more than snapshot.** A sudden change matters more than a steady-state score.
4. **Silence is a signal.** A missed check-in is data.
5. **Compounding risk is the real risk.** Patterns across domains trigger escalation, not any single answer.
6. **Privacy is sacred. Consent is explicit.**
7. **The veteran is never the product.** No advertising. No data sales. Ever.
8. **Build for the responder, not just the veteran.**
9. **Tenant isolation is sacred.** No data crosses an organizational boundary.
10. **Append-only by default.**

## Architecture

Single-application, single-database, tenant-scoped multi-tenant SaaS.

- **Frontend:** Next.js 14 App Router · TypeScript · Tailwind · shadcn-style components
- **Backend:** Next.js Route Handlers (v1) → service layer (v2)
- **Database:** PostgreSQL · Prisma · Postgres Row-Level Security on every tenant table
- **Auth:** NextAuth v5 with magic links primary, password backup, Argon2id, MFA
- **AI:** Anthropic Claude (`claude-sonnet-4-5`) for language analysis and coordinator-draft replies. Versioned prompts, structured-JSON output, validated against schema.
- **Audit:** Immutable append-only `AuditLog` and `AuthEvent`. Triggers reject UPDATE/DELETE at the DB level.
- **Encryption:** TLS 1.3 in transit; field-level at rest for PHI/PII.

## What's in this repository

This repository is a working scaffold of the platform. It implements:

| Layer | Status | Where |
|---|---|---|
| Multi-tenant data model | ✅ | `prisma/schema.prisma` |
| RLS policies + immutability triggers | ✅ | `prisma/migrations/0001_init/migration.sql`, `prisma/migrations/0002_phase1/migration.sql` |
| Risk scoring engine (layers 1, 2, 3, 5) | ✅ | `src/lib/risk/engine.ts` |
| Risk engine test harness (synthetic trajectories) | ✅ | `src/lib/risk/__tests__/engine.test.ts` |
| Backtest harness (1000+ synthetic trajectories, confusion matrix) | ✅ | `scripts/backtest.ts`, `src/lib/risk/synthetic-trajectories.ts` |
| AI eval set (anchored cases, F1 per marker) | ✅ | `evals/language-analysis-v1/cases.jsonl`, `scripts/eval-language-analysis.ts` |
| Canonical question bank | ✅ | `src/lib/questions/canonical.ts` |
| AI layer (Claude integration, async via BullMQ) | ✅ | `src/lib/ai/`, `src/workers/language-analysis.ts` |
| Auth scaffolding | ✅ | `src/lib/auth/` |
| Tenant context + audit logging + correlation IDs | ✅ | `src/lib/db/tenant-context.ts`, `src/lib/audit/log.ts`, `src/lib/logging/log.ts` |
| Idempotency on every state-changing route | ✅ | `src/lib/idempotency/` |
| Tenant-isolation tests (RLS + triggers, raw SQL) | ✅ | `src/__tests__/tenant-isolation.test.ts` |
| Health checks (liveness + readiness) | ✅ | `src/app/api/healthz/`, `src/app/api/readyz/` |
| BullMQ workers + hourly check-in invitation cron | ✅ | `src/workers/`, `src/app/api/cron/checkin-invites/` |
| Service worker offline submission queue (IndexedDB + Background Sync) | ✅ | `public/sw.js` |
| Design system tokens | ✅ | `tailwind.config.ts`, `src/app/globals.css` |
| Custom components: `RiskBadge`, `CrisisResourceBanner`, `CheckInQuestion`, `DomainSparkline`, `TriageQueueItem` | ✅ | `src/components/sentinel/` |
| Veteran app: home, check-in (with drafts), completion, trends, insights, onboarding | ✅ | `src/app/v/` |
| Coordinator app: triage queue, per-veteran timeline (with degradation banner + feedback) | ✅ | `src/app/coordinator/` |
| Clinical lead: escalation queue | ✅ | `src/app/clinical/` |
| Program manager: cohort dashboard with override aggregates | ✅ | `src/app/admin/` |
| Check-in submission API (queued layer-4, idempotent) | ✅ | `src/app/api/check-ins/route.ts` |
| Veteran transparency + disagree feedback | ✅ | `src/app/v/insights/`, `src/app/api/check-ins/[id]/feedback/` |
| Clinical-Lead severity override API | ✅ | `src/app/api/flags/[id]/override/` |

## What's intentionally not finished

This is a foundation, not a finished product. The build prompt's full sprint plan (16 sprints) is the path to production. Notable items deferred from this scaffold:

- Magic-link email provider wiring (NextAuth email provider configuration; depends on transactional provider choice)
- Coordinator velocity (live queue, SLA countdown, real-time updates, reassignment workflow, batch actions)
- Outcome capture & IRB-aligned export
- Bulk operations UI (CSV import, caseload reassignment wizard)
- Org provisioning wizard (Super Admin)
- Cohort creation wizard
- E2E tests (Playwright) and accessibility automation in CI
- FedRAMP-aligned hosting documentation

## Running locally

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# fill in DATABASE_URL, AUTH_SECRET, REDIS_URL, and (optionally) ANTHROPIC_API_KEY

# 3. Run migrations and seed canonical data
npm run db:migrate
npm run db:seed

# 4. Run unit tests (risk engine + week derivation)
npm test

# 5. Start the dev server
npm run dev

# 6. (in another terminal) start the BullMQ worker process
npm run worker
```

### Optional but recommended

```bash
# Engine confidence: 1000+ synthetic trajectories, confusion matrix.
# Required pass before any threshold change in src/lib/risk/engine.ts.
npm run backtest

# AI eval: 25 anchored cases against the active layer-4 prompt.
# Required pass before any prompt-version bump.
ANTHROPIC_API_KEY=sk-... npm run eval:language

# Tenant-isolation tests (cross-org RLS + append-only triggers).
# Requires a disposable Postgres test instance.
TEST_DATABASE_URL=postgresql://... npm run test:isolation
```

## Risk engine

The engine is the heart of the system. Five layers combined into a single deterministic output (with the exception of layer 4, which involves a single AI call):

1. **Domain scores** — per-domain 0–100 concerning-ness for the current week.
2. **Trajectory** — change vs. 4-week and 12-week rolling baselines. Sudden negative shifts weight heavier.
3. **Compounding patterns** — 3+ domains shifting together; high-risk triples (Sleep + Mood + Connection); single-domain absolute concern.
4. **Language analysis** — Claude reads the open-ended response, returns structured markers. AI's recommended severity acts as a floor, never lowers risk. Explicit risk language → automatic RED.
5. **Silence weighting** — missed check-ins escalate with consecutive misses; prior risk level bumps the response up a level.

The engine outputs an explanation, not just a score. Coordinators see *why*.

```ts
import { score } from "@/lib/risk/engine";

const out = score({
  current,                  // current week's check-in
  history,                  // up to 12 prior weeks
  consecutiveMissedWeeks,
  priorRiskLevel,
  languageAnalysis,         // optional layer-4 output
});

// out.overallRiskLevel: GREEN | YELLOW | ORANGE | RED
// out.flags[]:          structured flags with explanations
// out.explanation:      coordinator-readable summary
// out.recommendedAction: what to do
```

## Tenant isolation

Every tenant-scoped table carries `organizationId`. RLS policies enforce isolation at the database level, not just in application code:

```sql
CREATE POLICY tenant_isolation ON "CheckIn"
  USING (
    app_is_super_admin()
    OR "organizationId" = app_current_org()
  );
```

Every authenticated request runs inside `withTenant()`, which sets `app.organization_id` as a session variable. Cross-tenant queries are physically impossible without going through the documented `withSuperAdmin()` path, which is logged and alerted.

## Append-only invariants

`CheckIn`, `Message`, `ConsentRecord`, `AuditLog`, `AuthEvent` are immutable at the database level — `UPDATE` and `DELETE` are rejected by triggers. Corrections are new records that supersede prior ones.

## Design system

Calm over clinical. Trust through restraint. One primary action per screen in the veteran app. Information density only where it earns its keep.

- Two font weights, five type sizes, 8-point spacing grid.
- Color signals state, not decoration. Risk colors are coordinator-side only.
- Crisis red is distinct from risk red; used only for 988/crisis resources.
- WCAG 2.1 AA minimum across the app, AAA target on veteran-facing surfaces.
- Honor `prefers-reduced-motion`.
- No streaks. No badges. No celebratory animations. Quiet acknowledgment only.

## What this is not

- Not a replacement for clinical care.
- Not a crisis hotline (it points at 988).
- Not a self-help app.
- Not a chatbot.
- Not a research tool that operates without IRB oversight.
- Not a product that owns or sells veteran data — ever.

## Contact

In crisis? Call **988**, press **1** — Veterans Crisis Line, available 24/7.

## Screenshots

Captured directly from the running app via `node scripts/screenshot.mjs`. Veteran surfaces at iPhone-13 width (390px); staff at 1280px. Several surfaces shown in both light and dark mode.

### Landing
| Light | Dark |
|---|---|
| ![Landing light](docs/screenshots/01-landing.png) | ![Landing dark](docs/screenshots/01-landing-dark.png) |

### Veteran app
| Home (light) | Home (dark) | Check-in |
|---|---|---|
| ![Home](docs/screenshots/02-veteran-home.png) | ![Home dark](docs/screenshots/02-veteran-home-dark.png) | ![Check-in](docs/screenshots/03-veteran-check-in.png) |

| Done | Trends | Onboarding |
|---|---|---|
| ![Done](docs/screenshots/04-veteran-check-in-done.png) | ![Trends](docs/screenshots/05-veteran-trends.png) | ![Onboarding](docs/screenshots/06-veteran-onboarding.png) |

| Consent | Messages (light) | Messages (dark) |
|---|---|---|
| ![Consent](docs/screenshots/07-veteran-consent.png) | ![Veteran msgs](docs/screenshots/08-veteran-messages.png) | ![Veteran msgs dark](docs/screenshots/08-veteran-messages-dark.png) |

### Coordinator
**Triage queue** — sidebar nav, command palette (⌘K), keyboard-first.
![Triage queue](docs/screenshots/09-coordinator-queue.png)
![Triage queue dark](docs/screenshots/09-coordinator-queue-dark.png)

**Per-veteran timeline** — flag explanation, domain sparklines, action panel with AI-assist, embedded triage protocol, recent activity timeline.
![Per-veteran timeline](docs/screenshots/10-coordinator-veteran.png)

**Messaging** — thread list (with unread dots, risk badges) and 1:1 thread with AI-assist drawer.
| Threads | Thread (with AI context) |
|---|---|
| ![Threads](docs/screenshots/11-coordinator-messages.png) | ![Thread](docs/screenshots/12-coordinator-thread.png) |

### Clinical Lead
![Clinical escalations](docs/screenshots/13-clinical-escalations.png)

### Program Manager
![Cohort dashboard](docs/screenshots/14-program-manager-cohort.png)
