# Integrations setup — homework

Work through this list before you point real veterans at the deployment. Items are grouped by the dependency they touch. Each one ends with a one-line verification step you can copy-paste.

## 1. Database — Postgres (Neon recommended)

- [ ] **Create the production database.** Neon, Supabase, RDS, anywhere. Postgres ≥ 14. Pooled URL **with `?pgbouncer=true&connect_timeout=15`**.
- [ ] Set `DATABASE_URL` in the deploy env to the **pooled** URL.
- [ ] Set a separate `DIRECT_URL` (Neon-style) for migrations only — Prisma uses this when present so connection pooling doesn't break `prisma migrate deploy`.
- [ ] Apply migrations: `npx prisma migrate deploy` (CI runs this automatically; first deploy is manual).
- [ ] Configure **PITR**: ≥ 7 days for pilot, ≥ 30 days for production cohorts.
- [ ] **Verify**: `psql "$DATABASE_URL" -c "select count(*) from \"Organization\";"` returns `0` (or your seeded orgs).

## 2. Auth — NextAuth + email provider

- [ ] **AUTH_SECRET** = output of `openssl rand -base64 32`. Mirror to your password manager.
- [ ] **AUTH_URL** = canonical production URL with scheme (e.g. `https://sentinel.health`). The same-origin guard reads this.
- [ ] **AUTH_ISSUER** = `Sentinel` (or your branded name; appears in TOTP authenticator labels).
- [ ] **EMAIL_SERVER** = stub OK (`smtp://stub:stub@localhost:1025`); we route through Resend, not nodemailer.
- [ ] **EMAIL_FROM_PLATFORM** = the `noreply@` address security/auth emails come from (e.g. `Sentinel <noreply@sentinel.health>`).
- [ ] **EMAIL_FROM_PROGRAM** = the friendly address program emails come from (e.g. `Sentinel <hello@sentinel.health>`).
- [ ] **Verify**: hit `/auth/sign-in`, request a link to a real inbox, click → reach `/v` (or `/v/onboarding/consent` if it's a fresh account).

## 3. Email — Resend (with HIPAA BAA)

- [ ] Create a Resend account. **Sign the BAA** (email Resend support; required for any veteran-touching deploy).
- [ ] Verify your sending domain in Resend. Add the **DKIM** + **SPF** records they give you. Add a **DMARC** record (`v=DMARC1; p=quarantine; rua=mailto:dmarc@…`) once DKIM is passing.
- [ ] **RESEND_API_KEY** = restricted-scope key that can only `emails.send`.
- [ ] Configure the Resend webhook to point at `https://<host>/api/webhooks/resend`. Subscribe to `email.delivered`, `email.bounced`, `email.complained`.
- [ ] **RESEND_WEBHOOK_SECRET** = the signing secret Resend gives you for the webhook.
- [ ] **Verify**: send a magic link to a Gmail and a corporate inbox; check inbox (not spam). Force a hard bounce by sending to `bounce@simulator.amazonses.com` and confirm a row appears in `SuppressionList`.

## 4. Encryption — keyring

- [ ] **APP_ENCRYPTION_KEY** = `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Mirror to your password manager under "Sentinel · Encryption keys" — losing this makes every PHI field permanently unreadable.
- [ ] (Optional, when rotating) **APP_ENCRYPTION_KEY_V1**, `_V2`, … and **APP_ENCRYPTION_KEY_VERSION**.
- [ ] **Verify**: hit `/api/healthz` and confirm 200.

## 5. AI — Anthropic (with HIPAA BAA)

- [ ] Email Anthropic to **enable the zero-data-retention API tier** + sign the BAA. Get written confirmation that no retention applies to your account.
- [ ] **ANTHROPIC_API_KEY** = a key restricted to your Sentinel deploy. Rotate quarterly.
- [ ] **Verify**: trigger a check-in submission with explicit risk language and confirm the language-analysis worker picks it up (look for `worker.language-analysis` log lines + a `LANGUAGE_MARKER` or `EXPLICIT_RISK` row in `Flag`).

## 6. Push notifications — VAPID

- [ ] Generate a VAPID key pair: `node scripts/gen-vapid.mjs`.
- [ ] **VAPID_PUBLIC_KEY** = the printed public key.
- [ ] **VAPID_PRIVATE_KEY** = the printed private key (mirror to password manager).
- [ ] **VAPID_SUBJECT** = `mailto:security@<your-domain>`.
- [ ] **Verify**: open the veteran app on a real device, accept the push prompt, force a RED Flag against a synthetic veteran, confirm the push lands.

## 7. Redis — Upstash recommended

- [ ] Create an Upstash Redis database (or any TLS Redis ≥ 7). **Sign the BAA** if you're sending PHI through it (we only send resource ids in our pubsub channels, but the queue payload could theoretically carry context — sign anyway).
- [ ] **REDIS_URL** = the connection URL (rediss://… for TLS).
- [ ] **RATE_LIMIT_REDIS_URL** = same Redis is fine; consider a separate logical DB.
- [ ] **Verify**: hit `/api/readyz` and confirm 200; check the worker process is writing `sentinel:hb:worker` heartbeat keys (`KEYS sentinel:hb:*`).

## 8. Worker process — long-running

- [ ] Deploy `npm run worker` somewhere with a long-running process model (Render, Railway, Fly, AWS ECS — **not** Vercel serverless). Same env vars as the web app.
- [ ] Confirm shutdown grace ≥ 30s so workers can drain.
- [ ] **Verify**: `/api/readyz` returns 503 when the worker is stopped, 200 within 60s of restart.

## 9. Cron

- [ ] **CRON_SECRET** = `openssl rand -base64 32`. The HTTP fallback at `/api/cron/checkin-invites` requires `Authorization: Bearer $CRON_SECRET`.
- [ ] Vercel Cron is wired in `vercel.json` — Vercel sends the bearer automatically. If you're on a different platform, schedule a hourly POST to `/api/cron/checkin-invites` with the bearer header.
- [ ] **Verify**: trigger the cron manually with `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/checkin-invites` → 200, look for `cron.checkin-invites` log lines.

## 10. Observability — Sentry (optional but strongly recommended)

- [ ] Create a Sentry project. **Sign their BAA** if logs may carry PHI.
- [ ] **SENTRY_DSN** = the project DSN.
- [ ] **SENTRY_TRACES_SAMPLE_RATE** = `0.05` (default 5%).
- [ ] Install the package on the deploy: `npm install @sentry/nextjs`. The shim in `src/lib/observability/sentry.ts` lazy-imports it; without the package the app still runs (errors go to pino only).
- [ ] **Verify**: throw a forced error from a route (e.g. add `if (req.url.includes("__break__")) throw new Error("test")` temporarily) and confirm the event reaches Sentry.

## 11. PWA / iOS

- [ ] All six manifest icon sizes already present at `public/icons/`. If you're rebranding, replace them and rerun `node scripts/gen-icons.mjs`.
- [ ] On iOS Safari, the veteran can "Add to Home Screen". Test on a real device.

## 12. CI / GitHub

- [ ] In GitHub repo settings → Secrets → set `ANTHROPIC_API_KEY` (used by the eval workflow only when prompts change).
- [ ] In **branch protection** for `main`: require `lint-typecheck-test`, `backtest`, and `build` to pass + ≥ 1 review.
- [ ] (Optional) Provision a CI database service so `test:isolation` runs against real Postgres. The workflow already wires this — just ensure Postgres + Redis services start.

## 13. Per-organization onboarding

For every org you provision via `/super-admin/orgs/new`:

- [ ] Set `Organization.mfaEnforcementLevel` to `REQUIRED_STAFF` (default) or `REQUIRED_ALL`. The staff-app layout will redirect non-MFA staff to `/account/mfa/setup` automatically.
- [ ] Configure `Organization.dataRetentionPolicy` per the org's contract (defaults are 365d audit / 90d notification / 30d session).
- [ ] Send the **Org Admin invitation** (the wizard offers this). The Org Admin completes:
  - Sign in via magic link → consent → MFA setup.
  - Provision their cohort via `/admin/cohorts/new`.
  - Invite coordinators + clinical leads + import veteran roster.

## 14. Smoke test before go-live

Run the end-to-end flow in `docs/runbooks/production-readiness.md` § "Smoke test before declaring 'live'" — submit a check-in with explicit risk language as a test veteran and verify a coordinator receives the notification across all three channels (email, Web Push, SSE) within 30 seconds, and that an `AuditLog` row of action `flag.acknowledge` appears after the coordinator acks it.

If any step fails, do not flip the flag for real veterans.
