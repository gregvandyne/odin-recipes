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
    async (job) => runCheckinInviteSweep(job),
    { connection, concurrency: 1 },
  );
}

export async function runCheckinInviteSweep(job: Job<CheckinInviteSweepJob>): Promise<void> {
  const log = withCorrelation(job.data.correlationId, {
    component: "worker.checkin-invite-sweep",
  });
  const now = new Date();
  log.info("starting invitation sweep");

  // Pull all active veterans with their tz preferences. RLS is bypassed here
  // because this is a system-level cron job; we still scope every operation
  // by organizationId on writes.
  const veterans = await prisma.veteranProfile.findMany({
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

    // Already submitted this week?
    const submitted = await prisma.checkIn.count({
      where: { veteranId: v.userId, weekNumber: week },
    });
    if (submitted > 0) continue;

    // Already invited today?
    const startOfDayLocalIso = startOfLocalDay(now, tz);
    const alreadyInvitedToday = await prisma.notification.count({
      where: {
        recipientUserId: v.userId,
        category: "WEEKLY_CHECKIN_INVITE",
        queuedAt: { gte: startOfDayLocalIso },
      },
    });
    if (alreadyInvitedToday > 0) continue;

    await prisma.notification.create({
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
    invitesDispatched += 1;
  }

  log.info({ invitesDispatched, candidatesScanned: veterans.length }, "invitation sweep complete");
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
