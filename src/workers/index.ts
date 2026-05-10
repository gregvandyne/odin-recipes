/**
 * Worker process entrypoint.
 *
 * Run with: `npm run worker` (production) or `tsx src/workers/index.ts` (dev).
 *
 * Boot sequence:
 *   1. Verify Redis is configured.
 *   2. Spin up workers for each queue.
 *   3. Register the hourly check-in invitation sweep as a repeatable job.
 *   4. Wire shutdown signals.
 */

import { logger } from "@/lib/logging/log";
import { registerInviteSweep } from "@/lib/queue/queues";
import { buildLanguageAnalysisWorker, markLanguageAnalysisFailed } from "./language-analysis";
import { buildCheckinInviteWorker } from "./checkin-invite-cron";

async function main(): Promise<void> {
  if (!process.env.REDIS_URL) {
    logger.error("REDIS_URL is not set; worker process cannot start");
    process.exit(1);
  }

  logger.info("worker process starting");

  const langWorker = buildLanguageAnalysisWorker();
  const inviteWorker = buildCheckinInviteWorker();

  if (!langWorker || !inviteWorker) {
    logger.error("failed to construct workers; exiting");
    process.exit(1);
  }

  langWorker.on("failed", (job, err) => {
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

  inviteWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, "check-in invite sweep failed");
  });

  await registerInviteSweep();
  logger.info("invitation sweep registered (hourly cron)");
  logger.info("worker process ready");

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "worker shutdown");
    await Promise.allSettled([langWorker.close(), inviteWorker.close()]);
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

if (require.main === module) {
  void main();
}
