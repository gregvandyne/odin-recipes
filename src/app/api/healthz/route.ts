/**
 * Liveness probe.
 *
 * Returns 200 as long as the Node process is alive. Does NOT check downstream
 * dependencies (those belong on /api/readyz). Load balancers should target
 * this endpoint to decide whether to keep the instance in rotation.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "sentinel",
    timestamp: new Date().toISOString(),
  });
}
