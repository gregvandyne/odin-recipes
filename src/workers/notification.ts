/**
 * Notification fan-out worker.
 *
 * Job payload: { notificationId, correlationId? }.
 *
 * Responsibilities:
 *   1. Load the Notification row in tenant context.
 *   2. Render the body via the appropriate email template.
 *   3. Send via Resend (suppression-list aware — handled inside sendEmail).
 *   4. For RED/ORANGE/escalation/new-message categories, fan out via Web
 *      Push to every active PushSubscription for the recipient. Subscriptions
 *      that 410/404 are revoked.
 *   5. For real-time-eligible categories, publish to the per-tenant pubsub
 *      channel so SSE clients (open triage queue) refresh without reload.
 *
 * Failure: BullMQ retries with exponential backoff. Exhausting retries logs
 * a notification.failed metric and surfaces in the audit log.
 *
 * The Notification row's status moves QUEUED → SENT → (DELIVERED via Resend
 * webhook) or QUEUED → BOUNCED/FAILED/SUPPRESSED.
 */

import { Worker, type Job } from "bullmq";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/tenant-context";
import { withCorrelation } from "@/lib/logging/log";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";
import { sendPush } from "@/lib/push/web-push";
import { isSuppressed } from "@/lib/email/suppression";
import { renderNotificationEmail, subjectFor } from "@/lib/notifications/templates";
import {
  pushEligible,
  pushPriorityFor,
  realtimeEligible,
} from "@/lib/notifications/categories";
import {
  publishEvent,
  coordinatorQueueChannel,
  clinicalLeadChannel,
} from "@/lib/realtime/pubsub";
import { buildQueueConnection } from "@/lib/queue/redis";
import {
  QUEUE_NOTIFICATIONS,
  type NotificationJob,
} from "@/lib/queue/queues";
import { withErrorTracking } from "@/lib/observability/sentry";
import { Resend } from "resend";

let _resend: Resend | null = null;
function resendClient(): Resend | null {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  _resend = new Resend(key);
  return _resend;
}

export function buildNotificationWorker(): Worker | null {
  const connection = buildQueueConnection();
  if (!connection) return null;
  return new Worker<NotificationJob>(
    QUEUE_NOTIFICATIONS,
    async (job) =>
      withErrorTracking("worker.notification", () => runNotificationJob(job), {
        jobId: job.id,
        notificationId: job.data.notificationId,
        attempt: job.attemptsMade + 1,
      }),
    {
      connection,
      concurrency: Number(process.env.NOTIFICATION_CONCURRENCY ?? 8),
    },
  );
}

export async function runNotificationJob(job: Job<NotificationJob>): Promise<void> {
  const correlationId = job.data.correlationId ?? crypto.randomUUID();
  const log = withCorrelation(correlationId, {
    component: "worker.notification",
    jobId: job.id,
    attempt: job.attemptsMade + 1,
    notificationId: job.data.notificationId,
  });

  const notification = await prisma.notification.findUnique({
    where: { id: job.data.notificationId },
    include: {
      recipient: { select: { email: true, displayName: true, organizationId: true } },
    },
  });
  if (!notification) {
    log.warn("notification not found");
    return;
  }
  if (notification.status === "SENT" || notification.status === "DELIVERED") {
    log.info({ status: notification.status }, "notification already dispatched");
    return;
  }
  if (notification.status === "SUPPRESSED" || notification.status === "BOUNCED") {
    log.info({ status: notification.status }, "notification not dispatchable");
    return;
  }

  const recipientEmail = notification.recipient.email;
  const orgId = notification.organizationId ?? notification.recipient.organizationId;

  // Real-time pubsub fan-out first — clients should see the queue update
  // before email lands. Best-effort.
  if (realtimeEligible(notification.category) && orgId) {
    const channel = notification.category === "NEW_ESCALATION"
      ? clinicalLeadChannel(orgId, notification.recipientUserId)
      : coordinatorQueueChannel(orgId, notification.recipientUserId);
    await publishEvent(channel, {
      kind: "flag.created",
      organizationId: orgId,
      payload: {
        notificationId: notification.id,
        category: notification.category,
        relatedResourceType: notification.relatedResourceType,
        relatedResourceId: notification.relatedResourceId,
      },
      emittedAt: new Date().toISOString(),
    });
  }

  // Email path. Suppression-list check.
  const suppressed = await isSuppressed(recipientEmail);
  if (suppressed) {
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: "SUPPRESSED",
        failedAt: new Date(),
        failureReason: `suppressed: ${suppressed.reason}`,
      },
    });
    log.warn({ email: "<redacted>", reason: suppressed.reason }, "email suppressed");
  } else {
    const r = resendClient();
    if (!r) {
      log.warn("RESEND_API_KEY not set; marking SUPPRESSED (dev mode)");
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: "SUPPRESSED",
          failedAt: new Date(),
          failureReason: "RESEND_API_KEY not set (dev mode)",
        },
      });
    } else {
      const { html, text } = await renderNotificationEmail({
        category: notification.category,
        displayName: notification.recipient.displayName,
        relatedResourceType: notification.relatedResourceType,
        relatedResourceId: notification.relatedResourceId,
      });
      const subject = notification.subject || subjectFor(notification.category);
      const fromPlatform = process.env.EMAIL_FROM_PLATFORM ?? "Sentinel <noreply@platform.tld>";
      const fromProgram  = process.env.EMAIL_FROM_PROGRAM  ?? fromPlatform;
      const isSecurity = ["ACCOUNT_SECURITY"].includes(notification.category);
      const from = isSecurity ? fromPlatform : fromProgram;
      try {
        await r.emails.send({
          from,
          to: recipientEmail,
          subject,
          html,
          text,
          headers: {
            "X-Notification-Id": notification.id,
            "X-Notification-Category": notification.category,
            "X-Correlation-Id": correlationId,
          },
        });
        await prisma.notification.update({
          where: { id: notification.id },
          data: { status: "SENT", sentAt: new Date() },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "unknown error";
        log.error({ err: message }, "email send failed");
        await prisma.notification.update({
          where: { id: notification.id },
          data: {
            status: "FAILED",
            failedAt: new Date(),
            failureReason: message,
          },
        });
        throw err; // BullMQ retry
      }
    }
  }

  // Web Push fan-out (in addition to email — multi-channel).
  if (pushEligible(notification.category)) {
    const subs = await prisma.pushSubscription.findMany({
      where: { userId: notification.recipientUserId, revokedAt: null },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
    const priority = pushPriorityFor(notification.category);
    const url = urlForCategory(notification.category, notification.relatedResourceId);
    const tag = `${notification.category}:${notification.relatedResourceId ?? notification.id}`;
    for (const sub of subs) {
      const result = await sendPush(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        {
          title: subjectFor(notification.category),
          body: humanBlurb(notification.category),
          url,
          tag,
          priority,
        },
      );
      if (!result.ok && (result.statusCode === 404 || result.statusCode === 410)) {
        await prisma.pushSubscription.update({
          where: { id: sub.id },
          data: { revokedAt: new Date() },
        });
      }
    }
  }

  if (orgId) {
    await withTenant(
      { organizationId: orgId, userId: notification.recipientUserId, userRole: "SYSTEM", isOrgAdmin: false },
      async (tx) => {
        await logAudit(
          {
            organizationId: orgId,
            actorId: null,
            actorRole: "SYSTEM",
            action: AUDIT_ACTIONS.NOTIFICATION_DELIVER,
            resourceType: "Notification",
            resourceId: notification.id,
            correlationId,
            metadata: {
              category: notification.category,
              channel: notification.channel,
              relatedResourceType: notification.relatedResourceType,
              relatedResourceId: notification.relatedResourceId,
            },
          },
          tx,
        );
      },
    );
  }
}

function urlForCategory(category: string, resourceId: string | null): string {
  if (!resourceId) return "/coordinator";
  switch (category) {
    case "RED_FLAG":
    case "ORANGE_FLAG":
    case "YELLOW_FLAG":
      return `/coordinator`;
    case "NEW_ESCALATION":
      return `/clinical`;
    case "NEW_MESSAGE":
      return `/coordinator/messages`;
    default:
      return "/";
  }
}

function humanBlurb(category: string): string {
  switch (category) {
    case "RED_FLAG":
      return "A veteran needs immediate attention.";
    case "ORANGE_FLAG":
      return "A veteran in your caseload needs outreach within 24 hours.";
    case "YELLOW_FLAG":
      return "A veteran flag arrived. Take a look when you can.";
    case "NEW_ESCALATION":
      return "A coordinator has escalated a case to you.";
    case "NEW_MESSAGE":
      return "You have a new message from a veteran.";
    default:
      return "Sentinel update.";
  }
}
