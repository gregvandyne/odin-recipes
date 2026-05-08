/**
 * Tenant context binding.
 *
 * Every authenticated request resolves an organizationId. Before any query
 * runs, we set Postgres session variables that RLS policies check on every row.
 *
 * If you find yourself wanting to bypass this, stop. Use `withSuperAdmin()`,
 * which is logged and alerted, not the regular client.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export interface TenantContext {
  organizationId: string;
  userId: string;
  userRole: string;
  isOrgAdmin: boolean;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Run a callback with tenant context bound to the current Postgres session.
 * Uses a transaction so SET LOCAL applies only to enclosed queries.
 */
export async function withTenant<T>(
  ctx: TenantContext,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.organization_id', $1, true), set_config('app.is_super_admin', 'false', true)`,
      ctx.organizationId,
    );
    return fn(tx);
  });
}

/**
 * Platform-elevated context. Logged and alerted. Use only for documented
 * Super Admin support actions; the affected Org Admin must be notified.
 */
export async function withSuperAdmin<T>(
  reason: string,
  superAdminUserId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.organization_id', '', true), set_config('app.is_super_admin', 'true', true)`,
    );

    // Log the elevated access immediately, in the same transaction.
    await tx.auditLog.create({
      data: {
        organizationId: null,
        actorId: superAdminUserId,
        actorRole: "SUPER_ADMIN",
        action: "SUPER_ADMIN_ELEVATED",
        resourceType: "Platform",
        reason,
      },
    });

    return fn(tx);
  });
}
