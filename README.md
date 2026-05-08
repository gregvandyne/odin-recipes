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
| RLS policies + immutability triggers | ✅ | `prisma/migrations/0001_init/migration.sql` |
| Risk scoring engine (layers 1, 2, 3, 5) | ✅ | `src/lib/risk/engine.ts` |
| Risk engine test harness (synthetic trajectories) | ✅ | `src/lib/risk/__tests__/engine.test.ts` |
| Canonical question bank | ✅ | `src/lib/questions/canonical.ts` |
| AI layer (Claude integration) | ✅ | `src/lib/ai/` |
| Auth scaffolding | ✅ | `src/lib/auth/` |
| Tenant context + audit logging | ✅ | `src/lib/db/tenant-context.ts`, `src/lib/audit/log.ts` |
| Design system tokens | ✅ | `tailwind.config.ts`, `src/app/globals.css` |
| Custom components: `RiskBadge`, `CrisisResourceBanner`, `CheckInQuestion`, `DomainSparkline`, `TriageQueueItem` | ✅ | `src/components/sentinel/` |
| Veteran app: home, check-in, completion, trends, onboarding | ✅ | `src/app/v/` |
| Coordinator app: triage queue, per-veteran timeline | ✅ | `src/app/coordinator/` |
| Clinical lead: escalation queue | ✅ | `src/app/clinical/` |
| Program manager: cohort dashboard | ✅ | `src/app/admin/` |
| Check-in submission API | ✅ | `src/app/api/check-ins/route.ts` |

## What's intentionally not finished

This is a foundation, not a finished product. The build prompt's full sprint plan (16 sprints) is the path to production. Notable items deferred from this scaffold:

- Magic-link email provider wiring (NextAuth email provider configuration; depends on transactional provider choice)
- BullMQ-backed notification fan-out workers
- Bulk operations UI (CSV import, caseload reassignment wizard)
- Org provisioning wizard (Super Admin)
- Cohort creation wizard
- E2E tests (Playwright) and accessibility automation in CI
- HIPAA-aligned hosting documentation

## Running locally

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# fill in DATABASE_URL, AUTH_SECRET, and (optionally) ANTHROPIC_API_KEY

# 3. Run migrations and seed canonical data
npm run db:migrate
npm run db:seed

# 4. Run unit tests (risk engine)
npm test

# 5. Start the dev server
npm run dev
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

Captured directly from the running app. Veteran-facing surfaces are at iPhone-13 width (390px); staff surfaces at 1280px.

### Landing
![Landing](docs/screenshots/01-landing.png)

### Veteran app
| Home | Check-in (sleep hours) | Done |
|---|---|---|
| ![Veteran home](docs/screenshots/02-veteran-home.png) | ![Check-in](docs/screenshots/03-veteran-check-in.png) | ![Done](docs/screenshots/04-veteran-check-in-done.png) |

| Trends | Onboarding | Consent |
|---|---|---|
| ![Trends](docs/screenshots/05-veteran-trends.png) | ![Onboarding](docs/screenshots/06-veteran-onboarding.png) | ![Consent](docs/screenshots/07-veteran-consent.png) |

### Coordinator
**Triage queue** — leftmost color band signals severity, RED → ORANGE → YELLOW. Queue ordering enforces the principle that critical state lives in the leftmost column.
![Triage queue](docs/screenshots/08-coordinator-queue.png)

**Per-veteran timeline** — domain sparklines stacked, flag explanation at top, action panel and triage protocol on the right.
![Per-veteran timeline](docs/screenshots/09-coordinator-veteran.png)

### Clinical Lead
![Clinical escalations](docs/screenshots/10-clinical-escalations.png)

### Program Manager
![Cohort dashboard](docs/screenshots/11-program-manager-cohort.png)
