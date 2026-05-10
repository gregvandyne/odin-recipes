-- Phase 2 migration:
--   1. User: mfaSecretEncrypted, mfaConfirmedAt
--   2. SuppressionList table (platform-wide, no RLS)
--   3. Helpful indexes for new query paths

-- =============================================================================
-- User: MFA secret + confirmed-at
-- =============================================================================

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "mfaSecretEncrypted" text,
  ADD COLUMN IF NOT EXISTS "mfaConfirmedAt"     timestamp(3);

-- =============================================================================
-- SuppressionList — email send-time suppression
-- Platform-wide; no organizationId, no RLS. A bounce is a bounce.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SuppressionReason') THEN
    CREATE TYPE "SuppressionReason" AS ENUM (
      'HARD_BOUNCE',
      'COMPLAINT',
      'MANUAL',
      'INVALID_ADDRESS'
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "SuppressionList" (
  "email"        text                NOT NULL,
  "reason"       "SuppressionReason" NOT NULL,
  "suppressedAt" timestamp(3)        NOT NULL DEFAULT now(),
  "metadata"     jsonb               NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT "SuppressionList_pkey" PRIMARY KEY ("email")
);

CREATE INDEX IF NOT EXISTS "SuppressionList_reason_suppressedAt_idx"
  ON "SuppressionList"("reason", "suppressedAt");

-- =============================================================================
-- Helpful indexes for the new Phase 2 query paths
-- =============================================================================

-- Coordinator triage queue: scoped by assigned coordinator, ordered by
-- (acknowledgedAt IS NULL, severity DESC, createdAt ASC).
CREATE INDEX IF NOT EXISTS "Flag_organizationId_veteranId_acknowledgedAt_idx"
  ON "Flag"("organizationId", "veteranId", "acknowledgedAt");

-- Per-veteran timeline pulls latest contacts.
CREATE INDEX IF NOT EXISTS "Contact_veteranId_createdAt_idx"
  ON "Contact"("veteranId", "createdAt");

-- Clinical-lead queue.
CREATE INDEX IF NOT EXISTS "ClinicalEscalation_clinicalLeadId_status_idx"
  ON "ClinicalEscalation"("clinicalLeadId", "status");

-- OOO lookup at notification fan-out time.
CREATE INDEX IF NOT EXISTS "CoordinatorOOO_coordinatorId_startAt_endAt_idx"
  ON "CoordinatorOOO"("coordinatorId", "startAt", "endAt");

-- Notification dispatch worker scans QUEUED + RETRYABLE rows, oldest first.
CREATE INDEX IF NOT EXISTS "Notification_status_queuedAt_idx"
  ON "Notification"("status", "queuedAt");

-- Audit-log query/export by date.
CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_action_timestamp_idx"
  ON "AuditLog"("organizationId", "action", "timestamp");
