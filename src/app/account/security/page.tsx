import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { RevokeAllButton } from "./revoke-all-button";

/**
 * /account/security — list active sessions, MFA status, sign-out everywhere.
 *
 * Also surfaces a "your backup password appears in a known breach" banner
 * when our last HIBP check on this user found a hit. The check runs on
 * successful password sign-in (fire-and-forget) and stores the result on
 * `PasswordCredential.breachCheckResult`; this surface is where we ask
 * the user to do something about it.
 */
export default async function SecurityPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/auth/sign-in");

  const [user, sessions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        mfaEnabled: true,
        mfaConfirmedAt: true,
        role: true,
        password: { select: { breachCheckedAt: true, breachCheckResult: true } },
      },
    }),
    prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gte: new Date() } },
      orderBy: { lastActiveAt: "desc" },
      select: {
        id: true,
        lastActiveAt: true,
        expiresAt: true,
        ipAddress: true,
        userAgent: true,
        mfaCompletedAt: true,
      },
    }),
  ]);

  const breached = !!user?.password?.breachCheckResult;

  return (
    <div className="mx-auto max-w-2xl px-6 py-8 space-y-6">
      <header>
        <p className="text-caption uppercase tracking-wide text-ink-tertiary">Account</p>
        <h1 className="mt-2 text-display font-semibold text-ink-primary">Security</h1>
      </header>

      {breached && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-md border border-crisis/30 bg-crisis/5 p-4"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-crisis" aria-hidden />
          <div className="text-body text-ink-primary">
            <p className="font-semibold">Your backup password has appeared in a known breach.</p>
            <p className="mt-1 text-ink-secondary">
              No one's been in your account — we caught it during a routine check. Pick a new
              password the next time you sign in with one, or switch to magic-link only.
            </p>
          </div>
        </div>
      )}

      <section className="rounded-lg border border-border bg-canvas-card p-5">
        <h2 className="text-body-lg font-semibold text-ink-primary">Two-factor authentication</h2>
        {user?.mfaEnabled ? (
          <p className="mt-2 text-body text-ink-secondary">
            Enabled. Confirmed{" "}
            {user.mfaConfirmedAt
              ? new Date(user.mfaConfirmedAt).toLocaleDateString()
              : "—"}.
          </p>
        ) : (
          <p className="mt-2 text-body text-ink-secondary">
            Not yet enabled.{" "}
            <Link href="/account/mfa/setup" className="font-semibold text-primary hover:underline">
              Set it up now.
            </Link>
          </p>
        )}
      </section>

      <section className="rounded-lg border border-border bg-canvas-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-body-lg font-semibold text-ink-primary">Active sessions</h2>
          <RevokeAllButton count={sessions.length} />
        </div>
        <ul className="mt-3 divide-y divide-border">
          {sessions.map((s) => (
            <li key={s.id} className="py-2 text-body text-ink-secondary">
              <span className="text-ink-primary">
                {s.userAgent ? truncateUA(s.userAgent) : "Unknown device"}
              </span>{" "}
              · last active {s.lastActiveAt.toLocaleString()}
              {s.mfaCompletedAt && (
                <span className="ml-2 text-caption text-ink-tertiary">MFA fresh</span>
              )}
            </li>
          ))}
          {sessions.length === 0 && (
            <li className="py-2 text-body text-ink-tertiary">No active sessions.</li>
          )}
        </ul>
      </section>
    </div>
  );
}

function truncateUA(ua: string): string {
  if (ua.length < 80) return ua;
  return ua.slice(0, 77) + "…";
}
