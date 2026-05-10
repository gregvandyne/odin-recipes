/**
 * Escalate a flag to clinical review.
 *
 * POST /api/escalations
 *   body: { veteranId, triggeredByFlagId, recommendedAction? }
 *
 * Creates a `ClinicalEscalation` row with status=PENDING. The notification
 * fan-out worker dispatches NEW_ESCALATION to the on-call clinical lead.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/security/api-auth";
import { withTenant } from "@/lib/db/tenant-context";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";
import { withIdempotency } from "@/lib/idempotency/with-idempotency";
import { enqueueNotification } from "@/lib/queue/queues";

const Body = z.object({
  veteranId: z.string().uuid(),
  triggeredByFlagId: z.string().uuid().optional(),
  recommendedAction: z.string().max(500).optional(),
});

export const POST = withAuth(
  async (req, ctx) => {
    if (!ctx.organizationId) return NextResponse.json({ error: "no tenant" }, { status: 403 });
    const organizationId = ctx.organizationId;

    return withIdempotency(req, ctx, "/api/escalations", async (bodyText) => {
      let parsed: z.infer<typeof Body>;
      try {
        parsed = Body.parse(JSON.parse(bodyText));
      } catch {
        return { status: 400, payload: { error: "invalid body" }, skipCache: true };
      }

      const result = await withTenant(
        { organizationId, userId: ctx.userId, userRole: ctx.role, isOrgAdmin: ctx.isOrgAdmin },
        async (tx) => {
          const escalation = await tx.clinicalEscalation.create({
            data: {
              organizationId,
              veteranId: parsed.veteranId,
              escalatingCoordinatorId: ctx.userId,
              triggeredByFlagId: parsed.triggeredByFlagId,
              recommendedAction: parsed.recommendedAction,
              status: "PENDING",
            },
            select: { id: true, createdAt: true },
          });

          // Notify the clinical-lead pool. We deliberately notify everyone
          // with role CLINICAL_LEAD; whoever claims first gets the case.
          const leads = await tx.user.findMany({
            where: { organizationId, role: "CLINICAL_LEAD", accountState: "ACTIVE" },
            select: { id: true },
          });
          const notifIds: string[] = [];
          for (const lead of leads) {
            const notif = await tx.notification.create({
              data: {
                organizationId,
                recipientUserId: lead.id,
                category: "NEW_ESCALATION",
                channel: "EMAIL",
                subject: "Sentinel: a coordinator escalated a case",
                bodyTemplateId: "new-escalation-v1",
                relatedResourceType: "ClinicalEscalation",
                relatedResourceId: escalation.id,
              },
              select: { id: true },
            });
            notifIds.push(notif.id);
          }

          await logAudit(
            {
              organizationId,
              actorId: ctx.userId,
              actorRole: ctx.role,
              action: AUDIT_ACTIONS.ESCALATION_RAISE,
              resourceType: "ClinicalEscalation",
              resourceId: escalation.id,
              ipAddress: ctx.ipAddress,
              userAgent: ctx.userAgent,
              correlationId: ctx.correlationId,
              metadata: {
                veteranId: parsed.veteranId,
                triggeredByFlagId: parsed.triggeredByFlagId,
              },
            },
            tx,
          );

          return { escalation, notifIds };
        },
      );

      // Enqueue notifications outside the tx — same pattern as
      // dispatchFlagNotifications.
      for (const id of result.notifIds) {
        void enqueueNotification({ notificationId: id, correlationId: ctx.correlationId });
      }

      return {
        status: 201,
        payload: {
          escalationId: result.escalation.id,
          createdAt: result.escalation.createdAt.toISOString(),
        },
      };
    });
  },
  { roles: ["COORDINATOR", "CLINICAL_LEAD", "PROGRAM_MANAGER"], rateLimit: "api.message" },
);
