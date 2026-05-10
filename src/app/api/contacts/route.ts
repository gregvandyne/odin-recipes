/**
 * Log a coordinator contact with a veteran.
 *
 * POST /api/contacts
 *   body: {
 *     veteranId, contactType, direction, summary,
 *     followUpRequired?, followUpBy?
 *   }
 *
 * Encrypts `summary` with AAD bound to (org, contactId). Sets
 * `editableUntil = now + 24h` so the summary is correctable for a day, then
 * locked at the trigger level (see migration 0001).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/security/api-auth";
import { withTenant } from "@/lib/db/tenant-context";
import { encryptField, contactAad } from "@/lib/security/encryption";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";
import { withIdempotency } from "@/lib/idempotency/with-idempotency";

const Body = z.object({
  veteranId: z.string().uuid(),
  contactType: z.enum(["CHECK_IN_REVIEW", "OUTREACH_CALL", "TEXT", "EMAIL", "IN_PERSON", "CRISIS"]),
  direction: z.enum(["INBOUND", "OUTBOUND"]),
  summary: z.string().min(1).max(4000),
  followUpRequired: z.boolean().optional(),
  followUpBy: z.string().optional(),
});

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export const POST = withAuth(
  async (req, ctx) => {
    if (!ctx.organizationId) return NextResponse.json({ error: "no tenant" }, { status: 403 });
    const organizationId = ctx.organizationId;

    return withIdempotency(req, ctx, "/api/contacts", async (bodyText) => {
      let parsed: z.infer<typeof Body>;
      try {
        parsed = Body.parse(JSON.parse(bodyText));
      } catch {
        return { status: 400, payload: { error: "invalid body" }, skipCache: true };
      }
      const followUpBy = parsed.followUpBy ? new Date(parsed.followUpBy) : null;
      if (parsed.followUpRequired && (!followUpBy || Number.isNaN(followUpBy.getTime()))) {
        return { status: 400, payload: { error: "followUpBy required when followUpRequired=true" }, skipCache: true };
      }

      const result = await withTenant(
        { organizationId, userId: ctx.userId, userRole: ctx.role, isOrgAdmin: ctx.isOrgAdmin },
        async (tx) => {
          // Verify the coordinator is allowed to contact this veteran (assigned
          // OR org program-manager).
          const profile = await tx.veteranProfile.findUnique({
            where: { userId: parsed.veteranId },
            select: { organizationId: true, assignedCoordinatorId: true },
          });
          if (!profile || profile.organizationId !== organizationId) {
            return { kind: "notFound" as const };
          }
          const isAssigned = profile.assignedCoordinatorId === ctx.userId;
          const isPM = ctx.role === "PROGRAM_MANAGER";
          if (!isAssigned && !isPM) return { kind: "forbidden" as const };

          const contactId = crypto.randomUUID();
          const cipher = encryptField(parsed.summary, contactAad(organizationId, contactId));
          const created = await tx.contact.create({
            data: {
              id: contactId,
              organizationId,
              veteranId: parsed.veteranId,
              coordinatorId: ctx.userId,
              contactType: parsed.contactType,
              direction: parsed.direction,
              summary: cipher,
              followUpRequired: !!parsed.followUpRequired,
              followUpBy,
              editableUntil: new Date(Date.now() + EDIT_WINDOW_MS),
            },
            select: { id: true, createdAt: true, editableUntil: true },
          });
          await logAudit(
            {
              organizationId,
              actorId: ctx.userId,
              actorRole: ctx.role,
              action: AUDIT_ACTIONS.CONTACT_LOG,
              resourceType: "Contact",
              resourceId: created.id,
              ipAddress: ctx.ipAddress,
              userAgent: ctx.userAgent,
              correlationId: ctx.correlationId,
              metadata: {
                veteranId: parsed.veteranId,
                contactType: parsed.contactType,
                direction: parsed.direction,
              },
            },
            tx,
          );
          return { kind: "ok" as const, contact: created };
        },
      );

      switch (result.kind) {
        case "notFound": return { status: 404, payload: { error: "veteran not found" }, skipCache: true };
        case "forbidden": return { status: 403, payload: { error: "not your veteran" }, skipCache: true };
        case "ok":
          return {
            status: 201,
            payload: {
              contactId: result.contact.id,
              createdAt: result.contact.createdAt.toISOString(),
              editableUntil: result.contact.editableUntil.toISOString(),
            },
          };
      }
    });
  },
  { roles: ["COORDINATOR", "PROGRAM_MANAGER"], rateLimit: "api.message" },
);
