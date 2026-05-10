/**
 * Submit a check-in.
 *
 * Flow:
 *   1. Authenticate veteran. Resolve tenant context.
 *   2. Verify idempotency key (replay if seen).
 *   3. Run risk engine layers 1, 2, 3, 5 deterministically.
 *   4. Persist check-in (with aiPending=true if open-ended is non-empty).
 *   5. Enqueue layer-4 AI job. Worker writes back analysis + new flags.
 *   6. Atomically delete the corresponding CheckInDraft (if any).
 *
 * The AI call no longer runs on the critical path. A Claude hiccup never
 * blocks a veteran from submitting; the coordinator UI surfaces the
 * pending/failed state explicitly so degradation is visible, not silent.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/security/api-auth";
import { withTenant } from "@/lib/db/tenant-context";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";
import { score } from "@/lib/risk/engine";
import type { CheckInRecord, CheckInResponse } from "@/lib/risk/types";
import { CANONICAL_QUESTIONS } from "@/lib/questions/canonical";
import { enqueueLanguageAnalysis } from "@/lib/queue/queues";
import {
  IDEMPOTENCY_HEADER,
  hashBody,
  lookup,
  readKey,
  recordResponse,
} from "@/lib/idempotency/store";

const Body = z.object({
  weekNumber: z.number().int().min(1).max(52),
  answers: z.array(
    z.object({
      questionId: z.string(),
      value: z.union([z.number(), z.string(), z.null()]),
      skipped: z.boolean(),
    }),
  ),
  openEndedResponse: z.string().nullable(),
});

export const POST = withAuth(
  async (req: NextRequest, ctx) => {
    if (ctx.role !== "VETERAN") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (!ctx.organizationId) {
      return NextResponse.json({ error: "no tenant" }, { status: 403 });
    }
    const organizationId = ctx.organizationId;
    const userId = ctx.userId;

    const bodyText = await req.text();
    const idemKey = readKey(req);
    if (idemKey) {
      const result = await lookup(ctx, "/api/check-ins", idemKey, bodyText);
      if (result?.hit) return result.response;
    }

    let parsed: z.infer<typeof Body>;
    try {
      parsed = Body.parse(JSON.parse(bodyText));
    } catch {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }

    const { weekNumber, answers, openEndedResponse } = parsed;
    const cleanedOpenEnded = openEndedResponse && openEndedResponse.trim().length > 0
      ? openEndedResponse
      : null;

    const responses: CheckInResponse[] = answers.flatMap((a) => {
      const q = CANONICAL_QUESTIONS.find((q) => q.id === a.questionId);
      if (!q) return [];
      return [{
        questionId: a.questionId,
        domainCode: q.domainCode,
        responseType: q.responseType,
        value: a.value,
        skipped: a.skipped,
        weight: q.weight,
      }];
    });

    const result = await withTenant(
      {
        organizationId,
        userId,
        userRole: "VETERAN",
        isOrgAdmin: false,
      },
      async (tx) => {
        const veteranProfile = await tx.veteranProfile.findUnique({
          where: { userId },
          select: { userId: true, organizationId: true },
        });
        if (!veteranProfile || veteranProfile.organizationId !== organizationId) {
          return { status: 403 as const, body: { error: "forbidden" } };
        }

        const history = await tx.checkIn.findMany({
          where: { veteranId: userId, organizationId },
          orderBy: { submittedAt: "desc" },
          take: 12,
        });

        const historyForEngine: CheckInRecord[] = history.map((h) => ({
          id: h.id,
          weekNumber: h.weekNumber,
          submittedAt: h.submittedAt,
          responses: (h.responses as unknown as CheckInResponse[]) ?? [],
          openEndedResponse: null,
        }));

        const current: CheckInRecord = {
          id: "pending",
          weekNumber,
          submittedAt: new Date(),
          responses,
          openEndedResponse: cleanedOpenEnded,
        };

        // Layer 4 runs in the worker; engine sees null analysis here.
        const out = score({
          current,
          history: historyForEngine,
          hoursSinceCheckInWindowOpen: 0,
          consecutiveMissedWeeks: 0,
          priorRiskLevel: history[0]?.riskLevel ?? null,
          languageAnalysis: null,
        });

        const aiPending = cleanedOpenEnded !== null;
        const checkIn = await tx.checkIn.create({
          data: {
            organizationId,
            veteranId: userId,
            weekNumber,
            responses: responses as unknown as object,
            openEndedResponse: cleanedOpenEnded,
            aiPending,
            riskScore: out.overallScore,
            riskLevel: out.overallRiskLevel,
            engineVersion: out.engineVersion,
          },
        });

        for (const f of out.flags) {
          await tx.flag.create({
            data: {
              organizationId,
              veteranId: userId,
              checkInId: checkIn.id,
              flagType: f.flagType,
              severity: f.severity,
              explanation: f.explanation,
              domainsInvolved: f.domainsInvolved,
            },
          });
        }

        // Discard any draft for this week — it's been promoted to a CheckIn.
        await tx.checkInDraft.deleteMany({
          where: { veteranId: userId, weekNumber },
        });

        await logAudit(
          {
            organizationId,
            actorId: userId,
            actorRole: "VETERAN",
            action: AUDIT_ACTIONS.CHECKIN_SUBMIT,
            resourceType: "CheckIn",
            resourceId: checkIn.id,
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
            correlationId: ctx.correlationId,
            metadata: {
              riskLevel: out.overallRiskLevel,
              flagCount: out.flags.length,
              aiPending,
            },
          },
          tx,
        );

        return {
          status: 200 as const,
          body: { ok: true, checkInId: checkIn.id },
          checkInId: checkIn.id,
          aiPending,
        };
      },
    );

    if (result.status !== 200) {
      return NextResponse.json(result.body, { status: result.status });
    }

    if (result.aiPending) {
      const enqueued = await enqueueLanguageAnalysis({
        checkInId: result.checkInId,
        organizationId,
        veteranId: userId,
        correlationId: ctx.correlationId,
      });
      if (!enqueued) {
        // Queue unavailable: clear pending so the UI doesn't claim analysis is
        // coming when nothing is going to run. Coordinator banner will note
        // that the analysis is missing.
        ctx.logger.warn(
          { checkInId: result.checkInId },
          "language-analysis queue unavailable; clearing aiPending",
        );
        await withTenant(
          { organizationId, userId, userRole: "VETERAN", isOrgAdmin: false },
          async (tx) => {
            await tx.checkIn.update({
              where: { id: result.checkInId },
              data: {
                aiPending: false,
                aiAnalysisFailedAt: new Date(),
                aiAnalysisFailureReason: "queue unavailable at submit time",
              },
            });
          },
        );
      }
    }

    if (idemKey) {
      await recordResponse(
        ctx,
        "/api/check-ins",
        idemKey,
        hashBody(bodyText),
        200,
        { ok: true },
      );
    }

    // Veteran always gets the same calm response. They never see "you've been flagged."
    return NextResponse.json({ ok: true }, {
      headers: idemKey ? { [IDEMPOTENCY_HEADER]: idemKey } : undefined,
    });
  },
  { roles: ["VETERAN"], rateLimit: "api.checkin" },
);
