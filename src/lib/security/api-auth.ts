/**
 * API route authorization wrapper.
 *
 * Every authenticated route uses `withAuth(handler, opts)`:
 *   - resolves the session
 *   - validates account state is ACTIVE
 *   - verifies role is one of `roles`
 *   - resolves and binds tenant context (organizationId)
 *   - applies rate limiting
 *   - passes a typed AuthContext to the handler
 *
 * No route should ever read session or role state directly. This wrapper
 * is the chokepoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { consume, ipFromRequest, type LimitName } from "./rate-limit";
import { withCorrelation, newCorrelationId, CORRELATION_HEADER, type Logger } from "@/lib/logging/log";
import { withErrorTracking } from "@/lib/observability/sentry";

export type Role =
  | "SUPER_ADMIN"
  | "VETERAN"
  | "COORDINATOR"
  | "CLINICAL_LEAD"
  | "PROGRAM_MANAGER";

export interface AuthContext {
  userId: string;
  role: Role;
  organizationId: string | null;
  isOrgAdmin: boolean;
  email: string;
  ipAddress: string;
  userAgent: string;
  correlationId: string;
  logger: Logger;
}

export interface WithAuthOpts {
  /** Allowed roles. If omitted, any authenticated user is allowed. */
  roles?: Role[];
  /** Require an isOrgAdmin flag in addition to role. */
  requireOrgAdmin?: boolean;
  /** Rate-limit bucket. Identifier is the user id. */
  rateLimit?: LimitName;
  /** Require organizationId to be set (everything except SUPER_ADMIN-only paths). */
  requireOrganization?: boolean;
  /**
   * Require a recent successful MFA challenge for this action. Used for
   * sensitive paths (severity overrides, deactivations, audit exports).
   *
   * Implementation: the session callback stamps `Session.mfaCompletedAt` after
   * a successful TOTP challenge. The check passes if mfaCompletedAt is within
   * `MFA_FRESH_WINDOW_MS` of now.
   */
  requireMfa?: boolean;
}

const MFA_FRESH_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Most route handlers return NextResponse, but SSE streams + binary responses
// return a plain Response. Both are acceptable.
type Handler = (req: NextRequest, ctx: AuthContext) => Promise<NextResponse | Response>;

/**
 * Methods that mutate server state. Same-origin enforcement applies to these
 * — see comment below.
 */
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Same-origin CSRF guard lives in `./same-origin` so it can be unit-tested
// without importing the auth pipeline. Re-exported here for convenience.
import { isSameOrigin } from "./same-origin";
export { isSameOrigin };

export function withAuth(handler: Handler, opts: WithAuthOpts = {}): (req: NextRequest) => Promise<Response> {
  return async (req: NextRequest) => {
    // Same-origin CSRF defense: state-changing routes must come from our
    // own host. Browser default cookie SameSite + NextAuth CSRF tokens are
    // the first line of defense; this is the second. Skip for GET because
    // safe methods don't mutate state.
    if (STATE_CHANGING_METHODS.has(req.method) && !isSameOrigin(req)) {
      return NextResponse.json({ error: "cross-origin denied" }, { status: 403 });
    }
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    const u = session.user as {
      id: string;
      role?: Role;
      organizationId?: string | null;
      isOrgAdmin?: boolean;
      email?: string | null;
    };
    if (!u.role) return NextResponse.json({ error: "no role" }, { status: 403 });
    if (opts.roles && !opts.roles.includes(u.role)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (opts.requireOrgAdmin && !u.isOrgAdmin) {
      return NextResponse.json({ error: "org admin only" }, { status: 403 });
    }
    if (opts.requireOrganization !== false && !u.organizationId && u.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "no tenant" }, { status: 403 });
    }

    const correlationId = req.headers.get(CORRELATION_HEADER) ?? newCorrelationId();
    const ctx: AuthContext = {
      userId: u.id,
      role: u.role,
      organizationId: u.organizationId ?? null,
      isOrgAdmin: !!u.isOrgAdmin,
      email: u.email ?? "",
      ipAddress: ipFromRequest(req.headers),
      userAgent: req.headers.get("user-agent") ?? "",
      correlationId,
      logger: withCorrelation(correlationId, {
        userId: u.id,
        role: u.role,
        organizationId: u.organizationId ?? null,
        path: req.nextUrl.pathname,
      }),
    };

    if (opts.rateLimit) {
      const r = await consume(opts.rateLimit, ctx.userId);
      if (!r.allowed) {
        return NextResponse.json(
          { error: "rate limited", retryAfterMs: r.retryAfterMs },
          {
            status: 429,
            headers: {
              "Retry-After": String(Math.ceil(r.retryAfterMs / 1000)),
              "X-RateLimit-Remaining": "0",
              [CORRELATION_HEADER]: correlationId,
            },
          },
        );
      }
    }

    if (opts.requireMfa) {
      // Read the session token to find the active session row + mfaCompletedAt.
      // Defer-import to avoid pulling Prisma into edge bundles unnecessarily.
      const { prisma } = await import("@/lib/db/prisma");
      const recent = await prisma.session.findFirst({
        where: {
          userId: ctx.userId,
          revokedAt: null,
          mfaCompletedAt: { gte: new Date(Date.now() - MFA_FRESH_WINDOW_MS) },
        },
        orderBy: { mfaCompletedAt: "desc" },
        select: { id: true },
      });
      if (!recent) {
        return NextResponse.json(
          { error: "mfa_required", reason: "Please complete an MFA challenge to perform this action." },
          {
            status: 403,
            headers: { [CORRELATION_HEADER]: correlationId },
          },
        );
      }
    }

    const res = await withErrorTracking(`route:${req.nextUrl.pathname}`, () => handler(req, ctx), {
      correlationId,
      method: req.method,
      role: u.role,
    });
    // Streamed responses (SSE) may have read-only headers — set best-effort.
    try {
      res.headers.set(CORRELATION_HEADER, correlationId);
    } catch {
      /* immutable headers — ignore */
    }
    return res;
  };
}
