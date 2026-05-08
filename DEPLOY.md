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

## What still needs wiring before this is a live, end-to-end product

- **Email provider** — magic-link auth needs an SMTP/transactional email integration (Resend, Postmark, SES). Without it, you can't actually log in.
- **Anthropic API key** — `ANTHROPIC_API_KEY` env var enables layer-4 language analysis on check-ins. Optional; the deterministic risk layers (1, 2, 3, 5) work without it.
- **Notification queue** — BullMQ + Redis (Upstash on Vercel works) for the fan-out workers.
- **Real seed data** — the seed script populates the canonical question bank only; an org, cohort, and synthetic veterans are manual today.

## Cost

Free tier all the way. Vercel hobby + Neon free + (optional) Upstash free covers everything for a phone-demo level of use.
