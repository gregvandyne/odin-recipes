/**
 * Screenshot capture bypass.
 *
 * **Disabled by default.** Only active when the environment variable
 * `SCREENSHOT_BYPASS` is set to "1". Production deploys must never set
 * this — its existence in the env should fail the deploy smoke check
 * before any real veteran traffic touches the box.
 *
 * When active and the inbound request carries a cookie
 *   x-screenshot-as=<userId>
 * we return a synthetic session that looks identical to a real NextAuth
 * one. This lets the screenshot script capture authenticated surfaces
 * (coordinator queue, veteran timeline, …) without spinning up a real
 * mail server + click-through magic-link flow.
 *
 * The bypass only reads the user id from the cookie; everything else
 * (role, organizationId, accountState, …) comes from the database. So
 * even with the bypass on, an attacker can't escalate by writing a
 * crafted cookie — the cookie can only impersonate users that already
 * exist in the DB. Combined with the env-gating, the surface area is
 * "anyone with `SCREENSHOT_BYPASS=1` set on the deploy" which is the
 * same blast radius as "anyone with access to the deploy".
 */

import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";

export interface BypassSession {
  user: {
    id: string;
    email: string | null;
    name: string | null;
    role: "VETERAN" | "COORDINATOR" | "CLINICAL_LEAD" | "PROGRAM_MANAGER" | "SUPER_ADMIN";
    organizationId: string | null;
    isOrgAdmin: boolean;
    mfaEnabled: boolean;
    accountState: string;
  };
  expires: string;
}

export async function screenshotBypassSession(): Promise<BypassSession | null> {
  if (process.env.SCREENSHOT_BYPASS !== "1") return null;
  const asUserId = cookies().get("x-screenshot-as")?.value;
  if (!asUserId) return null;
  const u = await prisma.user.findUnique({
    where: { id: asUserId },
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      organizationId: true,
      isOrgAdmin: true,
      mfaEnabled: true,
      accountState: true,
    },
  });
  if (!u) return null;
  return {
    user: {
      id: u.id,
      email: u.email,
      name: u.displayName,
      role: u.role,
      organizationId: u.organizationId,
      isOrgAdmin: u.isOrgAdmin,
      mfaEnabled: u.mfaEnabled,
      accountState: u.accountState,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}
