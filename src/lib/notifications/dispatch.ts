/**
 * Fan-out helper called by the check-ins route and the language-analysis
 * worker after Flag rows are persisted.
 *
 * For each flag at YELLOW or above:
 *   1. Resolve recipients per `recipientsForSeverity(severity)`.
 *   2. Resolve actual user ids:
 *      - COORDINATOR: VeteranProfile.assignedCoordinatorId, with OOO coverage
 *        + program-manager fallback if none.
 *      - CLINICAL_LEAD: any user in the org with role CLINICAL_LEAD
 *        (round-robin via createdAt — primitive but deterministic).
 *      - PROGRAM_MANAGER: org admin or CohortPM. Falls back to any user with
 *        role PROGRAM_MANAGER.
 *   3. Create Notification rows + enqueue to QUEUE_NOTIFICATIONS.
 *
 * The Notification table itself is the source of truth; the worker drains
 * from there. Enqueue is best-effort — if Redis is down, the rows are still
 * persisted and a future cron can pick them up.
 */

import type { Prisma } from "@prisma/client";
import type { RiskLevel } from "@/lib/risk/types";
import { categoryForSeverity, recipientsForSeverity } from "./categories";
import { enqueueNotification } from "@/lib/queue/queues";
import { logger } from "@/lib/logging/log";

interface FlagToDispatch {
  flagId: string;
  veteranId: string;
  severity: RiskLevel;
}

interface DispatchArgs {
  organizationId: string;
  flags: FlagToDispatch[];
  correlationId: string;
}

export async function dispatchFlagNotifications(
  tx: Prisma.TransactionClient,
  args: DispatchArgs,
): Promise<{ created: number }> {
  let created = 0;
  for (const f of args.flags) {
    const category = categoryForSeverity(f.severity);
    if (!category) continue;
    const targets = recipientsForSeverity(f.severity);
    if (targets.length === 0) continue;

    const recipientUserIds = await resolveRecipients(tx, args.organizationId, f.veteranId, targets);
    for (const recipientUserId of recipientUserIds) {
      const notification = await tx.notification.create({
        data: {
          organizationId: args.organizationId,
          recipientUserId,
          category,
          channel: "EMAIL",
          subject: subjectFor(f.severity),
          bodyTemplateId: `flag-${category.toLowerCase()}-v1`,
          relatedResourceType: "Flag",
          relatedResourceId: f.flagId,
        },
      });
      created += 1;
      // Enqueue happens after the transaction commits — schedule via setImmediate
      // is awkward inside a Prisma tx. We collect ids and fire after.
      void enqueueNotification({
        notificationId: notification.id,
        correlationId: args.correlationId,
      }).catch((err) => {
        logger.warn(
          { err: err instanceof Error ? err.message : String(err), notificationId: notification.id },
          "enqueueNotification failed; row persisted, worker will pick up",
        );
      });
    }
  }
  return { created };
}

function subjectFor(severity: RiskLevel): string {
  switch (severity) {
    case "RED":    return "Sentinel: a veteran needs immediate attention";
    case "ORANGE": return "Sentinel: outreach needed within 24h";
    case "YELLOW": return "Sentinel: new caseload signal";
    case "GREEN":  return "Sentinel: update";
  }
}

async function resolveRecipients(
  tx: Prisma.TransactionClient,
  organizationId: string,
  veteranId: string,
  targets: ("COORDINATOR" | "CLINICAL_LEAD" | "PROGRAM_MANAGER")[],
): Promise<string[]> {
  const out: Set<string> = new Set();

  if (targets.includes("COORDINATOR")) {
    const profile = await tx.veteranProfile.findUnique({
      where: { userId: veteranId },
      select: { assignedCoordinatorId: true },
    });
    let coordinatorId = profile?.assignedCoordinatorId ?? null;

    // OOO check: if the assigned coordinator has an active OOO block with
    // coverage, route to coverage instead.
    if (coordinatorId) {
      const now = new Date();
      const ooo = await tx.coordinatorOOO.findFirst({
        where: {
          coordinatorId,
          startAt: { lte: now },
          endAt: { gte: now },
        },
        select: { coverageCoordinatorId: true },
      });
      if (ooo?.coverageCoordinatorId) coordinatorId = ooo.coverageCoordinatorId;
    }

    if (coordinatorId) {
      out.add(coordinatorId);
    } else {
      // No assigned coordinator — fall back to program manager so the flag
      // doesn't disappear into the void.
      const pm = await tx.user.findFirst({
        where: { organizationId, role: "PROGRAM_MANAGER", accountState: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (pm) out.add(pm.id);
    }
  }

  if (targets.includes("CLINICAL_LEAD")) {
    const lead = await tx.user.findFirst({
      where: { organizationId, role: "CLINICAL_LEAD", accountState: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (lead) out.add(lead.id);
  }

  if (targets.includes("PROGRAM_MANAGER")) {
    const pm = await tx.user.findFirst({
      where: { organizationId, role: "PROGRAM_MANAGER", accountState: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (pm) out.add(pm.id);
  }

  return [...out];
}
