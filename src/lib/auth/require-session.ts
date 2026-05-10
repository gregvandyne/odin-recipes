import { redirect } from "next/navigation";
import { auth } from "./config";

/**
 * Server-component helper used at the top of every authenticated layout.
 *
 * Behavior:
 *   - No session → redirect to /auth/sign-in (with optional `next`).
 *   - Session but accountState !== ACTIVE → redirect to
 *     /auth/account-suspended with the reason embedded.
 *   - Otherwise return a typed session-user.
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
