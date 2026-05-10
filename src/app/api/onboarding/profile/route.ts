/**
 * Veteran profile completion.
 *
 * POST /api/onboarding/profile
 *   body: {
 *     timezone, checkInDayOfWeek, checkInLocalTime,
 *     separationDate, branchOfService, yearsOfService?,
 *     emergencyContactName?, emergencyContactPhone?, emergencyContactConsent?,
 *     localVAFacility?
 *   }
 *
 * Upserts VeteranProfile. The middleware redirects veterans to
 * /v/onboarding/profile until VeteranProfile is complete (programStartDate +
 * timezone + branchOfService set).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/security/api-auth";
import { withTenant } from "@/lib/db/tenant-context";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";
import { withIdempotency } from "@/lib/idempotency/with-idempotency";

const Body = z.object({
  timezone: z.string().min(2).max(48),
  checkInDayOfWeek: z.number().int().min(0).max(6),
  checkInLocalTime: z.string().regex(/^\d{2}:\d{2}$/),
  separationDate: z.string().refine((s) => !Number.isNaN(Date.parse(s)), "invalid date"),
  branchOfService: z.string().min(2).max(40),
  yearsOfService: z.number().int().min(0).max(50).optional(),
  emergencyContactName: z.string().min(1).max(80).optional(),
  emergencyContactPhone: z.string().min(7).max(40).optional(),
  emergencyContactConsent: z.boolean().optional(),
  localVAFacility: z.string().max(120).optional(),
});

const PROGRAM_LENGTH_MS = 365 * 24 * 60 * 60 * 1000; // 52 weeks

export const POST = withAuth(
  async (req, ctx) => {
    if (ctx.role !== "VETERAN" || !ctx.organizationId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const organizationId = ctx.organizationId;

    return withIdempotency(req, ctx, "/api/onboarding/profile", async (bodyText) => {
      let parsed: z.infer<typeof Body>;
      try {
        parsed = Body.parse(JSON.parse(bodyText));
      } catch {
        return { status: 400, payload: { error: "invalid body" }, skipCache: true };
      }

      const separationDate = new Date(parsed.separationDate);
      // Program window: 52 weeks from acceptance (we use today as start so
      // returning veterans don't get a profile that already says "week 30").
      const programStartDate = new Date();
      const programEndDate = new Date(programStartDate.getTime() + PROGRAM_LENGTH_MS);

      await withTenant(
        { organizationId, userId: ctx.userId, userRole: "VETERAN", isOrgAdmin: false },
        async (tx) => {
          // We need a Cohort to attach to. Pick the most recent active cohort
          // for the org as a sensible default; admins can move them later.
          const cohort = await tx.cohort.findFirst({
            where: { organizationId, status: { in: ["ACTIVE", "PLANNED"] } },
            orderBy: { startDate: "desc" },
            select: { id: true },
          });
          if (!cohort) {
            throw new Error("no active cohort to attach veteran to");
          }
          await tx.veteranProfile.upsert({
            where: { userId: ctx.userId },
            create: {
              userId: ctx.userId,
              organizationId,
              cohortId: cohort.id,
              separationDate,
              branchOfService: parsed.branchOfService,
              yearsOfService: parsed.yearsOfService,
              timezone: parsed.timezone,
              checkInDayOfWeek: parsed.checkInDayOfWeek,
              checkInLocalTime: parsed.checkInLocalTime,
              programStartDate,
              programEndDate,
              emergencyContactName: parsed.emergencyContactName,
              emergencyContactPhone: parsed.emergencyContactPhone,
              emergencyContactConsent: parsed.emergencyContactConsent ?? false,
              localVAFacility: parsed.localVAFacility,
              status: "ACTIVE",
            },
            update: {
              separationDate,
              branchOfService: parsed.branchOfService,
              yearsOfService: parsed.yearsOfService,
              timezone: parsed.timezone,
              checkInDayOfWeek: parsed.checkInDayOfWeek,
              checkInLocalTime: parsed.checkInLocalTime,
              emergencyContactName: parsed.emergencyContactName,
              emergencyContactPhone: parsed.emergencyContactPhone,
              emergencyContactConsent: parsed.emergencyContactConsent ?? false,
              localVAFacility: parsed.localVAFacility,
            },
          });

          await logAudit(
            {
              organizationId,
              actorId: ctx.userId,
              actorRole: ctx.role,
              action: AUDIT_ACTIONS.PROFILE_COMPLETED,
              resourceType: "VeteranProfile",
              resourceId: ctx.userId,
              ipAddress: ctx.ipAddress,
              userAgent: ctx.userAgent,
              correlationId: ctx.correlationId,
            },
            tx,
          );
        },
      );

      return { status: 200, payload: { ok: true } };
    });
  },
  { roles: ["VETERAN"], rateLimit: "api.checkin.draft" },
);
