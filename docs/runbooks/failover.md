# Multi-region failover runbook

Sentinel currently runs single-region (`iad1`). This runbook documents the
path to multi-region availability and the procedure for an iad1 outage.

## Current state

- Vercel app: `iad1` (Washington DC).
- Postgres (Neon): same region.
- Redis (Upstash): same region.
- Worker: deployed to a single host (Render, Railway, or Fly).

## Target state (Phase 2E)

- Vercel app: `iad1`, `sfo1`, `sin1` — round-robin via Vercel's edge.
- Postgres: Neon primary in `iad1` + read replicas in `sfo1`/`sin1`. Writes
  go to primary; reads can hit nearest replica.
- Redis: Upstash global. Workers connect to nearest cluster.
- Worker: at least one host per region, all draining the same queue.

## iad1 outage procedure (today's setup)

1. Announce in #sentinel-incidents Slack.
2. Update DNS / Vercel deploy alias to point at a backup deploy in `sfo1`
   if one is provisioned (currently it isn't — this is the gap).
3. Switch `REDIS_URL` and `DATABASE_URL` to backup-region URLs.
4. Restart the worker process(es) in the new region.
5. Run the smoke test from `dr-restore.md`.
6. Once iad1 returns, decide whether to fail back or stay on the new
   region. Fail-back requires WAL catch-up between Neon regions.

## Expected impact during single-region outage

- Veteran sign-in: unavailable.
- Coordinator queue: unavailable.
- **Critical**: in-flight RED notifications that haven't been delivered yet
  may be delayed by the duration of the outage. The SLA monitor will catch
  them when service returns.
- 988 path: unaffected (it's a `tel:` link served from the cached PWA shell).

## Cost trade-off

Multi-region runs ~2× the infrastructure cost. For a single-cohort pilot
(< 100 veterans) the cost-benefit doesn't yet justify it. Re-evaluate at
each org-onboarding: if the new org's SLA contract requires it, provision.
