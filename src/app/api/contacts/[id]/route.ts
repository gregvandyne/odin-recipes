/**
 * Edit a contact's summary within the 24h window. Past the window, the
 * trigger from migration 0001 rejects the update.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/security/api-auth";
import { withTenant } from "@/lib/db/tenant-context";
import { encryptField, contactAad } from "@/lib/security/encryption";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";

const Body = z.object({
  summary: z.string().min(1).max(4000),
});

export const PUT = withAuth(
  async (req: NextRequest, ctx) => {
    if (!ctx.organizationId) return NextResponse.json({ error: "no tenant" }, { status: 403 });
    const url = new URL(req.url);
    const contactId = url.pathname.split("/").filter(Boolean).at(-1);
    if (!contactId) return NextResponse.json({ error: "missing id" }, { status: 400 });
    let parsed: z.infer<typeof Body>;
    try {
      parsed = Body.parse(await req.json());
    } catch {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }
    const cipher = encryptField(parsed.summary, contactAad(ctx.organizationId, contactId));
    try {
      await withTenant(
        { organizationId: ctx.organizationId, userId: ctx.userId, userRole: ctx.role, isOrgAdmin: ctx.isOrgAdmin },
        async (tx) => {
          await tx.contact.update({
            where: { id: contactId },
            data: { summary: cipher },
          });
          await logAudit(
            {
              organizationId: ctx.organizationId!,
              actorId: ctx.userId,
              actorRole: ctx.role,
              action: AUDIT_ACTIONS.CONTACT_EDIT,
              resourceType: "Contact",
              resourceId: contactId,
              ipAddress: ctx.ipAddress,
              userAgent: ctx.userAgent,
              correlationId: ctx.correlationId,
            },
            tx,
          );
        },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown";
      if (message.includes("contact past 24h edit window")) {
        return NextResponse.json({ error: "edit window closed" }, { status: 410 });
      }
      throw err;
    }
    return NextResponse.json({ ok: true });
  },
  { roles: ["COORDINATOR", "PROGRAM_MANAGER"], rateLimit: "api.message" },
);
