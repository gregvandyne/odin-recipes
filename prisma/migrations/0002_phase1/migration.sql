-- Phase 1 migration:
--   1. New columns on CheckIn for layer-4 async + degradation tracking
--   2. New Flag override traceability columns
--   3. New tables: CheckInDraft, CheckInFeedback, IdempotencyRecord
--   4. RLS on new tenant-scoped tables
--   5. Relax CheckIn append-only trigger: response payload remains immutable,
--      analysis fields become updatable so the layer-4 worker can write back.

-- =============================================================================
-- CheckIn: new fields
-- =============================================================================

ALTER TABLE "CheckIn"
  ADD COLUMN IF NOT EXISTS "aiPending" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "aiAnalysisFailedAt" timestamp(3),
  ADD COLUMN IF NOT EXISTS "aiAnalysisFailureReason" text;

CREATE INDEX IF NOT EXISTS "CheckIn_aiPending_idx" ON "CheckIn"("aiPending");

-- =============================================================================
-- Flag: override traceability
-- =============================================================================

ALTER TABLE "Flag"
  ADD COLUMN IF NOT EXISTS "severityOverrideAt" timestamp(3),
  ADD COLUMN IF NOT EXISTS "severityBeforeOverride" "RiskLevel";

-- =============================================================================
-- New tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS "CheckInDraft" (
  "id"                uuid          NOT NULL DEFAULT gen_random_uuid(),
  "organizationId"    uuid          NOT NULL,
  "veteranId"         uuid          NOT NULL,
  "weekNumber"        integer       NOT NULL,
  "responses"         jsonb         NOT NULL DEFAULT '[]'::jsonb,
  "openEndedResponse" text,
  "lastUpdatedAt"     timestamp(3)  NOT NULL DEFAULT now(),
  "createdAt"         timestamp(3)  NOT NULL DEFAULT now(),
  CONSTRAINT "CheckInDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CheckInDraft_veteranId_weekNumber_key"
  ON "CheckInDraft"("veteranId", "weekNumber");

CREATE INDEX IF NOT EXISTS "CheckInDraft_organizationId_veteranId_idx"
  ON "CheckInDraft"("organizationId", "veteranId");

ALTER TABLE "CheckInDraft"
  ADD CONSTRAINT "CheckInDraft_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "CheckInFeedback" (
  "id"                          uuid          NOT NULL DEFAULT gen_random_uuid(),
  "organizationId"              uuid          NOT NULL,
  "checkInId"                   uuid          NOT NULL,
  "veteranId"                   uuid          NOT NULL,
  "body"                        text          NOT NULL,
  "createdAt"                   timestamp(3)  NOT NULL DEFAULT now(),
  "acknowledgedByCoordinatorId" uuid,
  "acknowledgedAt"              timestamp(3),
  CONSTRAINT "CheckInFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CheckInFeedback_organizationId_checkInId_idx"
  ON "CheckInFeedback"("organizationId", "checkInId");

CREATE INDEX IF NOT EXISTS "CheckInFeedback_organizationId_veteranId_createdAt_idx"
  ON "CheckInFeedback"("organizationId", "veteranId", "createdAt");

ALTER TABLE "CheckInFeedback"
  ADD CONSTRAINT "CheckInFeedback_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CheckInFeedback"
  ADD CONSTRAINT "CheckInFeedback_checkInId_fkey"
  FOREIGN KEY ("checkInId") REFERENCES "CheckIn"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "IdempotencyRecord" (
  "key"            text          NOT NULL,
  "organizationId" uuid,
  "userId"         uuid          NOT NULL,
  "route"          text          NOT NULL,
  "requestHash"    text          NOT NULL,
  "response"       jsonb         NOT NULL,
  "statusCode"     integer       NOT NULL,
  "createdAt"      timestamp(3)  NOT NULL DEFAULT now(),
  "expiresAt"      timestamp(3)  NOT NULL,
  CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "IdempotencyRecord_userId_createdAt_idx"
  ON "IdempotencyRecord"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "IdempotencyRecord_expiresAt_idx"
  ON "IdempotencyRecord"("expiresAt");

-- =============================================================================
-- RLS on new tenant-scoped tables
-- =============================================================================

DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'CheckInDraft',
    'CheckInFeedback'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I
      USING (
        app_is_super_admin()
        OR ("organizationId" IS NOT NULL AND "organizationId" = app_current_org())
      )
      WITH CHECK (
        app_is_super_admin()
        OR ("organizationId" IS NOT NULL AND "organizationId" = app_current_org())
      )
    $f$, t);
  END LOOP;
END$$;

-- IdempotencyRecord is scoped by userId. Tenant filter applies via user lookup.
ALTER TABLE "IdempotencyRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IdempotencyRecord" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_idempotency ON "IdempotencyRecord"
  USING (
    app_is_super_admin()
    OR ("organizationId" IS NOT NULL AND "organizationId" = app_current_org())
    OR "organizationId" IS NULL  -- platform-level keys (super-admin path)
  )
  WITH CHECK (
    app_is_super_admin()
    OR ("organizationId" IS NOT NULL AND "organizationId" = app_current_org())
    OR "organizationId" IS NULL
  );

-- =============================================================================
-- Relax CheckIn append-only trigger.
--
-- Original 0001_init blocks ALL UPDATEs on CheckIn. That made it impossible
-- for the layer-4 worker to write AI analysis back to the row, and equally
-- impossible to record reviewedByCoordinatorId.
--
-- We replace the blanket UPDATE block with a column-level trigger that keeps
-- the veteran-authored payload immutable while permitting analysis and
-- review-tracking columns to change.
-- =============================================================================

DROP TRIGGER IF EXISTS "CheckIn_no_update" ON "CheckIn";

CREATE OR REPLACE FUNCTION enforce_checkin_immutable_columns() RETURNS trigger AS $$
BEGIN
  IF NEW."organizationId"   IS DISTINCT FROM OLD."organizationId"   THEN RAISE EXCEPTION 'CheckIn.organizationId is immutable'; END IF;
  IF NEW."veteranId"        IS DISTINCT FROM OLD."veteranId"        THEN RAISE EXCEPTION 'CheckIn.veteranId is immutable'; END IF;
  IF NEW."weekNumber"       IS DISTINCT FROM OLD."weekNumber"       THEN RAISE EXCEPTION 'CheckIn.weekNumber is immutable'; END IF;
  IF NEW."submittedAt"      IS DISTINCT FROM OLD."submittedAt"      THEN RAISE EXCEPTION 'CheckIn.submittedAt is immutable'; END IF;
  IF NEW."responses"::text  IS DISTINCT FROM OLD."responses"::text  THEN RAISE EXCEPTION 'CheckIn.responses is immutable'; END IF;
  IF NEW."openEndedResponse" IS DISTINCT FROM OLD."openEndedResponse" THEN RAISE EXCEPTION 'CheckIn.openEndedResponse is immutable'; END IF;
  IF NEW."correctsCheckInId" IS DISTINCT FROM OLD."correctsCheckInId" THEN RAISE EXCEPTION 'CheckIn.correctsCheckInId is immutable'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CheckIn_immutable_columns"
  BEFORE UPDATE ON "CheckIn"
  FOR EACH ROW EXECUTE FUNCTION enforce_checkin_immutable_columns();

-- =============================================================================
-- IdempotencyRecord pruning helper. Cron calls this hourly.
-- =============================================================================

CREATE OR REPLACE FUNCTION prune_expired_idempotency_records() RETURNS bigint AS $$
DECLARE
  deleted bigint;
BEGIN
  WITH d AS (DELETE FROM "IdempotencyRecord" WHERE "expiresAt" < now() RETURNING 1)
  SELECT count(*) INTO deleted FROM d;
  RETURN deleted;
END;
$$ LANGUAGE plpgsql;
