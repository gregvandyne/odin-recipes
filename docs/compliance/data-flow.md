# Data flow

The diagram below traces every category of veteran-touching data from
ingestion through to retention boundary.

```mermaid
flowchart TD
  Vet[Veteran browser / PWA]
  CheckIn[/api/check-ins POST/]
  Drafts[/api/check-ins/draft/]
  Profile[/api/onboarding/profile/]
  Push[/api/push/subscribe/]

  Vet -->|TLS 1.3| CheckIn
  Vet -->|TLS 1.3| Drafts
  Vet -->|TLS 1.3| Profile
  Vet -->|TLS 1.3| Push

  CheckIn --> Engine[Risk engine layers 1-3,5]
  Engine --> Postgres[(Postgres
  RLS + AES-GCM
  field-level)]
  CheckIn --> QLang[BullMQ:
  language-analysis]
  QLang --> Anthropic[Anthropic API
  redacted input]
  Anthropic --> WorkerLang[Worker:
  layer-4]
  WorkerLang --> Postgres

  Engine --> Notif[Notification row]
  Notif --> QNotif[BullMQ:
  notifications]
  QNotif --> WorkerNotif[Worker:
  notification fan-out]
  WorkerNotif --> Resend[Resend
  outbound email]
  WorkerNotif --> WebPush[Web Push
  FCM/APNs]
  WorkerNotif --> Pubsub[Redis pubsub]
  Pubsub --> SSE[SSE: live queue]

  Coord[Coordinator browser]
  SSE --> Coord
  Resend --> Coord
  WebPush --> Coord
  Coord --> Triage[/coordinator/]
  Triage --> Postgres

  CL[Clinical Lead browser]
  SSE --> CL
  Resend --> CL
  CL --> Clinical[/clinical/]
  Clinical --> Postgres

  Postgres -->|nightly PITR| Neon[Neon backup
  encrypted at rest]
  Postgres -->|daily retention sweep| Retention[Worker:
  data-retention]
  Postgres -->|deprovisioning grace 30d| Purge[Worker:
  org-deprovision]
```

## Crossings worth calling out

- **Browser → API**: TLS 1.3 + CSP (nonce + strict-dynamic).
- **API → Anthropic**: payload passes through `redactPII` first. No PHI
  leaves the perimeter; the prompt sees only the open-ended response with
  names/phones/dates redacted.
- **API → Resend**: subject + recipient email. The body is the rendered
  template; veteran free-text never appears in an outbound email.
- **API → Redis**: encrypted in transit (Upstash TLS). Pubsub messages
  carry resource ids only — never PHI.
- **Worker → Postgres**: same RLS + AES-GCM. Workers reconstruct tenant
  context per job and never bypass `withTenant`.

## Subprocessors (BAA status)

| Vendor    | Purpose            | BAA status |
|-----------|--------------------|------------|
| Vercel    | Application host   | Required for prod |
| Neon      | Postgres           | Required for prod |
| Upstash   | Redis              | Required for prod |
| Resend    | Email delivery     | Required for prod |
| Anthropic | Layer-4 LLM        | Required for prod (zero-retention API tier) |
| Sentry    | Error tracking     | Required for prod (with PII scrubbing on) |
| Cloudflare| DNS                | None (no PHI) |

Every BAA is tracked in `docs/compliance/baas/<vendor>.pdf` (not in this
repo — it lives in the org's secure document store).

## Data retention

| Class                         | Default TTL | Knob                              |
|-------------------------------|-------------|-----------------------------------|
| AuditLog                      | 365 days    | `Organization.dataRetentionPolicy.auditLogDays` |
| Notification                  | 90 days     | `dataRetentionPolicy.notificationDays` |
| Session (revoked)             | 30 days     | `dataRetentionPolicy.sessionDays` |
| CheckIn / Message / Consent   | Lifetime of the org | Purged on org deprovisioning + 30d grace |
| Org full purge after deprovision | 30d after `deprovisionedAt` | hardcoded |

## On-deletion

- **Veteran-initiated deletion**: not yet implemented. Deferred per the
  current plan; tracked under the deprovisioning purge path until a real
  state-privacy regime requires it.
- **Org-initiated deletion**: handled by the data-retention worker. Org
  Admin sets `Organization.deprovisionedAt`; 30 days later the worker
  purges all tenant-scoped rows except the deprovisioning audit entry.
