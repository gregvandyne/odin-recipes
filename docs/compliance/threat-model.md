# Threat model

STRIDE-style. Each line is "the threat" → "what stops it".

## Spoofing

- **Phished sign-in link**: NextAuth magic links are 15-minute one-time use,
  HTTPS-only. Staff are required to complete an MFA step-up after the link.
- **Stolen session cookie**: sessions are server-side (Prisma adapter),
  revocable per-row. `/account/security` lists active sessions; "Sign out
  everywhere" sets `revokedAt` on all of them. Sessions auto-expire on the
  staff cadence (15m idle / 12h absolute).

## Tampering

- **Cross-tenant write attempt**: Postgres RLS on every tenant-scoped table
  rejects writes that don't carry `app.organization_id` matching the row.
  Tested by `src/__tests__/tenant-isolation.test.ts` against raw SQL.
- **CheckIn response tampering**: column-level trigger
  `enforce_checkin_immutable_columns` rejects `UPDATE` to `responses`,
  `weekNumber`, `submittedAt`, etc. Layer-4 worker can update analysis
  fields only.
- **Audit-log tampering**: append-only trigger rejects all `UPDATE`/`DELETE`
  on `AuditLog`, `AuthEvent`, `Message`, `ConsentRecord`.

## Repudiation

- **"I never sent that"**: every state-changing API logs an `AuditLog` row
  with actor, IP, user-agent, correlation id, resource id. RLS-scoped per
  org. Exportable via `/api/admin/audit/export` for regulator review.

## Information disclosure

- **AI prompt leak**: `redactPII` runs before any prompt is sent to
  Anthropic. Anthropic API tier requires zero-retention by BAA.
- **Log leak**: pino is configured with PII-redacting paths (email, phone,
  body, openEndedResponse, password, token). Sentry breadcrumbs share the
  same scrub list.
- **Field-level encryption at rest**: AES-256-GCM on
  `CheckIn.openEndedResponse`, `Message.bodyEncrypted`, `Contact.summary`,
  `ClinicalEscalation.consultNotes`, `User.mfaSecretEncrypted`. AAD binds
  ciphertext to (org, resource id) so a row moved between contexts fails
  authentication tag verification.
- **Backup leak**: Neon backups are encrypted at rest. Encryption keys are
  not stored in the DB — they live in the deploy env-var vault.

## Denial of service

- **Application-layer flood**: token-bucket rate limits per-route,
  Redis-backed in production. Limits documented in `src/lib/security/rate-limit.ts`.
- **Edge flood**: middleware adds `edge.anon` bucket on unauthenticated
  routes. Vercel + Cloudflare provide upstream protection.
- **Worker queue starvation**: BullMQ has dedicated connections per worker;
  RED notifications reuse the same queue as YELLOW so a YELLOW backlog can
  delay a RED. Mitigation: priority lanes are a Phase 3 item; for now we
  rely on small per-job latency + RED/ORANGE cap on volume.

## Elevation of privilege

- **Cross-role action**: `withAuth({ roles: [...] })` rejects callers
  without the role. `requireMfa: true` forces a fresh MFA challenge before
  sensitive actions (severity override, deactivation, audit export).
- **Worker bypass**: workers reconstruct tenant context per job and run
  inside `withTenant` for every write. The cron sweep and SLA monitor
  flip `app.is_super_admin = 'true'` for read-only scans, never for writes.
- **Super-admin abuse**: `withSuperAdmin()` writes an `ELEVATED_ACCESS`
  audit entry inside the same transaction as the action.

## Known unaddressed risks

- **Compromised laptop of a coordinator**: a stolen laptop with an active
  session has full access to that coordinator's caseload until the staff
  idle timeout (15m) or until "Sign out everywhere" is invoked. Mitigation
  options not yet implemented: device attestation, IP-pinned sessions.
- **Insider abuse by program manager**: a PM has access to the full
  cohort. Audit log captures everything they do; alerting on anomalous
  query patterns (1000 veterans viewed in an hour) is a Phase 3 item.
- **Anthropic API outage**: layer-4 fails, `aiAnalysisFailedAt` is set,
  coordinator banner surfaces the manual-review prompt. The deterministic
  layers (1, 2, 3, 5) keep producing flags.
