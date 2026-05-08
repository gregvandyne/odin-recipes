-- Sentinel initial migration.
--
-- This file is illustrative. In production you generate it via `prisma migrate dev`.
-- The Prisma generator handles table creation; this file documents the
-- ROW-LEVEL SECURITY policies that the generator does NOT produce, plus
-- triggers that enforce append-only invariants.
--
-- Apply this AFTER `prisma migrate deploy` runs the generated DDL, by
-- including these statements in a follow-up migration.

-- =============================================================================
-- Tenant context: every authenticated session sets app.organization_id.
-- RLS policies read this session variable on every query.
-- =============================================================================

-- Helper: return current tenant id, or NULL if not set (super-admin path).
CREATE OR REPLACE FUNCTION app_current_org() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.organization_id', true), '')::uuid;
$$ LANGUAGE SQL STABLE;

-- Helper: return true if current request is a platform-elevated context.
-- Platform admins set app.is_super_admin = 'true' via documented support path.
CREATE OR REPLACE FUNCTION app_is_super_admin() RETURNS boolean AS $$
  SELECT current_setting('app.is_super_admin', true) = 'true';
$$ LANGUAGE SQL STABLE;

-- =============================================================================
-- Apply RLS to every tenant-scoped table.
-- =============================================================================

-- Macro: enable RLS and force it (so even table owner is subject to policies).
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'User',
    'Invitation',
    'CaseloadReassignment',
    'VeteranProfile',
    'Cohort',
    'CheckIn',
    'CheckInQuestion',
    'Flag',
    'Contact',
    'ClinicalEscalation',
    'MessageThread',
    'Message',
    'CoordinatorOOO',
    'Notification',
    'AuditLog',
    'ConsentRecord',
    'OrganizationStateTransition'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);

    -- Tenant isolation policy. Platform admins bypass via app_is_super_admin().
    -- Rows with NULL organizationId (only User for SUPER_ADMIN) are visible only
    -- to platform admins.
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

-- The Organization table itself is tenant-scoped by id rather than organizationId.
ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Organization" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_org ON "Organization"
  USING (app_is_super_admin() OR id = app_current_org())
  WITH CHECK (app_is_super_admin() OR id = app_current_org());

-- =============================================================================
-- Append-only enforcement.
-- CheckIn, Message, ConsentRecord, AuditLog, AuthEvent are immutable.
-- We block UPDATE/DELETE at the trigger level so even a buggy app cannot mutate.
-- =============================================================================

CREATE OR REPLACE FUNCTION reject_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'append-only: mutations not allowed on %', TG_TABLE_NAME
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t text;
  immutable_tables text[] := ARRAY[
    'CheckIn',
    'Message',
    'ConsentRecord',
    'AuditLog',
    'AuthEvent'
  ];
BEGIN
  FOREACH t IN ARRAY immutable_tables LOOP
    -- Allow specific append-only review fields on CheckIn? No — corrections
    -- are new rows that point at the original via correctsCheckInId. Same
    -- principle for all listed tables. Total mutation block.
    EXECUTE format($f$
      CREATE TRIGGER %I_no_update
      BEFORE UPDATE ON %I
      FOR EACH ROW EXECUTE FUNCTION reject_mutation()
    $f$, t || '_no_update', t);

    EXECUTE format($f$
      CREATE TRIGGER %I_no_delete
      BEFORE DELETE ON %I
      FOR EACH ROW EXECUTE FUNCTION reject_mutation()
    $f$, t || '_no_delete', t);
  END LOOP;
END$$;

-- =============================================================================
-- Contact lock: editable for 24 hours from creation, then locked.
-- =============================================================================

CREATE OR REPLACE FUNCTION enforce_contact_edit_window() RETURNS trigger AS $$
BEGIN
  IF NEW."editableUntil" IS NULL OR now() > NEW."editableUntil" THEN
    RAISE EXCEPTION 'contact past 24h edit window'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contact_edit_window
  BEFORE UPDATE ON "Contact"
  FOR EACH ROW EXECUTE FUNCTION enforce_contact_edit_window();

CREATE TRIGGER contact_no_delete
  BEFORE DELETE ON "Contact"
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();
