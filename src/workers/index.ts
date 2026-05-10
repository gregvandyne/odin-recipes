/**
 * Worker process entrypoint.
 *
 * Run with: `npm run worker` (production) or `tsx src/workers/index.ts` (dev).
 *
 * Boot sequence:
 *   1. Verify Redis is configured.
 *   2. Spin up a worker per queue: language-analysis, notification,
 *      check-in invitation sweep, SLA monitor, data-retention,
 *      caseload-reassignment.
 *   3. Register repeatable cron jobs (hourly invite sweep, every-minute SLA
 *      monitor, daily retention).
 *   4. Each worker writes a heartbeat key so /api/readyz can detect a
 *      stuck worker.
 *   5. Wire SIGTERM/SIGINT for graceful shutdown.
 */

import { logger } from "@/lib/logging/log";
import {
  registerInviteSweep,
  registerSlaMonitor,
  registerDataRetention,
} from "@/lib/queue/queues";
import { writeHeartbeat } from "@/lib/observability/heartbeat";
import { buildLanguageAnalysisWorker, markLanguageAnalysisFailed } from "./language-analysis";
import { buildCheckinInviteWorker } from "./checkin-invite-cron";
import { buildNotificationWorker } from "./notification";
import { buildSlaMonitorWorker } from "./sla-monitor";
import { buildDataRetentionWorker } from "./data-retention";
import { buildCaseloadReassignmentWorker } from "./caseload-reassignment";

const HEARTBEAT_INTERVAL_MS = 15_000;

async function main(): Promise<void> {
  if (!process.env.REDIS_URL) {
    logger.error("REDIS_URL is not set; worker process cannot start");
    process.exit(1);
  }

  logger.info("worker process starting");

  const workers = {
    languageAnalysis: buildLanguageAnalysisWorker(),
    notification: buildNotificationWorker(),
    invite: buildCheckinInviteWorker(),
    sla: buildSlaMonitorWorker(),
    retention: buildDataRetentionWorker(),
    reassignment: buildCaseloadReassignmentWorker(),
  };

  const failed = Object.entries(workers).filter(([, w]) => !w);
  if (failed.length > 0) {
    logger.error({ failed: failed.map(([n]) => n) }, "failed to construct workers; exiting");
    process.exit(1);
  }

  workers.languageAnalysis!.on("failed", (job, err) => {
    if (!job) return;
    const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
    logger.warn(
      {
        jobId: job.id,
        checkInId: job.data?.checkInId,
        attempt: job.attemptsMade,
        max: job.opts.attempts,
        exhausted,
        err: err.message,
      },
      "language-analysis job failed",
    );
    if (exhausted) {
      void markLanguageAnalysisFailed(job, err.message).catch((e) => {
        logger.error({ err: e?.message }, "failed to mark check-in as analysis-failed");
      });
    }
  });

  workers.notification!.on("failed", (job, err) => {
    logger.warn(
      { jobId: job?.id, attempt: job?.attemptsMade, err: err.message },
      "notification job failed",
    );
  });

  workers.invite!.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, "check-in invite sweep failed");
  });

  workers.sla!.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, "SLA monitor sweep failed");
  });

  workers.retention!.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, "data-retention sweep failed");
  });

  workers.reassignment!.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, "caseload-reassignment job failed");
  });

  await registerInviteSweep();
  await registerSlaMonitor();
  await registerDataRetention();
  logger.info("repeatable jobs registered (invite sweep, SLA monitor, data retention)");

  // Heartbeat: every interval, write the current timestamp keyed by worker name
  // so /api/readyz can detect a wedged worker process.
  const heartbeat = setInterval(() => {
    void writeHeartbeat("worker", { ttlMs: HEARTBEAT_INTERVAL_MS * 4 }).catch((err) => {
      logger.warn({ err: err?.message }, "heartbeat write failed");
    });
  }, HEARTBEAT_INTERVAL_MS);
  void writeHeartbeat("worker", { ttlMs: HEARTBEAT_INTERVAL_MS * 4 });

  logger.info("worker process ready");

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "worker shutdown");
    clearInterval(heartbeat);
    await Promise.allSettled(Object.values(workers).map((w) => w!.close()));
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

if (require.main === module) {
  void main();
}
