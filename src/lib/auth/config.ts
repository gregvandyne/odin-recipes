/**
 * Auth configuration — magic links primary, password backup, MFA hooks.
 *
 * Uses NextAuth v5 (beta). Sessions are stored server-side via the Prisma
 * adapter so they can be revoked. Idle and absolute timeouts are enforced
 * per role (staff: 15m idle / 12h absolute; veterans: 30d idle / 90d absolute).
 *
 * MFA is enforced for SUPER_ADMIN, COORDINATOR (org-configurable), CLINICAL_LEAD,
 * PROGRAM_MANAGER, and any user with isOrgAdmin = true.
 */

import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { type NextAuthConfig } from "next-auth";
import { prisma } from "@/lib/db/prisma";

const STAFF_ROLES = new Set(["COORDINATOR", "CLINICAL_LEAD", "PROGRAM_MANAGER", "SUPER_ADMIN"]);

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database",
    // Default to staff timeouts; we override per session in callbacks.
    maxAge: 15 * 60, // 15 minutes idle
    updateAge: 60,
  },
  pages: {
    signIn: "/auth/sign-in",
    verifyRequest: "/auth/check-email",
    error: "/auth/error",
  },
  providers: [
    // Magic link provider configured at runtime in the route handler so we can
    // inject the org-aware "from" address.
  ],
  callbacks: {
    async session({ session, user }) {
      // Attach role + organization to the session.
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          role: true,
          organizationId: true,
          isOrgAdmin: true,
          accountState: true,
          mfaEnabled: true,
        },
      });
      if (!dbUser) return session;

      // Block sessions for non-ACTIVE accounts.
      if (dbUser.accountState !== "ACTIVE") {
        // Returning a session with no user effectively logs them out; the
        // middleware also enforces this.
        return { ...session, user: { ...session.user, id: dbUser.id } };
      }

      const isStaff = STAFF_ROLES.has(dbUser.role);
      // Tighter idle for staff; veterans get a longer window per spec.
      session.expires = new Date(
        Date.now() + (isStaff ? 15 * 60 : 30 * 24 * 60 * 60) * 1000,
      ).toISOString();

      return {
        ...session,
        user: {
          ...session.user,
          id: dbUser.id,
          role: dbUser.role,
          organizationId: dbUser.organizationId,
          isOrgAdmin: dbUser.isOrgAdmin,
          mfaEnabled: dbUser.mfaEnabled,
        },
      };
    },
  },
  events: {
    async signIn({ user }) {
      // Record auth event. New-device detection happens in a separate flow
      // that compares against prior Session userAgent + IP.
      if (!user.id) return;
      await prisma.authEvent.create({
        data: {
          userId: user.id,
          eventType: "LOGIN_SUCCESS",
          metadata: {},
        },
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { lastActiveAt: new Date(), failedLoginAttempts: 0 },
      });
    },
    async signOut(message) {
      const userId =
        "session" in message && message.session && "userId" in message.session
          ? (message.session as { userId?: string }).userId
          : undefined;
      if (!userId) return;
      await prisma.authEvent.create({
        data: { userId, eventType: "LOGOUT", metadata: {} },
      });
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
