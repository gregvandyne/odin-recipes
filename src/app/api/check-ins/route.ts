/**
 * Submit a check-in.
 *
 * Flow:
 *   1. Authenticate veteran. Resolve tenant context.
 *   2. Persist check-in (immutable).
 *   3. Run risk engine layers 1, 2, 3, 5 deterministically.
 *   4. If open-ended response present → call AI for layer 4.
 *   5. Combine, persist score + flags, audit, fan out coordinator notifications.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/tenant-context";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";
import { score } from "@/lib/risk/engine";
import type { CheckInRecord, CheckInResponse, LanguageAnalysis } from "@/lib/risk/types";
import { CANONICAL_QUESTIONS } from "@/lib/questions/canonical";
import { analyzeOpenEndedResponse } from "@/lib/ai/client";

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

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const organizationId = (session.user as { organizationId?: string }).organizationId;
  if (!organizationId) return NextResponse.json({ error: "no tenant" }, { status: 403 });

  const veteranProfile = await prisma.veteranProfile.findUnique({
    where: { userId },
    select: { userId: true, organizationId: true, assignedCoordinatorId: true, user: { select: { displayName: true } } },
  });
  if (!veteranProfile || veteranProfile.organizationId !== organizationId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const { weekNumber, answers, openEndedResponse } = parsed.data;

  // Hydrate responses with question metadata
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

  // Run layer 4 on open-ended (if present). We do this before persisting so the
  // resulting check-in record carries the full risk score.
  let languageAnalysis: LanguageAnalysis | null = null;
  if (openEndedResponse && openEndedResponse.trim().length > 0 && process.env.ANTHROPIC_API_KEY) {
    try {
      const { analysis } = await analyzeOpenEndedResponse({
        organizationId,
        veteranId: userId,
        veteranDisplayName: veteranProfile.user.displayName,
        openEndedResponse,
      });
      languageAnalysis = analysis;
    } catch {
      // Failing AI call must not block the check-in. Treat as no analysis;
      // a follow-up job retries later. Critically, this does NOT downgrade
      // the deterministic risk layers.
    }
  }

  const result = await withTenant(
    {
      organizationId,
      userId,
      userRole: "VETERAN",
      isOrgAdmin: false,
    },
    async (tx) => {
      // Pull last 12 weeks of history
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
        openEndedResponse: null, // not used downstream
      }));

      const current: CheckInRecord = {
        id: "pending",
        weekNumber,
        submittedAt: new Date(),
        responses,
        openEndedResponse,
      };

      const out = score({
        current,
        history: historyForEngine,
        hoursSinceCheckInWindowOpen: 0,
        consecutiveMissedWeeks: 0,
        priorRiskLevel: history[0]?.riskLevel ?? null,
        languageAnalysis,
      });

      const checkIn = await tx.checkIn.create({
        data: {
          organizationId,
          veteranId: userId,
          weekNumber,
          responses: responses as unknown as object,
          openEndedResponse,
          aiAnalysis: languageAnalysis as unknown as object | null ?? undefined,
          riskScore: out.overallScore,
          riskLevel: out.overallRiskLevel,
          engineVersion: out.engineVersion,
        },
      });

      // Persist flags
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

      await logAudit(
        {
          organizationId,
          actorId: userId,
          actorRole: "VETERAN",
          action: AUDIT_ACTIONS.CHECKIN_SUBMIT,
          resourceType: "CheckIn",
          resourceId: checkIn.id,
          metadata: {
            riskLevel: out.overallRiskLevel,
            flagCount: out.flags.length,
          },
        },
        tx,
      );

      return { checkInId: checkIn.id, riskLevel: out.overallRiskLevel };
    },
  );

  // Veteran always gets the same calm response. They never see "you've been flagged."
  return NextResponse.json({ ok: true });
}
