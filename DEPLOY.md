# Deploying Sentinel to Vercel

This is a Next.js + Postgres app. Vercel runs the app; Neon runs Postgres. Both have free tiers that are enough to test on a phone.

## One-time setup (~10 minutes)

### 1. Create a Postgres database (Neon)

1. Go to https://neon.tech, sign in with GitHub.
2. Create a new project. Region: pick the same one you'll deploy Vercel to (e.g. `us-east-1`).
3. Copy the **pooled** connection string (the one labeled "Connection pooling" — Vercel's serverless functions need it).

### 2. Deploy to Vercel

**Option A — via CLI (fastest if you have a terminal handy):**

```bash
npm install -g vercel
cd odin-recipes
vercel              # link to your account, accept defaults
vercel env add DATABASE_URL          # paste the Neon pooled URL
vercel env add AUTH_SECRET           # paste `openssl rand -base64 32`
vercel env add AUTH_URL              # your project URL, e.g. https://sentinel-xyz.vercel.app
vercel --prod                        # production deploy
```

**Option B — via Vercel dashboard:**

1. https://vercel.com/new → import this GitHub repo.
2. Framework preset: Next.js (auto-detected). Don't override the build command.
3. Environment variables — add these three:
   - `DATABASE_URL` = your Neon pooled connection string
   - `AUTH_SECRET` = run `openssl rand -base64 32` locally and paste the output
   - `AUTH_URL` = leave blank for now; set after first deploy to the assigned `*.vercel.app` URL
4. Click **Deploy**.

### 3. Run migrations against the deployed database

Vercel doesn't run Prisma migrations automatically. From your laptop:

```bash
# Set the same DATABASE_URL locally, just for migration
export DATABASE_URL="<your-neon-direct-url>"   # use the DIRECT URL, not pooled, for migrations

npx prisma migrate deploy
npx prisma db seed
```

Note: use Neon's **direct** URL (not pooled) for migrations; pooled is for runtime queries.

### 4. Open it on your phone

Once Vercel finishes building, you'll get a URL like `https://sentinel-xyz.vercel.app`.

On your phone:
- **iOS Safari:** open the URL → Share → *Add to Home Screen*. Opens fullscreen as a PWA.
- **Android Chrome:** open the URL → ⋮ menu → *Install app*.

Pages that work without authentication (sample data only — these are what you'll see first):

- `/` — landing
- `/v` — veteran home
- `/v/check-in` — the check-in flow (submit will fail without auth, but you can walk through every screen)
- `/v/onboarding` and `/v/onboarding/consent`
- `/v/trends` — sparkline trends view
- `/coordinator` — triage queue
- `/coordinator/veteran/demo-2` — per-veteran timeline with action panel
- `/clinical` — escalation queue
- `/admin` — program manager dashboard

## Background work: BullMQ worker + Redis

Phase 1 moved the layer-4 AI analysis off the request path into a BullMQ
worker. Production deploys need a Redis instance and one of two ways to run
the worker:

### Required env vars

- `REDIS_URL` — any Redis 6+ URL. Upstash Redis works on Vercel.
- `CRON_SECRET` — a random string used to authenticate the HTTP cron path
  (`openssl rand -base64 32`). Required when relying on Vercel Cron.
- `ANTHROPIC_API_KEY` — language analysis. Optional; layers 1/2/3/5 still run
  without it, and the coordinator UI surfaces a "language analysis
  unavailable — review the open-ended response manually" banner when missing.

### Option A — long-running worker container (recommended for production)

Run `npm run worker` on a small always-on host (Railway, Render, Fly,
Heroku, Docker on your own VM). The worker:

- handles `language-analysis` jobs (3 retries with 1s/5s/25s backoff;
  exhaustion sets `aiAnalysisFailedAt` on the check-in)
- handles `notifications` (email/push fan-out)
- registers the hourly check-in invitation sweep as a BullMQ repeatable

### Option B — Vercel Cron (no separate worker)

If you don't want a second host, `vercel.json` already registers
`/api/cron/checkin-invites` as an hourly cron. The endpoint runs the same
sweep logic as the worker. **Layer-4 AI analysis still requires Option A**,
since BullMQ-managed retries need the persistent worker. Without it, AI
analysis is silently skipped and the coordinator banner surfaces every time.

## Health checks

- `GET /api/healthz` — liveness. Returns 200 whenever the Node process is up.
- `GET /api/readyz` — readiness. Probes Postgres + Redis. Returns 503 if any
  dependency is down. Use this for load-balancer health checks.

## What still needs wiring before this is a live, end-to-end product

- **Email provider** — magic-link auth needs an SMTP/transactional email integration (Resend, Postmark, SES). Without it, you can't actually log in.
- **Real seed data** — the seed script populates the canonical question bank only; an org, cohort, and synthetic veterans are manual today.

## Cost

Free tier all the way. Vercel hobby + Neon free + Upstash free covers everything for a phone-demo level of use, except the long-running worker (Render/Fly/Railway free tier covers that).
