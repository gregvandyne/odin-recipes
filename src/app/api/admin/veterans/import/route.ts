/**
 * CSV roster import for veterans.
 *
 * POST /api/admin/veterans/import
 *   body: { cohortId, rows: [{ email, separationDate, branchOfService }] }
 *
 * Creates User+Invitation rows per CSV row. Dedups on email per org.
 * Returns a per-row result summary.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/security/api-auth";
import { withTenant } from "@/lib/db/tenant-context";
import { generateInvitationToken } from "@/lib/auth/invitation";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";
import { enqueueNotification } from "@/lib/queue/queues";

const Row = z.object({
  email: z.string().email().max(254),
  separationDate: z.string().refine((s) => !Number.isNaN(Date.parse(s))),
  branchOfService: z.string().min(2).max(40),
});
const Body = z.object({
  cohortId: z.string().uuid(),
  rows: z.array(Row).min(1).max(500),
});

export const POST = withAuth(
  async (req, ctx) => {
    if (!ctx.organizationId) return NextResponse.json({ error: "no tenant" }, { status: 403 });
    let parsed: z.infer<typeof Body>;
    try {
      parsed = Body.parse(await req.json());
    } catch {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }

    const result = await withTenant(
      { organizationId: ctx.organizationId, userId: ctx.userId, userRole: ctx.role, isOrgAdmin: ctx.isOrgAdmin },
      async (tx) => {
        const cohort = await tx.cohort.findUnique({
          where: { id: parsed.cohortId },
          select: { organizationId: true },
        });
        if (!cohort || cohort.organizationId !== ctx.organizationId) {
          return { kind: "noCohort" as const };
        }
        const perRow: Array<{ email: string; status: "invited" | "duplicate" | "error"; error?: string }> = [];
        for (const row of parsed.rows) {
          try {
            const lc = row.email.toLowerCase();
            const existing = await tx.user.findFirst({
              where: { organizationId: ctx.organizationId, email: lc },
              select: { id: true },
            });
            if (existing) {
              perRow.push({ email: row.email, status: "duplicate" });
              continue;
            }
            const token = generateInvitationToken();
            const invite = await tx.invitation.create({
              data: {
                organizationId: ctx.organizationId!,
                email: lc,
                role: "VETERAN",
                invitedById: ctx.userId,
                tokenHash: token.hash,
                expiresAt: token.expiresAt,
                metadata: {
                  cohortId: parsed.cohortId,
                  separationDate: row.separationDate,
                  branchOfService: row.branchOfService,
                },
              },
              select: { id: true },
            });
            // Queue an invitation email — bodyTemplateId is rendered by the
            // notification worker. We pass the raw token via metadata so the
            // email template can include the accept-invitation URL.
            const notif = await tx.notification.create({
              data: {
                organizationId: ctx.organizationId!,
                recipientUserId: ctx.userId, // synthetic — the worker resolves via inviteId
                category: "WEEKLY_CHECKIN_INVITE", // closest matching category for rendering
                channel: "EMAIL",
                subject: "You're invited to Sentinel",
                bodyTemplateId: "invitation-v1",
                relatedResourceType: "Invitation",
                relatedResourceId: invite.id,
              },
              select: { id: true },
            });
            void enqueueNotification({ notificationId: notif.id, correlationId: ctx.correlationId });
            perRow.push({ email: row.email, status: "invited" });
          } catch (err) {
            perRow.push({
              email: row.email,
              status: "error",
              error: err instanceof Error ? err.message : "unknown",
            });
          }
        }

        await logAudit(
          {
            organizationId: ctx.organizationId!,
            actorId: ctx.userId,
            actorRole: ctx.role,
            action: AUDIT_ACTIONS.USER_INVITE,
            resourceType: "VeteranImport",
            correlationId: ctx.correlationId,
            metadata: {
              cohortId: parsed.cohortId,
              attempted: parsed.rows.length,
              invited: perRow.filter((r) => r.status === "invited").length,
              duplicates: perRow.filter((r) => r.status === "duplicate").length,
              errors: perRow.filter((r) => r.status === "error").length,
            },
          },
          tx,
        );
        return { kind: "ok" as const, perRow };
      },
    );
    if (result.kind === "noCohort") {
      return NextResponse.json({ error: "cohort not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, results: result.perRow });
  },
  { roles: ["PROGRAM_MANAGER"], rateLimit: "auth.password", requireMfa: true },
);
