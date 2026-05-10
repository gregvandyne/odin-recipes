/**
 * Super-admin org provisioning.
 *
 * POST /api/admin/orgs
 *   body: {
 *     slug, name, primaryContactEmail, organizationType,
 *     mfaEnforcementLevel?, branding?
 *   }
 *
 * Creates a new Organization in `PROVISIONING → TEST_MODE` with
 * `testModeUntil = now + 14 days`. Optionally sends an Org-Admin invitation.
 * Sensitive — requires fresh MFA.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/security/api-auth";
import { prisma } from "@/lib/db/prisma";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";
import { generateInvitationToken } from "@/lib/auth/invitation";

const Body = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,40}$/),
  name: z.string().min(2).max(120),
  primaryContactEmail: z.string().email().max(254),
  organizationType: z.string().max(40),
  mfaEnforcementLevel: z.enum(["REQUIRED_ALL", "REQUIRED_STAFF", "OPTIONAL"]).optional(),
  branding: z.record(z.unknown()).optional(),
  inviteOrgAdmin: z.boolean().optional(),
});

const TEST_MODE_DAYS = 14;

export const POST = withAuth(
  async (req, ctx) => {
    if (ctx.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    let parsed: z.infer<typeof Body>;
    try {
      parsed = Body.parse(await req.json());
    } catch {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Super-admin is allowed to bypass RLS for provisioning. Set the GUC
      // explicitly so any nested triggers see the right context.
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.is_super_admin', 'true', true)`,
      );

      const org = await tx.organization.create({
        data: {
          slug: parsed.slug,
          name: parsed.name,
          primaryContactEmail: parsed.primaryContactEmail,
          organizationType: parsed.organizationType,
          mfaEnforcementLevel: parsed.mfaEnforcementLevel ?? "REQUIRED_STAFF",
          branding: (parsed.branding ?? {}) as object,
          status: "TEST_MODE",
          testModeUntil: new Date(Date.now() + TEST_MODE_DAYS * 86_400_000),
        },
      });

      // Provisioning state transition.
      await tx.organizationStateTransition.create({
        data: {
          organizationId: org.id,
          fromState: "PROVISIONING",
          toState: "TEST_MODE",
          transitionedById: ctx.userId,
          reason: "initial provisioning via super-admin wizard",
        },
      });

      let invitation: { rawToken: string } | null = null;
      if (parsed.inviteOrgAdmin) {
        const token = generateInvitationToken();
        await tx.invitation.create({
          data: {
            organizationId: org.id,
            email: parsed.primaryContactEmail,
            role: "PROGRAM_MANAGER",
            isOrgAdmin: true,
            invitedById: ctx.userId,
            tokenHash: token.hash,
            expiresAt: token.expiresAt,
            inviterMessage:
              "Welcome to Sentinel — you're the first admin for your organization.",
          },
        });
        invitation = { rawToken: token.raw };
      }

      await logAudit(
        {
          organizationId: org.id,
          actorId: ctx.userId,
          actorRole: ctx.role,
          action: AUDIT_ACTIONS.ORG_PROVISION,
          resourceType: "Organization",
          resourceId: org.id,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          correlationId: ctx.correlationId,
          metadata: {
            slug: org.slug,
            organizationType: org.organizationType,
            testModeUntil: org.testModeUntil?.toISOString(),
          },
        },
        tx,
      );

      return { org, invitation };
    });

    return NextResponse.json({
      ok: true,
      organizationId: result.org.id,
      slug: result.org.slug,
      // Surface the raw invitation token only to the super admin who created it.
      // For production, pipe this through email instead of returning inline.
      inviteToken: result.invitation?.rawToken ?? null,
    });
  },
  { roles: ["SUPER_ADMIN"], rateLimit: "auth.password", requireMfa: true, requireOrganization: false },
);
