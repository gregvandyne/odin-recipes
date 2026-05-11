/**
 * Same-origin CSRF guard.
 *
 * Acceptance rules — Origin (or Referer fallback) must match either:
 *   1. The request's own host header (every legitimate browser request to
 *      our API from a same-origin page satisfies this — works for
 *      production, preview deploys, and PR-bot-spawned Vercel URLs without
 *      any configuration).
 *   2. The configured AUTH_URL host (allows trusted callbacks from the
 *      canonical origin even when accessed via a non-canonical hostname).
 *
 * Returns `true` for safe requests, `false` for cross-origin.
 *
 * Lives in its own module so it can be unit-tested without dragging
 * next-auth (and its build-time-only modules) into the test runtime.
 */

interface RequestLike {
  headers: { get(name: string): string | null };
}

export function isSameOrigin(req: RequestLike): boolean {
  const allowedHosts = new Set<string>();
  const requestHost = req.headers.get("host");
  if (requestHost) allowedHosts.add(requestHost.toLowerCase());

  if (process.env.AUTH_URL) {
    try {
      allowedHosts.add(new URL(process.env.AUTH_URL).host.toLowerCase());
    } catch {
      /* malformed AUTH_URL — fall back to request-host only */
    }
  }

  // No canonical reference at all (no host header, no AUTH_URL): defer to
  // upstream layers (NextAuth CSRF, SameSite cookies). This typically only
  // happens in offline test fixtures.
  if (allowedHosts.size === 0) return true;

  const candidate = req.headers.get("origin") ?? req.headers.get("referer");
  if (!candidate) return false;
  try {
    const u = new URL(candidate);
    return allowedHosts.has(u.host.toLowerCase());
  } catch {
    return false;
  }
}
