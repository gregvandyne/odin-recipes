/**
 * Hourly check-in invitation sweep.
 *
 * For every active veteran whose local check-in time matches the current
 * (local) hour, and who hasn't already been invited today AND hasn't yet
 * submitted this week, dispatch a WEEKLY_CHECKIN_INVITE notification.
 *
 * Why hourly: timezone-correctness. A veteran in Anchorage who picked
 * "Sunday 6pm" should get the invite at 6pm Anchorage time, not 6pm UTC.
 */

import { Worker, type Job } from "bullmq";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/tenant-context";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";
import { withCorrelation } from "@/lib/logging/log";
import { localDayOfWeek, localHourOfDay, currentWeekNumber } from "@/lib/program/week";
import { buildQueueConnection } from "@/lib/queue/redis";
import {
  QUEUE_CHECKIN_INVITES,
  type CheckinInviteSweepJob,
} from "@/lib/queue/queues";

export function buildCheckinInviteWorker(): Worker | null {
  const connection = buildQueueConnection();
  if (!connection) return null;

  return new Worker<CheckinInviteSweepJob>(
    QUEUE_CHECKIN_INVITES,
    async (job) => runCheckinInviteSweep(job.data),
    { connection, concurrency: 1 },
  );
}

export async function runCheckinInviteSweep(
  payload: CheckinInviteSweepJob,
): Promise<{ candidatesScanned: number; invitesDispatched: number }> {
  const log = withCorrelation(payload.correlationId, {
    component: "worker.checkin-invite-sweep",
  });
  const now = new Date();
  log.info("starting invitation sweep");

  // System-level scan. RLS is bypassed by setting app.is_super_admin=true
  // for the duration of this read, so we can find candidate veterans across
  // all tenants in one pass. Each subsequent write happens in a tenant-scoped
  // transaction.
  const veterans = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.is_super_admin', 'true', true), set_config('app.organization_id', '', true)`,
    );
    return tx.veteranProfile.findMany({
      where: { status: "ACTIVE" },
      select: {
        userId: true,
        organizationId: true,
        timezone: true,
        checkInDayOfWeek: true,
        checkInLocalTime: true,
        programStartDate: true,
        programEndDate: true,
      },
    });
  });

  let invitesDispatched = 0;
  for (const v of veterans) {
    const tz = v.timezone || "UTC";
    if (now < v.programStartDate || now > v.programEndDate) continue;

    const localDow = localDayOfWeek(now, tz);
    if (localDow !== v.checkInDayOfWeek) continue;

    const localHour = localHourOfDay(now, tz);
    const targetHour = parseInt(v.checkInLocalTime.split(":")[0] ?? "18", 10);
    if (localHour !== targetHour) continue;

    const week = currentWeekNumber(v.programStartDate, now, tz);
    const startOfDayLocalIso = startOfLocalDay(now, tz);

    // All veteran-specific writes happen in the veteran's tenant context so
    // the RLS policy and any per-tenant audit hooks apply correctly.
    const dispatched = await withTenant(
      {
        organizationId: v.organizationId,
        userId: v.userId,
        userRole: "SYSTEM",
        isOrgAdmin: false,
      },
      async (tx) => {
        const submitted = await tx.checkIn.count({
          where: { veteranId: v.userId, weekNumber: week },
        });
        if (submitted > 0) return false;

        const alreadyInvitedToday = await tx.notification.count({
          where: {
            recipientUserId: v.userId,
            category: "WEEKLY_CHECKIN_INVITE",
            queuedAt: { gte: startOfDayLocalIso },
          },
        });
        if (alreadyInvitedToday > 0) return false;

        await tx.notification.create({
          data: {
            organizationId: v.organizationId,
            recipientUserId: v.userId,
            category: "WEEKLY_CHECKIN_INVITE",
            channel: "EMAIL",
            subject: "Your weekly check-in is ready",
            bodyTemplateId: "weekly-checkin-invite-v1",
            relatedResourceType: "VeteranProfile",
            relatedResourceId: v.userId,
          },
        });

        await logAudit(
          {
            organizationId: v.organizationId,
            actorId: null,
            actorRole: "SYSTEM",
            action: AUDIT_ACTIONS.INVITE_DISPATCH,
            resourceType: "Notification",
            resourceId: v.userId,
            correlationId: payload.correlationId,
            metadata: {
              category: "WEEKLY_CHECKIN_INVITE",
              weekNumber: week,
              localHour,
              localDayOfWeek: localDow,
              timezone: tz,
            },
          },
          tx,
        );
        return true;
      },
    );

    if (dispatched) invitesDispatched += 1;
  }

  log.info(
    { invitesDispatched, candidatesScanned: veterans.length },
    "invitation sweep complete",
  );
  return { candidatesScanned: veterans.length, invitesDispatched };
}

function startOfLocalDay(now: Date, timezone: string): Date {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => fmt.find((p) => p.type === t)?.value ?? "";
  const y = parseInt(get("year"), 10);
  const m = parseInt(get("month"), 10);
  const d = parseInt(get("day"), 10);
  return new Date(Date.UTC(y, m - 1, d));
}
