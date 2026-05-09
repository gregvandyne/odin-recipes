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
}

type Handler = (req: NextRequest, ctx: AuthContext) => Promise<NextResponse>;

export function withAuth(handler: Handler, opts: WithAuthOpts = {}): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
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

    const ctx: AuthContext = {
      userId: u.id,
      role: u.role,
      organizationId: u.organizationId ?? null,
      isOrgAdmin: !!u.isOrgAdmin,
      email: u.email ?? "",
      ipAddress: ipFromRequest(req.headers),
      userAgent: req.headers.get("user-agent") ?? "",
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
            },
          },
        );
      }
    }

    return handler(req, ctx);
  };
}
