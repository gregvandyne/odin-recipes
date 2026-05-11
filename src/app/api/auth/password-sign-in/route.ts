/**
 * Password sign-in for staff who have a backup password set.
 *
 * Magic-link is the primary auth path. Staff with a `PasswordCredential` row
 * may sign in via password as a fallback (e.g. magic-link delivery is
 * delayed). MFA challenge fires on the next request after this succeeds.
 *
 * The route deliberately does NOT mint the session itself — it validates
 * the credentials and, on success, returns a one-shot token the client uses
 * to call NextAuth's credentials provider in a follow-up. For now we just
 * return ok + the user id so a higher-level flow can decide what to do.
 *
 * NextAuth's CredentialsProvider would be the right next step; this route
 * is the verification primitive.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword, checkHibpBreach } from "@/lib/auth/password";
import { consume, ipFromRequest } from "@/lib/security/rate-limit";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";

const Body = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(256),
});

/**
 * Account lockout: after N consecutive failed password attempts, set
 * `lockedUntil` to (now + LOCKOUT_MS). The lockout windows compound so a
 * sustained brute-force attempt locks the account for hours, not seconds,
 * while a legitimate "forgot password" user clears in 15 minutes.
 *
 * Counter resets to 0 on any successful sign-in.
 */
const LOCKOUT_THRESHOLD = 6;
const LOCKOUT_BASE_MS = 15 * 60 * 1000;
const LOCKOUT_MAX_MS = 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  const headers = new Headers(req.headers);
  const ip = ipFromRequest(headers);
  const limit = await consume("auth.login", `pwd:${ip}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate limited", retryAfterMs: limit.retryAfterMs },
      { status: 429 },
    );
  }

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const lc = parsed.email.toLowerCase();
  const user = await prisma.user.findFirst({
    where: { email: lc },
    select: {
      id: true,
      role: true,
      organizationId: true,
      accountState: true,
      lockedUntil: true,
      password: { select: { passwordHash: true } },
    },
  });
  if (!user || !user.password) {
    return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  }
  if (user.accountState !== "ACTIVE") {
    return NextResponse.json({ error: "account_not_active" }, { status: 403 });
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return NextResponse.json({ error: "account_locked" }, { status: 423 });
  }
  // Veterans don't use password auth; they're magic-link-only.
  if (user.role === "VETERAN") {
    return NextResponse.json({ error: "magic_link_only" }, { status: 403 });
  }
  const ok = await verifyPassword(parsed.password, user.password.passwordHash);
  if (!ok) {
    // Increment the counter; lock the account if we crossed the threshold.
    // Lock duration backs off exponentially up to LOCKOUT_MAX_MS so a
    // sustained brute-force gets shut out, while a legitimate user who
    // mistypes a few times waits 15 minutes.
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });
    if (updated.failedLoginAttempts >= LOCKOUT_THRESHOLD) {
      const overage = updated.failedLoginAttempts - LOCKOUT_THRESHOLD;
      const lockMs = Math.min(LOCKOUT_BASE_MS * 2 ** overage, LOCKOUT_MAX_MS);
      const lockedUntil = new Date(Date.now() + lockMs);
      await prisma.user.update({
        where: { id: user.id },
        data: { lockedUntil },
      });
      await logAudit({
        organizationId: user.organizationId,
        actorId: null,
        actorRole: "SYSTEM",
        action: AUDIT_ACTIONS.LOCKOUT,
        resourceType: "User",
        resourceId: user.id,
        ipAddress: ip,
        metadata: { failedAttempts: updated.failedLoginAttempts, lockMs },
      });
      return NextResponse.json(
        { error: "account_locked", lockedUntil: lockedUntil.toISOString() },
        { status: 423 },
      );
    }
    return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lastActiveAt: new Date(), lockedUntil: null },
  });

  // Background breach check — non-blocking. If the password was found in
  // HIBP we record it on the credential so the next sign-in surfaces a
  // banner asking the user to rotate.
  void (async () => {
    try {
      const breached = await checkHibpBreach(parsed.password);
      await prisma.passwordCredential.update({
        where: { userId: user.id },
        data: { breachCheckedAt: new Date(), breachCheckResult: breached },
      });
    } catch {
      /* noop */
    }
  })();

  return NextResponse.json({ ok: true, userId: user.id, mfaRequired: true });
}
