# Production-readiness checklist

Before pointing a real cohort at this deployment, every box on this
checklist must be ticked. Each item has a verifiable test — don't trust
"looks fine."

## Secrets & encryption

- [ ] `APP_ENCRYPTION_KEY` is a fresh 32-byte base64 value, **not** the
      example one in `.env.example`. Mirror it to the team password
      manager under "Sentinel · Encryption keys".
- [ ] `AUTH_SECRET` is 32 bytes from `openssl rand -base64 32`.
- [ ] `RESEND_WEBHOOK_SECRET` matches the value Resend's dashboard shows.
- [ ] `VAPID_PRIVATE_KEY` is in the env vault, never committed.
- [ ] No `*.example` value reaches production (grep deploy env for
      "generate-with-openssl-rand-base64-32" and "BB6f7G8JeZG2gqmW" — any
      hit means a default leaked).

## Database

- [ ] Migrations through `0003_phase2` have been applied to the production
      database (`npx prisma migrate deploy`).
- [ ] Postgres version ≥ 14 (RLS policy wording assumes it).
- [ ] PITR retention configured per `docs/runbooks/dr-restore.md` —
      minimum 7 days for pilot, 30 days for any production cohort.
- [ ] Tenant-isolation tests run against the production schema:
      `TEST_DATABASE_URL=$DATABASE_URL npm run test:isolation`.

## Infra

- [ ] `REDIS_URL` is set — without it the worker process refuses to start
      and every notification stays QUEUED forever.
- [ ] Worker process is deployed (Render / Railway / Fly). `/api/readyz`
      returns 200; missing the worker heartbeat would 503.
- [ ] `RATE_LIMIT_REDIS_URL` set (can be the same Redis URL — separate
      logical DB recommended).
- [ ] Cron sender (Vercel Cron or external scheduler) authenticates with
      `Authorization: Bearer $CRON_SECRET` against
      `/api/cron/checkin-invites`. Run the cron once manually and confirm
      it returns 200.

## Observability

- [ ] `SENTRY_DSN` set and `npm test` confirms `withErrorTracking`
      forwards a thrown error to Sentry. Workers also flush Sentry on
      shutdown (verified by inspecting the index.ts shutdown handler).
- [ ] pino logs surface correlation ids (`X-Correlation-Id` header on
      every API response). Pull a request id from the browser network tab
      and confirm you can find it in the log aggregator.
- [ ] Worker heartbeat key visible in Redis: `sentinel:hb:worker`.
- [ ] `/api/healthz` and `/api/readyz` are wired to the platform health
      probes (Vercel internal health, Render health check URL, etc.).

## Email + Push

- [ ] DKIM + SPF set up on `EMAIL_FROM_PROGRAM` domain. Send a test
      magic-link to a Gmail and a corporate mailbox; check it lands in
      the inbox, not spam.
- [ ] Resend webhook delivers events to `/api/webhooks/resend`. Force a
      bounce by sending to `bounce@simulator.amazonses.com` (or Resend's
      bounce simulator) and confirm the address is added to
      `SuppressionList`.
- [ ] VAPID key pair tested end-to-end: subscribe a real device, fire a
      RED Flag against a synthetic veteran, confirm the push lands.

## Auth + identity

- [ ] First Super Admin account is bootstrapped via the seeded migration
      or a signed Org provisioning request. Confirm `mfaEnabled` is true
      after they finish setup.
- [ ] `Organization.mfaEnforcementLevel` is `REQUIRED_STAFF` or higher
      for every real org (the default for the org-provision wizard).
- [ ] Magic-link sign-in works on a fresh browser session. Sign-in for a
      deactivated account redirects to `/auth/account-suspended` (force
      this by deactivating a test account through `/api/users/[id]/
      deactivate`).
- [ ] Sign-out-everywhere kills every session including the current
      tab's: open the app on two browsers, hit
      `/account/security → Sign out everywhere`, confirm both lose
      access on next request.

## Backups + retention

- [ ] Daily logical-DB backup configured (Neon's built-in or external
      `pg_dump` to encrypted S3 — see `dr-restore.md`).
- [ ] Encryption keys + VAPID keys are mirrored to the password manager.
- [ ] `Organization.dataRetentionPolicy` set per the org's contract.
      Default values (see `docs/compliance/data-flow.md`) apply when
      empty.
- [ ] Quarterly DR drill scheduled (see `dr-restore.md`).

## Security headers

Most of these are wired in `next.config.mjs` + `src/middleware.ts`. Still:

- [ ] `Strict-Transport-Security: max-age ≥ 63072000; includeSubDomains;
      preload` reaches the browser (verify with
      `curl -sI https://<host>/`).
- [ ] CSP carries a fresh nonce per request and contains
      `'strict-dynamic'` (no broad `*` source).
- [ ] No third-party origins leak into CSP unless explicitly required
      (Resend tracking pixel? Document explicitly.).

## CI

- [ ] Branch-protection rule on `main`: require CI green + ≥ 1 review.
- [ ] Backtest gate enforces RED recall ≥ 0.95 / GREEN precision ≥ 0.85.
- [ ] Language-eval workflow runs on prompt changes only (path filter).
- [ ] Playwright crisis-path test passes against a seeded test DB.

## Smoke test before declaring "live"

1. Sign in as a test veteran. Submit a check-in containing
   "I don't see how this gets better. Better off without me."
2. Within 30 seconds:
   - The assigned coordinator has a `Notification` row with category
     `RED_FLAG` and status `SENT` or `DELIVERED`.
   - The coordinator's `/coordinator` page shows the new flag (live, no
     refresh).
   - A push notification reached the coordinator's device.
   - An email reached the coordinator's inbox.
3. The coordinator acknowledges the flag from the per-veteran timeline.
   Confirm the queue updates within 30 seconds and an `AuditLog` row of
   action `flag.acknowledge` exists.
4. The coordinator escalates to clinical lead. Confirm `/clinical`
   updates live for the on-call lead and they get a push + email.
5. Sign in as the clinical lead, claim the escalation, add encrypted
   consult notes, mark actioned, mark closed. Audit log captures every
   transition.

If any of those steps fail, do not flip the flag for real veterans.
