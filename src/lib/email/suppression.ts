/**
 * Send-time suppression check.
 *
 * Resend webhooks update the `SuppressionList` table on hard bounce / complaint.
 * Every outbound email looks the recipient up here before dispatch. If
 * suppressed, the Notification row is marked SUPPRESSED and no email is sent.
 *
 * Platform-wide (no organizationId) — a bounce is a bounce regardless of which
 * org tried to email this address.
 */

import { prisma } from "@/lib/db/prisma";
import type { SuppressionReason } from "@prisma/client";

export interface SuppressionEntry {
  email: string;
  reason: SuppressionReason;
  suppressedAt: Date;
}

export async function isSuppressed(email: string): Promise<SuppressionEntry | null> {
  if (!email) return null;
  const lc = email.toLowerCase();
  const row = await prisma.suppressionList.findUnique({ where: { email: lc } });
  if (!row) return null;
  return { email: row.email, reason: row.reason, suppressedAt: row.suppressedAt };
}

export async function suppressEmail(
  email: string,
  reason: SuppressionReason,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  if (!email) return;
  const lc = email.toLowerCase();
  await prisma.suppressionList.upsert({
    where: { email: lc },
    create: {
      email: lc,
      reason,
      metadata: metadata as object,
    },
    update: {
      reason,
      suppressedAt: new Date(),
      metadata: metadata as object,
    },
  });
}

/**
 * Manually unsuppress (Org Admin override). Audit-logged at call site.
 */
export async function unsuppressEmail(email: string): Promise<void> {
  await prisma.suppressionList
    .delete({ where: { email: email.toLowerCase() } })
    .catch(() => undefined);
}
