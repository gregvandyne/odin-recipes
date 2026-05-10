# DR / restore runbook

## Targets

- **RTO**: 1h to a read-write replica.
- **RPO**: ≤ 5 minutes (Neon's branch-and-restore window).

## Backup mechanisms

1. **Postgres / Neon** — Neon provides continuous WAL with point-in-time
   restore (PITR). Default retention is 7 days on the free tier; production
   should run on a paid tier with 30-day PITR.
2. **Encryption keys** — `APP_ENCRYPTION_KEY_V*` lives in the Vercel env
   var vault. Mirror to the team password manager (1Password, Bitwarden)
   under "Sentinel · Encryption keys". A vault loss with no env-var copy
   makes encrypted columns unreadable forever.
3. **Object storage** — VAPID keys, Resend signing secret, AUTH_SECRET. Same
   mirror policy as encryption keys.

## Restore procedure (Postgres)

1. Identify the target timestamp (incident start - 5m).
2. In Neon dashboard: Branches → Create branch → "Restore from a specific time".
3. Note the new branch's connection string. This is the read-write replica.
4. Update the production `DATABASE_URL` env var on Vercel to the new branch.
5. Trigger a deploy or rolling restart so the app picks up the new URL.
6. Run a smoke test:
   - `curl https://<host>/api/healthz` → 200
   - `curl https://<host>/api/readyz` → 200
   - Sign in as a test coordinator account.
   - Verify the triage queue loads.
   - Submit a check-in. Verify a Notification row is created.

## Restore procedure (worker process)

The BullMQ worker has no durable state — Redis holds the queues. If the
Redis instance is unrecoverable:

1. Provision a new Upstash Redis instance.
2. Update `REDIS_URL` env var on both the Vercel app and the worker host.
3. Restart the worker. It re-registers the repeatable cron jobs (invite
   sweep, SLA monitor, data retention) at boot.
4. **Lost in-flight work**: queued notifications/jobs are dropped. Mitigation:
   the SLA monitor cron will catch any unacknowledged RED flags within 1h.

## Quarterly drill

A drill runs in CI four times per year (Jan/Apr/Jul/Oct, 1st Sunday). The
drill spins up a fresh DB from the latest snapshot, applies migrations, and
runs the smoke-test suite. Failure pages on-call.

## Operator-only paths

- **`app.deprovision`** session GUC: lets the data-retention worker delete
  rows from append-only tables (CheckIn, Message, ConsentRecord) during an
  org-deprovision purge. Set only inside the worker's transaction; the
  trigger refuses otherwise.
- **`app.is_super_admin`**: bypasses RLS. Logged + alerted at every use.

## Things we explicitly do NOT do

- Self-hosted Postgres backups (we trust Neon's PITR).
- Cross-region replicas (single-region pilot for cost). Multi-region is on
  the roadmap — see `docs/runbooks/failover.md` once that's wired.
