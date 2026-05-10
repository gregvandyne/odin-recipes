/**
 * Find-or-create the message thread for a (veteran, coordinator) pair.
 *
 * The thread lives until the program ends — we don't archive between
 * weeks. If the assigned coordinator changes, a new thread is created on
 * first message; the prior thread stays read-only.
 *
 * Caller must run inside a tenant context with the right organizationId.
 */

import type { Prisma } from "@prisma/client";

export async function ensureMessageThread(
  tx: Prisma.TransactionClient,
  organizationId: string,
  veteranId: string,
  coordinatorId: string,
): Promise<{ id: string; isNew: boolean }> {
  const existing = await tx.messageThread.findFirst({
    where: {
      organizationId,
      veteranId,
      coordinatorId,
      status: { not: "ARCHIVED" },
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return { id: existing.id, isNew: false };
  const created = await tx.messageThread.create({
    data: {
      organizationId,
      veteranId,
      coordinatorId,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  return { id: created.id, isNew: true };
}
