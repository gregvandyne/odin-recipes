/**
 * Program-manager dashboard metrics. Computed against real data, scoped per
 * organization via withTenant.
 */

import type { Prisma } from "@prisma/client";
import type { RiskLevel } from "@/lib/risk/types";
import { currentWeekNumber } from "@/lib/program/week";

export interface CohortHealthMetrics {
  activeVeterans: number;
  checkInCompletionPct: number; // 0..100
  medianOrangeResponseHours: number | null;
  flagCounts: Record<RiskLevel, number>;
}

export interface CoordinatorRow {
  coordinatorId: string;
  name: string;
  caseload: number;
  unresolvedFlags: number;
  medianResponseHours: number | null;
  resolvedSlaPct: number | null;
}

const SLA_HOURS_BY_LEVEL: Record<RiskLevel, number> = {
  RED: 1,
  ORANGE: 24,
  YELLOW: 48,
  GREEN: 168,
};

export async function loadCohortHealth(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<CohortHealthMetrics> {
  const now = new Date();
  const since30d = new Date(now.getTime() - 30 * 86_400_000);

  const veterans = await tx.veteranProfile.findMany({
    where: { organizationId, status: "ACTIVE" },
    select: { userId: true, programStartDate: true, timezone: true },
  });

  const activeVeterans = veterans.length;

  // Check-in completion %: of veterans currently in week N, how many submitted
  // a CheckIn this week?
  let completed = 0;
  for (const v of veterans) {
    const week = currentWeekNumber(v.programStartDate, now, v.timezone);
    const submitted = await tx.checkIn.count({
      where: { veteranId: v.userId, weekNumber: week, organizationId },
    });
    if (submitted > 0) completed += 1;
  }
  const checkInCompletionPct =
    activeVeterans === 0 ? 0 : Math.round((completed / activeVeterans) * 100);

  // Median ORANGE response: time from Flag.createdAt to first matching
  // Contact.createdAt (same veteran, contact after the flag). 30-day window.
  const orangeFlags = await tx.flag.findMany({
    where: {
      organizationId,
      severity: "ORANGE",
      createdAt: { gte: since30d },
    },
    select: { id: true, veteranId: true, createdAt: true },
  });
  const responseLatencyHours: number[] = [];
  for (const f of orangeFlags) {
    const firstContact = await tx.contact.findFirst({
      where: {
        organizationId,
        veteranId: f.veteranId,
        createdAt: { gte: f.createdAt },
      },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    if (firstContact) {
      responseLatencyHours.push((firstContact.createdAt.getTime() - f.createdAt.getTime()) / 3_600_000);
    }
  }
  const medianOrangeResponseHours =
    responseLatencyHours.length > 0 ? median(responseLatencyHours) : null;

  // Flag counts this week (unresolved).
  const unresolved = await tx.flag.findMany({
    where: { organizationId, resolvedAt: null, createdAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } },
    select: { severity: true },
  });
  const flagCounts: Record<RiskLevel, number> = { GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0 };
  for (const f of unresolved) flagCounts[f.severity] += 1;

  return {
    activeVeterans,
    checkInCompletionPct,
    medianOrangeResponseHours,
    flagCounts,
  };
}

export async function loadCoordinatorHealth(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<CoordinatorRow[]> {
  const since30d = new Date(Date.now() - 30 * 86_400_000);
  const coordinators = await tx.user.findMany({
    where: { organizationId, role: "COORDINATOR", accountState: "ACTIVE" },
    select: { id: true, displayName: true, email: true },
  });

  const rows: CoordinatorRow[] = [];
  for (const c of coordinators) {
    const assigned = await tx.veteranProfile.findMany({
      where: { organizationId, assignedCoordinatorId: c.id, status: "ACTIVE" },
      select: { userId: true },
    });
    const caseload = assigned.length;
    const veteranIds = assigned.map((v) => v.userId);

    const unresolvedFlags = veteranIds.length
      ? await tx.flag.count({
          where: { organizationId, resolvedAt: null, veteranId: { in: veteranIds } },
        })
      : 0;

    // Response medians: ORANGE flags assigned to this coordinator → first
    // contact by this coordinator after the flag.
    const flags = veteranIds.length
      ? await tx.flag.findMany({
          where: {
            organizationId,
            severity: "ORANGE",
            createdAt: { gte: since30d },
            veteranId: { in: veteranIds },
          },
          select: { id: true, veteranId: true, createdAt: true, resolvedAt: true },
        })
      : [];
    const latencies: number[] = [];
    let resolvedWithinSla = 0;
    let resolvedTotal = 0;
    for (const f of flags) {
      const firstContact = await tx.contact.findFirst({
        where: {
          organizationId,
          veteranId: f.veteranId,
          coordinatorId: c.id,
          createdAt: { gte: f.createdAt },
        },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      });
      if (firstContact) {
        latencies.push((firstContact.createdAt.getTime() - f.createdAt.getTime()) / 3_600_000);
      }
      if (f.resolvedAt) {
        resolvedTotal += 1;
        const resolvedHours = (f.resolvedAt.getTime() - f.createdAt.getTime()) / 3_600_000;
        if (resolvedHours <= SLA_HOURS_BY_LEVEL.ORANGE) resolvedWithinSla += 1;
      }
    }
    rows.push({
      coordinatorId: c.id,
      name: c.displayName ?? c.email,
      caseload,
      unresolvedFlags,
      medianResponseHours: latencies.length > 0 ? median(latencies) : null,
      resolvedSlaPct: resolvedTotal > 0 ? Math.round((resolvedWithinSla / resolvedTotal) * 100) : null,
    });
  }
  return rows.sort((a, b) => b.caseload - a.caseload);
}

function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1]! + sorted[mid]!) / 2;
  return sorted[mid]!;
}
