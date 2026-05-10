/**
 * BullMQ queue definitions.
 *
 * If REDIS_URL is unset (e.g. dev loop without Redis), the queue helpers
 * fall back to running the work inline. This is acceptable in dev only;
 * production deploys must set REDIS_URL or readyz will fail.
 */

import { Queue, type JobsOptions } from "bullmq";
import { buildQueueConnection } from "./redis";
import { logger } from "@/lib/logging/log";

export const QUEUE_LANGUAGE_ANALYSIS = "language-analysis";
export const QUEUE_NOTIFICATIONS = "notifications";
export const QUEUE_CHECKIN_INVITES = "checkin-invites";
export const QUEUE_SLA_MONITOR = "sla-monitor";
export const QUEUE_DATA_RETENTION = "data-retention";
export const QUEUE_CASELOAD_REASSIGNMENT = "caseload-reassignment";

export interface LanguageAnalysisJob {
  checkInId: string;
  organizationId: string;
  veteranId: string;
  correlationId: string;
}

export interface NotificationJob {
  notificationId: string;
  correlationId?: string;
}

export interface CheckinInviteSweepJob {
  // Hourly sweep — payload is just the trigger time, useful for logs.
  triggeredAt: string;
  correlationId: string;
}

export interface SlaMonitorJob {
  triggeredAt: string;
  correlationId: string;
}

export interface DataRetentionJob {
  triggeredAt: string;
  correlationId: string;
}

export interface CaseloadReassignmentJob {
  reassignmentId: string;
  organizationId: string;
  correlationId: string;
}

let languageAnalysisQueue: Queue | null = null;
let notificationsQueue: Queue | null = null;
let checkinInvitesQueue: Queue | null = null;
let slaMonitorQueue: Queue | null = null;
let dataRetentionQueue: Queue | null = null;
let caseloadReassignmentQueue: Queue | null = null;

const STANDARD_OPTS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 1_000 },
  removeOnComplete: { age: 60 * 60 * 24, count: 1_000 },
  removeOnFail: { age: 60 * 60 * 24 * 7 },
};

function languageQueue(): Queue | null {
  if (languageAnalysisQueue) return languageAnalysisQueue;
  const conn = buildQueueConnection();
  if (!conn) return null;
  languageAnalysisQueue = new Queue(QUEUE_LANGUAGE_ANALYSIS, { connection: conn, defaultJobOptions: STANDARD_OPTS });
  return languageAnalysisQueue;
}

function notifQueue(): Queue | null {
  if (notificationsQueue) return notificationsQueue;
  const conn = buildQueueConnection();
  if (!conn) return null;
  notificationsQueue = new Queue(QUEUE_NOTIFICATIONS, { connection: conn, defaultJobOptions: STANDARD_OPTS });
  return notificationsQueue;
}

function inviteQueue(): Queue | null {
  if (checkinInvitesQueue) return checkinInvitesQueue;
  const conn = buildQueueConnection();
  if (!conn) return null;
  checkinInvitesQueue = new Queue(QUEUE_CHECKIN_INVITES, { connection: conn, defaultJobOptions: STANDARD_OPTS });
  return checkinInvitesQueue;
}

/**
 * Enqueue layer-4 AI analysis. If the queue isn't configured, returns false —
 * the caller can decide whether to mark the check-in as `aiPending=false` or
 * try to run inline as a degraded fallback.
 */
export async function enqueueLanguageAnalysis(payload: LanguageAnalysisJob): Promise<boolean> {
  const q = languageQueue();
  if (!q) {
    logger.warn({ checkInId: payload.checkInId }, "language-analysis queue unavailable; skipping enqueue");
    return false;
  }
  await q.add(QUEUE_LANGUAGE_ANALYSIS, payload, {
    jobId: `langan:${payload.checkInId}`,
  });
  return true;
}

export async function enqueueNotification(payload: NotificationJob): Promise<boolean> {
  const q = notifQueue();
  if (!q) return false;
  await q.add(QUEUE_NOTIFICATIONS, payload, {
    jobId: `notif:${payload.notificationId}`,
  });
  return true;
}

/**
 * Register the hourly check-in invitation sweep as a BullMQ repeatable job.
 * Idempotent: re-registering is a no-op if the schedule is unchanged.
 */
export async function registerInviteSweep(): Promise<boolean> {
  const q = inviteQueue();
  if (!q) return false;
  await q.add(
    "sweep",
    {
      triggeredAt: new Date().toISOString(),
      correlationId: crypto.randomUUID(),
    } satisfies CheckinInviteSweepJob,
    {
      repeat: { pattern: "0 * * * *" }, // every hour at :00
      jobId: "checkin-invite-sweep",
    },
  );
  return true;
}

function slaQueue(): Queue | null {
  if (slaMonitorQueue) return slaMonitorQueue;
  const conn = buildQueueConnection();
  if (!conn) return null;
  slaMonitorQueue = new Queue(QUEUE_SLA_MONITOR, { connection: conn, defaultJobOptions: STANDARD_OPTS });
  return slaMonitorQueue;
}

function retentionQueue(): Queue | null {
  if (dataRetentionQueue) return dataRetentionQueue;
  const conn = buildQueueConnection();
  if (!conn) return null;
  dataRetentionQueue = new Queue(QUEUE_DATA_RETENTION, { connection: conn, defaultJobOptions: STANDARD_OPTS });
  return dataRetentionQueue;
}

function reassignmentQueue(): Queue | null {
  if (caseloadReassignmentQueue) return caseloadReassignmentQueue;
  const conn = buildQueueConnection();
  if (!conn) return null;
  caseloadReassignmentQueue = new Queue(QUEUE_CASELOAD_REASSIGNMENT, { connection: conn, defaultJobOptions: STANDARD_OPTS });
  return caseloadReassignmentQueue;
}

/**
 * Register the every-minute SLA monitor sweep.
 */
export async function registerSlaMonitor(): Promise<boolean> {
  const q = slaQueue();
  if (!q) return false;
  await q.add(
    "sweep",
    {
      triggeredAt: new Date().toISOString(),
      correlationId: crypto.randomUUID(),
    } satisfies SlaMonitorJob,
    {
      repeat: { pattern: "* * * * *" }, // every minute
      jobId: "sla-monitor-sweep",
    },
  );
  return true;
}

/**
 * Register the daily data-retention purge.
 */
export async function registerDataRetention(): Promise<boolean> {
  const q = retentionQueue();
  if (!q) return false;
  await q.add(
    "sweep",
    {
      triggeredAt: new Date().toISOString(),
      correlationId: crypto.randomUUID(),
    } satisfies DataRetentionJob,
    {
      repeat: { pattern: "30 3 * * *" }, // daily at 03:30 UTC
      jobId: "data-retention-sweep",
    },
  );
  return true;
}

export async function enqueueCaseloadReassignment(payload: CaseloadReassignmentJob): Promise<boolean> {
  const q = reassignmentQueue();
  if (!q) return false;
  await q.add(QUEUE_CASELOAD_REASSIGNMENT, payload, {
    jobId: `reassign:${payload.reassignmentId}`,
  });
  return true;
}
