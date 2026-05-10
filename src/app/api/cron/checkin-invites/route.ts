/**
 * HTTP-triggered check-in invitation sweep.
 *
 * Two ways to schedule the hourly sweep:
 *   1. The BullMQ worker process (`npm run worker`) registers a repeatable
 *      job and handles invitations directly. Use this when you have a
 *      long-running worker container (Railway, Render, Fly).
 *   2. Vercel Cron (or any HTTP scheduler) hits this endpoint hourly. Use
 *      this when you only have the Next.js serverless deploy.
 *
 * Authentication: requires the `CRON_SECRET` env var. The caller sends
 * `Authorization: Bearer <CRON_SECRET>` (Vercel Cron does this automatically
 * via its `vercel.json` config). If the secret is unset, the endpoint refuses
 * to run — silent invocation is the wrong behavior for a privileged path.
 *
 * Either path runs the same sweep function (`runCheckinInviteSweep`), so the
 * tenant-context handling, dedup logic, and audit trails are identical.
 */

import { NextRequest, NextResponse } from "next/server";
import { runCheckinInviteSweep } from "@/workers/checkin-invite-cron";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";
import { withCorrelation, newCorrelationId, CORRELATION_HEADER } from "@/lib/logging/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return handle(req);
}

// Vercel Cron sends GET by default. Accept both so the same endpoint works
// for either schedule mechanism.
export async function GET(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured; refusing to run" },
      { status: 503 },
    );
  }

  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : auth;
  if (provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const correlationId = req.headers.get(CORRELATION_HEADER) ?? newCorrelationId();
  const log = withCorrelation(correlationId, { component: "cron.checkin-invites" });
  log.info("HTTP cron triggered");

  const summary = await runCheckinInviteSweep({
    triggeredAt: new Date().toISOString(),
    correlationId,
  });

  await logAudit({
    organizationId: null,
    actorId: null,
    actorRole: "SYSTEM",
    action: AUDIT_ACTIONS.CRON_TRIGGER,
    resourceType: "Cron",
    resourceId: "checkin-invites",
    correlationId,
    metadata: summary,
  });

  return NextResponse.json(
    { ok: true, ...summary },
    { headers: { [CORRELATION_HEADER]: correlationId } },
  );
}
