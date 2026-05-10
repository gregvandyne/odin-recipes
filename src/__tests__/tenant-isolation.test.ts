/**
 * Tenant-isolation tests.
 *
 * These tests verify that Postgres Row-Level Security policies prevent
 * cross-tenant data leaks even when the application layer is bypassed
 * entirely. They also exercise the CheckIn append-only column trigger
 * introduced in 0002_phase1 (response payload immutable; analysis fields
 * mutable).
 *
 * They require a real Postgres test database and are gated behind
 * `TEST_DATABASE_URL`. CI sets that to a disposable Postgres instance.
 *
 * The tests intentionally use raw SQL — bypassing every app helper — so
 * the RLS policies and triggers are the only line of defense being tested.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";

const dbUrl = process.env.TEST_DATABASE_URL;
const skipReason = !dbUrl
  ? "TEST_DATABASE_URL not set; skipping cross-tenant isolation tests (CI must run these)"
  : null;

// Two test orgs, two veterans, one cohort each, one check-in each.
const ORG_A = "11111111-1111-1111-1111-111111111111";
const ORG_B = "22222222-2222-2222-2222-222222222222";
const COHORT_A = "11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const COHORT_B = "22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const CHECKIN_A = "0a0a0a0a-0a0a-0a0a-0a0a-0a0a0a0a0a0a";

const describeOrSkip = skipReason ? describe.skip : describe;

describeOrSkip("tenant isolation + append-only triggers", () => {
  if (skipReason) {
    it.skip(skipReason, () => undefined);
    return;
  }

  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

    // Idempotent setup. Every insert is `ON CONFLICT DO NOTHING` so re-runs
    // against a persistent test DB don't fail.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.is_super_admin', 'true', true)`,
      );

      // Two organizations.
      for (const [id, slug] of [[ORG_A, "test-org-a"], [ORG_B, "test-org-b"]] as const) {
        await tx.$executeRawUnsafe(
          `INSERT INTO "Organization"(id, slug, name, "primaryContactEmail", "organizationType")
           VALUES ($1, $2, 'Test Org', 'test@example.com', 'TEST')
           ON CONFLICT (id) DO NOTHING`,
          id,
          slug,
        );
      }

      // Cohorts (one per org).
      const now = new Date();
      const later = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      for (const [cohortId, orgId] of [[COHORT_A, ORG_A], [COHORT_B, ORG_B]] as const) {
        await tx.$executeRawUnsafe(
          `INSERT INTO "Cohort"(id, "organizationId", name, "startDate", "endDate")
           VALUES ($1, $2, 'TestCohort', $3, $4)
           ON CONFLICT (id) DO NOTHING`,
          cohortId,
          orgId,
          now,
          later,
        );
      }

      // Veterans (one per org).
      for (const [userId, orgId] of [[USER_A, ORG_A], [USER_B, ORG_B]] as const) {
        await tx.$executeRawUnsafe(
          `INSERT INTO "User"(id, "organizationId", email, role, "accountState")
           VALUES ($1, $2, $3, 'VETERAN'::"UserRole", 'ACTIVE'::"AccountState")
           ON CONFLICT (id) DO NOTHING`,
          userId,
          orgId,
          `${userId}@example.com`,
        );
      }

      // VeteranProfiles.
      for (const [userId, orgId, cohortId] of [
        [USER_A, ORG_A, COHORT_A],
        [USER_B, ORG_B, COHORT_B],
      ] as const) {
        await tx.$executeRawUnsafe(
          `INSERT INTO "VeteranProfile"(
             "userId","organizationId","cohortId","separationDate","branchOfService",
             "programStartDate","programEndDate"
           )
           VALUES ($1,$2,$3,$4,'NAVY',$4,$5)
           ON CONFLICT ("userId") DO NOTHING`,
          userId,
          orgId,
          cohortId,
          now,
          later,
        );
      }

      // One check-in for org A so we can prove RLS hides it from org B and
      // exercise the append-only column trigger.
      await tx.$executeRawUnsafe(
        `INSERT INTO "CheckIn"(id, "organizationId", "veteranId", "weekNumber", responses)
         VALUES ($1, $2, $3, 1, '[]'::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        CHECKIN_A,
        ORG_A,
        USER_A,
      );
    });
  }, 30_000);

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it("scoped session for org A cannot read org B users via raw SQL", async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.is_super_admin', 'false', true), set_config('app.organization_id', $1, true)`,
        ORG_A,
      );
      const rows = await tx.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM "User" WHERE id = $1`,
        USER_B,
      );
      expect(rows).toEqual([]);
    });
  });

  it("scoped session for org A cannot read org B organization row", async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.is_super_admin', 'false', true), set_config('app.organization_id', $1, true)`,
        ORG_A,
      );
      const rows = await tx.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM "Organization" WHERE id = $1`,
        ORG_B,
      );
      expect(rows).toEqual([]);
    });
  });

  it("scoped session for org A CAN read its own organization + user", async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.is_super_admin', 'false', true), set_config('app.organization_id', $1, true)`,
        ORG_A,
      );
      const orgRows = await tx.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM "Organization" WHERE id = $1`,
        ORG_A,
      );
      const userRows = await tx.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM "User" WHERE id = $1`,
        USER_A,
      );
      expect(orgRows).toEqual([{ id: ORG_A }]);
      expect(userRows).toEqual([{ id: USER_A }]);
    });
  });

  it("scoped session refuses to insert a row carrying a foreign organizationId", async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `SELECT set_config('app.is_super_admin', 'false', true), set_config('app.organization_id', $1, true)`,
          ORG_A,
        );
        await tx.$executeRawUnsafe(
          `INSERT INTO "User"(id, "organizationId", email, role)
           VALUES ($1, $2, 'foreign@example.com', 'VETERAN'::"UserRole")`,
          "cccccccc-cccc-cccc-cccc-cccccccccccc",
          ORG_B,
        );
      }),
    ).rejects.toBeTruthy();
  });

  it("CheckIn trigger blocks tampering with the response payload", async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `SELECT set_config('app.is_super_admin', 'true', true)`,
        );
        await tx.$executeRawUnsafe(
          `UPDATE "CheckIn" SET responses = '[{"questionId":"forged","value":1,"skipped":false}]'::jsonb WHERE id = $1`,
          CHECKIN_A,
        );
      }),
    ).rejects.toThrow(/CheckIn\.responses is immutable/);
  });

  it("CheckIn trigger allows the layer-4 worker to write back analysis fields", async () => {
    // The plan promises the worker can update aiAnalysis / riskLevel /
    // aiPending / aiAnalysisFailedAt. Verify those updates succeed.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.is_super_admin', 'true', true)`,
      );
      await tx.$executeRawUnsafe(
        `UPDATE "CheckIn"
         SET "aiPending" = false,
             "aiAnalysis" = '{"promptVersion":"v1","model":"test"}'::jsonb,
             "riskLevel" = 'YELLOW'::"RiskLevel"
         WHERE id = $1`,
        CHECKIN_A,
      );
    });
    const rows = await prisma.$queryRawUnsafe<{ aiPending: boolean; riskLevel: string }[]>(
      `SELECT "aiPending", "riskLevel"::text AS "riskLevel" FROM "CheckIn" WHERE id = $1`,
      CHECKIN_A,
    );
    expect(rows[0]).toMatchObject({ aiPending: false, riskLevel: "YELLOW" });
  });

  it("AuditLog cannot be updated or deleted (still strict append-only)", async () => {
    let auditId: string | undefined;
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.is_super_admin', 'true', true)`,
      );
      const inserted = await tx.$queryRawUnsafe<{ id: string }[]>(
        `INSERT INTO "AuditLog"("organizationId", "actorId", action, "resourceType")
         VALUES ($1, NULL, 'isolation.test', 'Test')
         RETURNING id`,
        ORG_A,
      );
      auditId = inserted[0]?.id;
    });
    expect(auditId).toBeTruthy();

    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE "AuditLog" SET action = 'tampered' WHERE id = $1`,
        auditId,
      ),
    ).rejects.toThrow(/append-only/);

    await expect(
      prisma.$executeRawUnsafe(`DELETE FROM "AuditLog" WHERE id = $1`, auditId),
    ).rejects.toThrow(/append-only/);
  });
});

// Re-export Prisma so tsc considers this a module.
export type _ = Prisma.UserWhereInput;
