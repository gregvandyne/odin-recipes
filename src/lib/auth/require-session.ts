import { redirect } from "next/navigation";
import { auth } from "./config";
import { prisma } from "@/lib/db/prisma";

/**
 * Server-component helper used at the top of every authenticated layout.
 *
 * Behavior:
 *   - No session → redirect to /auth/sign-in (with optional `next`).
 *   - Session but accountState !== ACTIVE → redirect to
 *     /auth/account-suspended with the reason embedded.
 *   - Otherwise return a typed session-user.
 *
 * Use `requireMfaIfRequired()` separately when an org's
 * `mfaEnforcementLevel` should gate the layout (staff surfaces).
 */
export interface AuthedUser {
  id: string;
  role: "VETERAN" | "COORDINATOR" | "CLINICAL_LEAD" | "PROGRAM_MANAGER" | "SUPER_ADMIN";
  organizationId: string | null;
  isOrgAdmin: boolean;
  email: string;
  mfaEnabled: boolean;
}

export async function requireActiveSession(opts: { next?: string } = {}): Promise<AuthedUser> {
  const session = await auth();
  const u = session?.user as
    | {
        id?: string;
        role?: AuthedUser["role"];
        organizationId?: string | null;
        isOrgAdmin?: boolean;
        email?: string;
        mfaEnabled?: boolean;
        accountState?: string;
      }
    | undefined;

  if (!u?.id) {
    redirect(opts.next ? `/auth/sign-in?next=${encodeURIComponent(opts.next)}` : "/auth/sign-in");
  }
  if (u.accountState && u.accountState !== "ACTIVE") {
    redirect(`/auth/account-suspended?reason=${encodeURIComponent(u.accountState)}`);
  }
  if (!u.role) {
    // Race: account was just deactivated mid-session. Send to suspended page.
    redirect("/auth/account-suspended");
  }

  return {
    id: u.id,
    role: u.role,
    organizationId: u.organizationId ?? null,
    isOrgAdmin: !!u.isOrgAdmin,
    email: u.email ?? "",
    mfaEnabled: !!u.mfaEnabled,
  };
}

const STAFF_ROLES: Set<AuthedUser["role"]> = new Set([
  "COORDINATOR",
  "CLINICAL_LEAD",
  "PROGRAM_MANAGER",
  "SUPER_ADMIN",
]);

/**
 * Bounce a staff user without MFA to /account/mfa/setup when their org
 * requires it.
 *
 *   REQUIRED_ALL    → gate every active user, including veterans.
 *   REQUIRED_STAFF  → gate every staff role; veterans pass through.
 *   OPTIONAL        → no gate.
 *
 * Call from staff/admin/clinical layouts after `requireActiveSession`.
 * No-op for SUPER_ADMIN without an organizationId (cross-org root).
 */
export async function requireMfaIfRequired(user: AuthedUser): Promise<void> {
  if (user.mfaEnabled) return;
  if (!user.organizationId) return;

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: { mfaEnforcementLevel: true },
  });
  if (!org) return;

  if (org.mfaEnforcementLevel === "OPTIONAL") return;
  if (org.mfaEnforcementLevel === "REQUIRED_STAFF" && !STAFF_ROLES.has(user.role)) return;
  // REQUIRED_ALL or (REQUIRED_STAFF and staff): require MFA setup.
  redirect("/account/mfa/setup?required=1");
}
