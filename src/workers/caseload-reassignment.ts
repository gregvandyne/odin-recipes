/**
 * Caseload reassignment worker.
 *
 * Job payload: { reassignmentId, organizationId, correlationId }.
 *
 * Loads the CaseloadReassignment row, moves each named veteran to the
 * destination coordinator, dispatches "your coordinator changed" notifications
 * to the affected veterans, marks the reassignment `completedAt`.
 */

import { Worker, type Job } from "bullmq";
import { withTenant } from "@/lib/db/tenant-context";
import { withCorrelation } from "@/lib/logging/log";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";
import { buildQueueConnection } from "@/lib/queue/redis";
import {
  QUEUE_CASELOAD_REASSIGNMENT,
  type CaseloadReassignmentJob,
  enqueueNotification,
} from "@/lib/queue/queues";
import { withErrorTracking } from "@/lib/observability/sentry";

export function buildCaseloadReassignmentWorker(): Worker | null {
  const connection = buildQueueConnection();
  if (!connection) return null;
  return new Worker<CaseloadReassignmentJob>(
    QUEUE_CASELOAD_REASSIGNMENT,
    async (job) =>
      withErrorTracking("worker.caseload-reassignment", () => runReassignmentJob(job), {
        jobId: job.id,
        reassignmentId: job.data?.reassignmentId,
      }),
    { connection, concurrency: 1 },
  );
}

export async function runReassignmentJob(job: Job<CaseloadReassignmentJob>): Promise<void> {
  const log = withCorrelation(job.data.correlationId, {
    component: "worker.caseload-reassignment",
    reassignmentId: job.data.reassignmentId,
  });
  const { reassignmentId, organizationId } = job.data;

  await withTenant(
    { organizationId, userId: organizationId, userRole: "SYSTEM", isOrgAdmin: false },
    async (tx) => {
      const reassignment = await tx.caseloadReassignment.findUnique({
        where: { id: reassignmentId },
      });
      if (!reassignment || reassignment.completedAt) {
        log.info("reassignment already completed or not found");
        return;
      }
      const { fromCoordinatorId, toCoordinatorId, veteranIds, reason } = reassignment;
      let movedCount = 0;
      for (const veteranId of veteranIds) {
        const updated = await tx.veteranProfile.updateMany({
          where: {
            userId: veteranId,
            organizationId,
            assignedCoordinatorId: fromCoordinatorId,
          },
          data: { assignedCoordinatorId: toCoordinatorId },
        });
        if (updated.count > 0) {
          movedCount += 1;
          // Notify the veteran their coordinator changed.
          const notif = await tx.notification.create({
            data: {
              organizationId,
              recipientUserId: veteranId,
              category: "COORDINATOR_OUTREACH",
              channel: "EMAIL",
              subject: "Your coordinator has changed",
              bodyTemplateId: "coordinator-changed-v1",
              relatedResourceType: "CaseloadReassignment",
              relatedResourceId: reassignmentId,
            },
          });
          void enqueueNotification({ notificationId: notif.id, correlationId: job.data.correlationId });
        }
      }

      // Notify the receiving coordinator (single notice, not per-veteran).
      const toNotif = await tx.notification.create({
        data: {
          organizationId,
          recipientUserId: toCoordinatorId,
          category: "NEW_VETERAN_ASSIGNED",
          channel: "EMAIL",
          subject: `Sentinel: ${movedCount} veteran${movedCount === 1 ? "" : "s"} added to your caseload`,
          bodyTemplateId: "new-veteran-assigned-v1",
          relatedResourceType: "CaseloadReassignment",
          relatedResourceId: reassignmentId,
        },
      });
      void enqueueNotification({ notificationId: toNotif.id, correlationId: job.data.correlationId });

      await tx.caseloadReassignment.update({
        where: { id: reassignmentId },
        data: { completedAt: new Date(), veteransNotified: true },
      });

      await logAudit(
        {
          organizationId,
          actorId: null,
          actorRole: "SYSTEM",
          action: AUDIT_ACTIONS.CASELOAD_REASSIGN,
          resourceType: "CaseloadReassignment",
          resourceId: reassignmentId,
          correlationId: job.data.correlationId,
          reason,
          metadata: {
            fromCoordinatorId,
            toCoordinatorId,
            attempted: veteranIds.length,
            moved: movedCount,
          },
        },
        tx,
      );
    },
  );

  log.info("reassignment complete");
}
