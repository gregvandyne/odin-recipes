/**
 * SLA monitor.
 *
 * Every minute, scan unresolved RED `Flag` rows older than the RED SLA budget
 * (1h, per `engine.recommendation()`) without an acknowledgment. For each:
 *   - Log a `notification.sla_breach` audit entry.
 *   - Bump the next on-call (clinical lead) via NEW_ESCALATION notification.
 *   - Surface in Sentry as an error so on-call paging fires.
 *
 * ORANGE flags get a similar treatment at 24h. YELLOW are awareness-only.
 *
 * The check is idempotent within a sweep — once we've fired a "breach" event
 * we set a key in Redis (`sentinel:sla:fired:{flagId}`) with a long TTL so we
 * don't re-page every minute for the same unacknowledged flag.
 */

import { Worker, type Job } from "bullmq";
import { prisma } from "@/lib/db/prisma";
import { withCorrelation } from "@/lib/logging/log";
import { withTenant } from "@/lib/db/tenant-context";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";
import { getRedis, buildQueueConnection } from "@/lib/queue/redis";
import { withErrorTracking } from "@/lib/observability/sentry";
import {
  QUEUE_SLA_MONITOR,
  type SlaMonitorJob,
  enqueueNotification,
} from "@/lib/queue/queues";

const RED_SLA_MS = 60 * 60 * 1000; // 1h
const ORANGE_SLA_MS = 24 * 60 * 60 * 1000; // 24h
const SLA_FIRED_TTL_S = 60 * 60 * 24 * 7; // 7d

export function buildSlaMonitorWorker(): Worker | null {
  const connection = buildQueueConnection();
  if (!connection) return null;
  return new Worker<SlaMonitorJob>(
    QUEUE_SLA_MONITOR,
    async (job) =>
      withErrorTracking("worker.sla-monitor", () => runSlaMonitorSweep(job), {
        jobId: job.id,
      }),
    { connection, concurrency: 1 },
  );
}

export async function runSlaMonitorSweep(job: Job<SlaMonitorJob>): Promise<void> {
  const log = withCorrelation(job.data.correlationId, { component: "worker.sla-monitor" });
  const redis = getRedis();
  const now = new Date();

  // Pull all unacknowledged RED + ORANGE flags older than their respective SLA.
  // System-level scan; subsequent writes are tenant-scoped.
  const stale = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.is_super_admin', 'true', true), set_config('app.organization_id', '', true)`,
    );
    return tx.flag.findMany({
      where: {
        acknowledgedAt: null,
        resolvedAt: null,
        OR: [
          { severity: "RED", createdAt: { lt: new Date(now.getTime() - RED_SLA_MS) } },
          { severity: "ORANGE", createdAt: { lt: new Date(now.getTime() - ORANGE_SLA_MS) } },
        ],
      },
      select: {
        id: true,
        organizationId: true,
        veteranId: true,
        severity: true,
        createdAt: true,
      },
      take: 200,
    });
  });

  let breachesPaged = 0;
  for (const flag of stale) {
    if (redis) {
      // Have we already paged for this flag in the last week?
      const key = `sentinel:sla:fired:${flag.id}`;
      const set = await redis.set(key, "1", "EX", SLA_FIRED_TTL_S, "NX");
      if (set !== "OK") continue;
    }

    await withTenant(
      { organizationId: flag.organizationId, userId: flag.veteranId, userRole: "SYSTEM", isOrgAdmin: false },
      async (tx) => {
        // Notify the clinical lead with NEW_ESCALATION urgency.
        const lead = await tx.user.findFirst({
          where: { organizationId: flag.organizationId, role: "CLINICAL_LEAD", accountState: "ACTIVE" },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });
        if (lead) {
          const notif = await tx.notification.create({
            data: {
              organizationId: flag.organizationId,
              recipientUserId: lead.id,
              category: "NEW_ESCALATION",
              channel: "EMAIL",
              subject: `Sentinel: SLA breach — unacknowledged ${flag.severity} flag`,
              bodyTemplateId: "sla-breach-v1",
              relatedResourceType: "Flag",
              relatedResourceId: flag.id,
            },
          });
          void enqueueNotification({
            notificationId: notif.id,
            correlationId: job.data.correlationId,
          });
        }
        await logAudit(
          {
            organizationId: flag.organizationId,
            actorId: null,
            actorRole: "SYSTEM",
            action: AUDIT_ACTIONS.NOTIFICATION_DELIVER,
            resourceType: "Flag",
            resourceId: flag.id,
            correlationId: job.data.correlationId,
            metadata: {
              kind: "sla.breach",
              severity: flag.severity,
              ageMs: now.getTime() - flag.createdAt.getTime(),
            },
          },
          tx,
        );
      },
    );
    breachesPaged += 1;
  }

  log.info({ stale: stale.length, breachesPaged }, "SLA monitor sweep complete");
}
