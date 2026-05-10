/**
 * Layer-4 AI worker.
 *
 * Job payload: { checkInId, organizationId, veteranId, correlationId }.
 *
 * Responsibilities:
 *   1. Load the check-in (in tenant-scoped transaction).
 *   2. Run the language analysis prompt.
 *   3. Write the analysis back to the check-in row.
 *   4. Re-score using the engine (now with layer-4 input).
 *   5. Insert any NEW flags. Existing flags from layers 1/2/3/5 are not touched.
 *   6. Audit log.
 *
 * Failure: BullMQ retries with exponential backoff (1s, 5s, 25s). Exhausting
 * retries triggers `markFailed` which records `aiAnalysisFailedAt` so the
 * coordinator UI can show a degradation banner. Silent degradation is not
 * acceptable.
 */

import { Worker, type Job } from "bullmq";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/tenant-context";
import { analyzeOpenEndedResponse } from "@/lib/ai/client";
import { score, ENGINE_VERSION } from "@/lib/risk/engine";
import type { CheckInRecord, CheckInResponse, LanguageAnalysis } from "@/lib/risk/types";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";
import { withCorrelation } from "@/lib/logging/log";
import { buildQueueConnection } from "@/lib/queue/redis";
import {
  QUEUE_LANGUAGE_ANALYSIS,
  type LanguageAnalysisJob,
} from "@/lib/queue/queues";

export function buildLanguageAnalysisWorker(): Worker | null {
  const connection = buildQueueConnection();
  if (!connection) return null;

  return new Worker<LanguageAnalysisJob>(
    QUEUE_LANGUAGE_ANALYSIS,
    async (job) => runLanguageAnalysisJob(job),
    {
      connection,
      // Concurrency: AI is the slow path; keep it modest so a burst doesn't
      // exhaust the API quota for the whole org.
      concurrency: Number(process.env.LANGUAGE_ANALYSIS_CONCURRENCY ?? 4),
    },
  );
}

export async function runLanguageAnalysisJob(job: Job<LanguageAnalysisJob>): Promise<void> {
  const { checkInId, organizationId, veteranId, correlationId } = job.data;
  const log = withCorrelation(correlationId, {
    component: "worker.language-analysis",
    jobId: job.id,
    attempt: job.attemptsMade + 1,
    checkInId,
  });

  log.info("starting layer-4 analysis");

  const ctx = {
    organizationId,
    userId: veteranId,
    userRole: "VETERAN",
    isOrgAdmin: false,
  };

  // Step 1: load the check-in + history under tenant context.
  const fetched = await withTenant(ctx, async (tx) => {
    const checkIn = await tx.checkIn.findUnique({
      where: { id: checkInId },
      select: {
        id: true,
        organizationId: true,
        veteranId: true,
        weekNumber: true,
        submittedAt: true,
        responses: true,
        openEndedResponse: true,
        aiPending: true,
      },
    });
    if (!checkIn) return null;
    if (!checkIn.openEndedResponse || checkIn.openEndedResponse.trim().length === 0) {
      // Nothing to analyze. Mark not pending and return early.
      return { checkIn, history: [], skip: true as const };
    }
    const history = await tx.checkIn.findMany({
      where: { veteranId, organizationId },
      orderBy: { submittedAt: "desc" },
      take: 12,
      select: {
        id: true,
        weekNumber: true,
        submittedAt: true,
        responses: true,
        riskLevel: true,
      },
    });
    const veteran = await tx.veteranProfile.findUnique({
      where: { userId: veteranId },
      select: { user: { select: { displayName: true } } },
    });
    return {
      checkIn,
      history,
      veteranName: veteran?.user.displayName ?? null,
      skip: false as const,
    };
  });

  if (!fetched) {
    log.warn("check-in not found; nothing to analyze");
    return;
  }

  if (fetched.skip) {
    await withTenant(ctx, async (tx) => {
      await tx.checkIn.update({
        where: { id: checkInId },
        data: { aiPending: false },
      });
    });
    return;
  }

  // Step 2: call the AI. Error here triggers BullMQ retry.
  let analysis: LanguageAnalysis;
  try {
    const out = await analyzeOpenEndedResponse({
      organizationId,
      veteranId,
      veteranDisplayName: fetched.veteranName,
      openEndedResponse: fetched.checkIn.openEndedResponse!,
    });
    analysis = out.analysis;
    log.info(
      {
        promptVersion: out.log.promptVersion,
        model: out.log.model,
        latencyMs: out.log.latencyMs,
        markerCount: analysis.markers.length,
        recommendedSeverity: analysis.recommendedSeverity,
        explicitRiskLanguage: analysis.explicitRiskLanguage,
      },
      "layer-4 analysis returned",
    );
  } catch (err) {
    log.error({ err: err instanceof Error ? err.message : String(err) }, "layer-4 AI call failed");
    throw err; // BullMQ retries
  }

  // Step 3: re-score with layer-4 input + persist.
  await withTenant(ctx, async (tx) => {
    const historyForEngine: CheckInRecord[] = fetched.history.map((h) => ({
      id: h.id,
      weekNumber: h.weekNumber,
      submittedAt: h.submittedAt,
      responses: (h.responses as unknown as CheckInResponse[]) ?? [],
      openEndedResponse: null,
    }));

    const current: CheckInRecord = {
      id: fetched.checkIn.id,
      weekNumber: fetched.checkIn.weekNumber,
      submittedAt: fetched.checkIn.submittedAt,
      responses: (fetched.checkIn.responses as unknown as CheckInResponse[]) ?? [],
      openEndedResponse: fetched.checkIn.openEndedResponse,
    };

    const out = score({
      current,
      history: historyForEngine,
      hoursSinceCheckInWindowOpen: 0,
      consecutiveMissedWeeks: 0,
      priorRiskLevel: fetched.history[1]?.riskLevel ?? null, // skip the row we just updated
      languageAnalysis: analysis,
    });

    await tx.checkIn.update({
      where: { id: checkInId },
      data: {
        aiAnalysis: analysis as unknown as object,
        aiPending: false,
        aiAnalysisFailedAt: null,
        aiAnalysisFailureReason: null,
        riskScore: out.overallScore,
        riskLevel: out.overallRiskLevel,
        engineVersion: out.engineVersion,
      },
    });

    // Insert only the layer-4-derived flags (LANGUAGE_MARKER, EXPLICIT_RISK).
    // Layers 1/2/3/5 already wrote their flags at submit time.
    const layer4Flags = out.flags.filter(
      (f) => f.flagType === "LANGUAGE_MARKER" || f.flagType === "EXPLICIT_RISK",
    );
    for (const f of layer4Flags) {
      await tx.flag.create({
        data: {
          organizationId,
          veteranId,
          checkInId,
          flagType: f.flagType,
          severity: f.severity,
          explanation: f.explanation,
          domainsInvolved: f.domainsInvolved,
        },
      });
    }

    await logAudit(
      {
        organizationId,
        actorId: null,
        actorRole: "SYSTEM",
        action: AUDIT_ACTIONS.AI_CALL,
        resourceType: "CheckIn",
        resourceId: checkInId,
        correlationId,
        metadata: {
          source: "language-analysis-worker",
          promptVersion: analysis.promptVersion,
          model: analysis.model,
          newFlagCount: layer4Flags.length,
          recommendedSeverity: analysis.recommendedSeverity,
          riskLevel: out.overallRiskLevel,
          engineVersion: ENGINE_VERSION,
        },
      },
      tx,
    );
  });

  log.info("layer-4 analysis persisted");
}

/**
 * Mark a check-in's AI analysis as permanently failed (after BullMQ retries
 * are exhausted). Surfaces to the coordinator UI as a degradation banner so
 * they review the open-ended response manually.
 */
export async function markLanguageAnalysisFailed(
  job: Job<LanguageAnalysisJob>,
  reason: string,
): Promise<void> {
  const { checkInId, organizationId, veteranId, correlationId } = job.data;
  const log = withCorrelation(correlationId, {
    component: "worker.language-analysis",
    checkInId,
  });

  await withTenant(
    { organizationId, userId: veteranId, userRole: "SYSTEM", isOrgAdmin: false },
    async (tx) => {
      await tx.checkIn.update({
        where: { id: checkInId },
        data: {
          aiPending: false,
          aiAnalysisFailedAt: new Date(),
          aiAnalysisFailureReason: reason.slice(0, 500),
        },
      });
      await logAudit(
        {
          organizationId,
          actorId: null,
          actorRole: "SYSTEM",
          action: AUDIT_ACTIONS.AI_CALL,
          resourceType: "CheckIn",
          resourceId: checkInId,
          correlationId,
          metadata: {
            source: "language-analysis-worker",
            outcome: "exhausted-retries",
            failureReason: reason.slice(0, 500),
          },
        },
        tx,
      );
    },
  );

  log.error({ reason }, "layer-4 analysis exhausted retries — coordinator banner will display");
}
