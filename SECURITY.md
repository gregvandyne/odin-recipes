# Sentinel — Security Posture

This document describes the controls in place. Sentinel handles healthcare-adjacent data and is built like it. If you find a security issue, email `security@platform.tld` — please don't open a public issue.

## Identity & Authentication

| Control | Implementation |
|---|---|
| Magic links primary | NextAuth v5 Email provider, delivered via Resend, 15-minute TTL, single-use |
| Password backup (NIST SP 800-63B aligned) | 12-char minimum, no composition rules, **HIBP breach check** on creation/reset, no forced rotation, no security questions |
| Password storage | **Argon2id** (`@node-rs/argon2`) — memory-hard, side-channel resistant |
| MFA | TOTP + WebAuthn enrollment scaffolded; recovery codes single-use, hashed at rest |
| Session storage | Server-side (Prisma adapter), revocable, idle/absolute timeouts per role |
| Session lifetimes | Staff: 15m idle / 12h absolute · Veterans: 30d idle / 90d absolute |
| Failed-login lockout | Progressive backoff, account LOCKED state after 5 failures in 15 min |
| Auth events audit | Every LOGIN_SUCCESS / FAILURE / LOGOUT / MFA_* recorded with IP + UA |

## Authorization

| Control | Implementation |
|---|---|
| Tenant isolation | **Postgres Row-Level Security** on every tenant-scoped table; session variable checked on every query |
| API authorization wrapper | `withAuth()` is the chokepoint — resolves session, validates role, binds tenant context, applies rate limits |
| Three-tier permission model | Super Admin · Org Admin · User (with functional roles VETERAN, COORDINATOR, CLINICAL_LEAD, PROGRAM_MANAGER) |
| Elevated access logging | Super-Admin tenant-data access requires `withSuperAdmin()` which audits every entry inside the same transaction |
| Cross-tenant query prevention | RLS denies the row physically — not just in app code |

## Data Protection

| Control | Implementation |
|---|---|
| Field-level encryption | **AES-256-GCM** with versioned keyring (`APP_ENCRYPTION_KEY_V1`, `_V2`, …) for `CheckIn.openEndedResponse`, `Message.bodyEncrypted`, `Contact.summary`, `ClinicalEscalation.consultNotes` |
| AAD binding | Each ciphertext binds organization id, owner id, and field name — decryption fails on row movement |
| Key rotation | Multiple keys can be active during rotation; ciphertext envelope carries key id |
| TLS in transit | TLS 1.3 (HSTS preloaded) |
| Append-only invariants | Database triggers reject UPDATE/DELETE on `CheckIn`, `Message`, `ConsentRecord`, `AuditLog`, `AuthEvent` |
| Audit log | Immutable `AuditLog` of every clinically-relevant action with actor, IP, UA, reason |
| PII redaction in AI calls | Veteran name, phone, email, SSN-shaped tokens all redacted before any prompt is sent |

## Network & Browser

| Control | Implementation |
|---|---|
| **Content Security Policy** | Per-request nonce CSP via middleware. `default-src 'self'`, `script-src` nonce + `'strict-dynamic'`, `frame-ancestors 'none'` |
| HSTS | `max-age=63072000; includeSubDomains; preload` |
| Frame protection | `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'` |
| MIME sniffing | `X-Content-Type-Options: nosniff` |
| Referrer policy | `strict-origin-when-cross-origin` |
| Cross-origin policy | COOP `same-origin`, CORP `same-origin` |
| Permissions policy | Camera, microphone, geolocation all denied; FLoC opt-out |
| Authenticated-page caching | `Cache-Control: private, no-store` on `/v/*`, `/coordinator/*`, `/clinical/*`, `/admin/*` |

## Rate Limiting

Token-bucket limiter, in-memory by default, Redis-backed in production.

| Bucket | Limit |
|---|---|
| `auth.login` | 5 / 15 min |
| `auth.password` | 3 / hour |
| `auth.invitation` | 10 / hour |
| `api.checkin` | 10 / 10 min |
| `api.message` | 60 / 10 min |
| `api.draft` | 30 / hour (AI cost cap) |
| `api.push` | 20 / 10 min |
| `edge.anon` | 60 / minute sustained |

## Webhook Verification

Every external webhook (Resend, etc.) verifies HMAC signature with **constant-time comparison** before any data is trusted. No body is parsed if signature fails.

## Secrets & Operational Security

- Secrets only injected via env vars; never committed.
- Encryption keys via base64-encoded 32-byte values; rotation supported via versioned keyring.
- VAPID keys (Web Push) generated once and stored in env vars.
- Resend webhook secret separate from API key.
- `next.config.mjs`: `poweredByHeader: false` — no `X-Powered-By: Next.js`.

## Privacy Engineering

- Veteran name → "the veteran" before AI calls. Phone numbers, emails, SSN-shaped tokens redacted.
- AI never speaks to the veteran. Drafts are coordinator-reviewed before send.
- AI calls log prompt version, model, tokens, latency, AAD-bound input hash — never raw input.
- Logs and error traces redact PII; `organizationId` tagged for debug without leaking content.
- Veteran withdrawal flow preserves their right of access while halting further outreach.

## Append-only Database

Triggers in `prisma/migrations/0001_init/migration.sql`:

```sql
CREATE TRIGGER CheckIn_no_update BEFORE UPDATE ON "CheckIn"
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();
```

A buggy app cannot mutate immutable rows. Period.

## What's still being hardened

- Anomaly alerting on `auth_events` (failed-login spikes, new-device floods)
- Automated DR restore tests (weekly restore to staging)
- FedRAMP-aligned hosting documentation for federal partners
- Content-aware DLP in inbound message attachments (v2 — text only in v1)
- WebAuthn-only mode for staff (currently TOTP/WebAuthn either)
- Tenant-aware backup restores (point-in-time logical restore per org)

## Reporting an issue

Email `security@platform.tld`. PGP key on request. We commit to acknowledge within 1 business day and to coordinated disclosure.
