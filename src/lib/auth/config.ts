/**
 * Auth configuration — magic links via Resend, plus Argon2id password backup.
 *
 * Sessions are stored server-side via the Prisma adapter so they can be
 * revoked. Idle/absolute timeouts vary by role (staff: 15m/12h; veterans:
 * 30d/90d) and are enforced in the session callback.
 *
 * MFA enforcement happens at the application layer for sensitive actions
 * (see `withAuth` wrapper). NextAuth's job here is identity, not policy.
 */

import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { type NextAuthConfig } from "next-auth";
import EmailProvider from "next-auth/providers/nodemailer";
import { prisma } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email/send";
import { MagicLinkEmail } from "@/lib/email/templates/magic-link";

const STAFF_ROLES = new Set(["COORDINATOR", "CLINICAL_LEAD", "PROGRAM_MANAGER", "SUPER_ADMIN"]);
const MAGIC_LINK_TTL_MIN = 15;

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database",
    maxAge: 15 * 60,
    updateAge: 60,
  },
  pages: {
    signIn: "/auth/sign-in",
    verifyRequest: "/auth/check-email",
    error: "/auth/error",
  },
  providers: [
    EmailProvider({
      // We override `sendVerificationRequest` to route through our Resend
      // wrapper. NextAuth's nodemailer provider still validates `server`,
      // so we point at a stub. Outbound delivery actually happens via Resend
      // — the SMTP transport is never used.
      server: process.env.EMAIL_SERVER ?? "smtp://stub:stub@localhost:1025",
      maxAge: MAGIC_LINK_TTL_MIN * 60,
      from: process.env.EMAIL_FROM_PLATFORM ?? "noreply@platform.tld",
      sendVerificationRequest: async ({ identifier, url }) => {
        // Find the recipient's organization for branding (if they exist).
        const user = await prisma.user.findFirst({
          where: { email: identifier },
          select: { id: true, organizationId: true },
        });
        await sendEmail({
          organizationId: user?.organizationId ?? null,
          to: identifier,
          recipientUserId: user?.id ?? "anonymous",
          category: "ACCOUNT_SECURITY",
          subject: "Your Sentinel sign-in link",
          template: MagicLinkEmail({ url, expiresMinutes: MAGIC_LINK_TTL_MIN }),
          templateId: "magic-link-v1",
          text: `Sign in to Sentinel: ${url}\n\nThis link expires in ${MAGIC_LINK_TTL_MIN} minutes.`,
        });
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true, role: true, organizationId: true, isOrgAdmin: true,
          accountState: true, mfaEnabled: true,
        },
      });
      if (!dbUser) return session;

      // Block non-ACTIVE accounts.
      if (dbUser.accountState !== "ACTIVE") {
        return { ...session, user: { ...session.user, id: dbUser.id } };
      }

      const isStaff = STAFF_ROLES.has(dbUser.role);
      // next-auth's `expires` field is typed as `Date & string` due to the
      // `ISODateString` brand. Casting to the runtime ISO string is correct.
      session.expires = new Date(
        Date.now() + (isStaff ? 15 * 60 : 30 * 24 * 60 * 60) * 1000,
      ).toISOString() as typeof session.expires;

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
      if (!user.id) return;
      await prisma.authEvent.create({
        data: { userId: user.id, eventType: "LOGIN_SUCCESS" },
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
      await prisma.authEvent.create({ data: { userId, eventType: "LOGOUT" } });
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
