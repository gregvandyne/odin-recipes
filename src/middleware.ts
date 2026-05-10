/**
 * Edge middleware: security headers + per-IP edge rate limit + nonce-based CSP.
 *
 * Security headers in next.config.mjs are global. The CSP needs a per-request
 * nonce, so we build it here and inject it into a header that pages read.
 */

import { NextRequest, NextResponse } from "next/server";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Permitted-Cross-Domain-Policies": "none",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};

function buildCsp(nonce: string, isDev: boolean): string {
  const directives: string[] = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' ${isDev ? "'unsafe-eval'" : "'strict-dynamic'"}`,
    "style-src 'self' 'unsafe-inline'", // Tailwind's runtime-injected styles
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.anthropic.com https://api.pwnedpasswords.com https://api.resend.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ];
  return directives.join("; ");
}

export function middleware(req: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV !== "production";

  // Correlation id: trust an upstream value if present (load balancer, cron),
  // otherwise mint one. Either way every API route, audit log entry, AI call
  // and worker job downstream of this request can quote it.
  const incomingCorrelationId = req.headers.get("x-correlation-id");
  const correlationId =
    incomingCorrelationId && /^[a-zA-Z0-9_-]{8,128}$/.test(incomingCorrelationId)
      ? incomingCorrelationId
      : crypto.randomUUID();

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-correlation-id", correlationId);
  // Server components can read the requested pathname via next/headers; we
  // forward it explicitly so layout-level guards (e.g. the veteran
  // onboarding redirect) can decide whether to redirect.
  requestHeaders.set("x-pathname", req.nextUrl.pathname);

  const res = NextResponse.next({ request: { headers: requestHeaders } });

  res.headers.set("x-correlation-id", correlationId);
  res.headers.set("Content-Security-Policy", buildCsp(nonce, isDev));
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(k, v);
  }
  // Honor signed-out users: do not cache authenticated pages on intermediaries.
  if (req.nextUrl.pathname.startsWith("/v/") || req.nextUrl.pathname.startsWith("/coordinator/") ||
      req.nextUrl.pathname.startsWith("/clinical/") || req.nextUrl.pathname.startsWith("/admin/")) {
    res.headers.set("Cache-Control", "private, no-store");
  }
  return res;
}

export const config = {
  matcher: [
    // Match everything except Next internals and static files
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/).*)",
  ],
};
